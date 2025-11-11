from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from app.core.config import settings
from app.schemas.broker import Symbols
from typing import AsyncGenerator
import databento as dbt
import asyncio
import json
import pandas as pd
import re
from datetime import datetime
from sqlalchemy.orm import Session
from app.dependencies.database import get_db
from app.services.broker_service import get_positions
from app.utils.tradovate import get_contract_item, get_contract_maturity_item, get_product_item
from app.models.broker_account import BrokerAccount, SubBrokerAccount
from uuid import UUID

router = APIRouter()

# Store user subscriptions by client IP
user_subscriptions = {}

# Configuration constants
DATASET = "GLBX.MDP3"
SCHEMA = "mbp-1"
def _root_symbol_variants(symbol: str) -> list[str]:
    # Try to derive root like ES.FUT from ESZ5, NQZ5, etc.
    s = (symbol or "").upper()
    # Extract leading letters
    i = 0
    while i < len(s) and s[i].isalpha():
        i += 1
    root = s[:i]
    variants = [s]
    if root:
        variants.append(f"{root}.FUT")
    return list(dict.fromkeys(variants))


async def is_market_open(symbols: list[str]) -> tuple[bool, str]:
    """Check market status using recent historical data. Returns False if market is closed."""
    try:
        if not settings.DATABENTO_KEY:
            return (False, "missing_api_key")
        from datetime import datetime as dt, timezone, timedelta
        client = dbt.Historical(key=settings.DATABENTO_KEY)
        end = dt.now(timezone.utc)
        start = end - timedelta(minutes=15)  # Check last 15 minutes for recent data
        # Build variant list per symbol
        all_variants: list[str] = []
        for sym in symbols:
            all_variants.extend(_root_symbol_variants(sym))
        all_variants = list(dict.fromkeys([v for v in all_variants if v]))
        if not all_variants:
            return (False, "no_symbols")
        # Query minimal range; if data within 15 minutes, market is open
        result = client.timeseries.get_range(
            dataset=DATASET,
            start=start.isoformat(),
            end=end.isoformat(),
            symbols=all_variants,
            schema="ohlcv-1m",
        )
        df = result.to_df()
        if df.empty:
            return (False, "no_recent_data")
        try:
            max_ts = df.index.get_level_values("ts_event").max()
        except Exception:
            max_ts = None
        if not max_ts:
            return (False, "no_timestamp")
        # If latest data is more than 15 minutes old, market is likely closed
        if (end - max_ts) > timedelta(minutes=15):
            return (False, "market_closed")
        return (True, "market_open")
    except Exception as e:
        # On error, assume closed to be safe
        return (False, f"error_checking: {str(e)}")


@router.get("/market-status")
async def market_status(symbols: str):
    """Check if market appears open for given comma-separated symbols."""
    syms = [s.strip() for s in symbols.split(",") if s.strip()]
    open_flag, reason = await is_market_open(syms)
    return {"open": open_flag, "reason": reason, "symbols": syms, "timestamp": datetime.now().isoformat()}



async def stream_price_data(
    symbols: list[str],
    request: Request
) -> AsyncGenerator[str, None]:
    """
    Stream real-time price data from DataBento Live API
    
    Args:
        symbols: List of symbols to subscribe to (e.g., ['ES.FUT', 'NQ.FUT'])
        request: FastAPI request object for connection management
    """
    import uuid
    # Create unique connection ID for this stream
    connection_id = str(uuid.uuid4())[:8]
    
    # Create per-connection symbol mapping to avoid cross-contamination
    symbol_mapping = {}
    # Normalize requested symbols for comparison (uppercase, remove .FUT suffix if present)
    # Also create variants with and without .FUT suffix
    requested_symbols_normalized = set()
    for s in symbols:
        s_upper = s.upper()
        requested_symbols_normalized.add(s_upper)
        requested_symbols_normalized.add(s_upper.replace('.FUT', ''))
        if not s_upper.endswith('.FUT'):
            requested_symbols_normalized.add(s_upper + '.FUT')
    
    try:
        # Check if API key is available
        if not settings.DATABENTO_KEY:
            error_data = {
                "error": "DATABENTO_KEY environment variable not set",
                "details": "Please set DATABENTO_KEY environment variable to use the live data stream",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            return
        
        # Initialize DataBento Live client
        client = dbt.Live(key=settings.DATABENTO_KEY)
        
        # Subscribe to symbols with proper parameters
        client.subscribe(
            dataset=DATASET,
            schema=SCHEMA,
            symbols=symbols,
            stype_in="raw_symbol"
        )
        
        # Send initial status message with connection ID
        status_data = {
            "status": "connected",
            "message": "Connected to DataBento, waiting for price data...",
            "symbols": symbols,
            "connection_id": connection_id,
            "timestamp": datetime.now().isoformat()
        }
        yield f"data: {json.dumps(status_data)}\n\n"
        
                
        try:
            for record in client:
                # Check if client disconnected - do this FIRST before processing any data
                if await request.is_disconnected():
                    # Try to close the DataBento client
                    try:
                        if hasattr(client, 'close'):
                            client.close()
                    except:
                        pass
                    break
                
                try:
                    # Handle different record types
                    record_type = type(record).__name__
                    
                    if record_type == "SymbolMappingMsg":
                        # Handle symbol mapping messages
                        instrument_id = getattr(record, 'instrument_id', None)
                        symbol = getattr(record, 'stype_in_symbol', None)
                        
                        if instrument_id is not None and symbol is not None:
                            symbol_mapping[instrument_id] = symbol
                        
                        continue  # Skip symbol mapping messages for price display
                    
                    elif record_type in ["MBP1Msg", "MBPMsg", "TradeMsg"]:
                        # Double-check if client disconnected before processing
                        if await request.is_disconnected():
                            break
                        
                        # Handle actual price/trade data
                        # Extract data from MBP1Msg structure
                        # Get instrument_id from record
                        instrument_id = getattr(record, 'instrument_id', None)
                        
                        # Get symbol name from mapping if available
                        symbol = symbol_mapping.get(instrument_id, None)
                        if not symbol:
                            # Try to get from record directly
                            symbol = getattr(record, 'stype_in_symbol', None)
                        if not symbol:
                            symbol = f"Instrument-{instrument_id}"
                        
                        # Filter: Only send data for symbols that were requested in this connection
                        symbol_upper = symbol.upper()
                        symbol_variants = [
                            symbol_upper,
                            symbol_upper.replace('.FUT', ''),
                            symbol_upper + '.FUT' if not symbol_upper.endswith('.FUT') else symbol_upper
                        ]
                        if not any(variant in requested_symbols_normalized for variant in symbol_variants):
                            # Skip data for symbols not requested in this connection
                            continue
                        
                        # Get timestamp - try record.hd.ts_event first, then record.ts_event
                        timestamp = None
                        try:
                            if hasattr(record, 'hd') and hasattr(record.hd, 'ts_event'):
                                timestamp = record.hd.ts_event
                            elif hasattr(record, 'ts_event'):
                                timestamp = record.ts_event
                            else:
                                timestamp = datetime.now()
                        except:
                            timestamp = datetime.now()
                        
                        # Extract bid/ask data from levels
                        bid_price = None
                        ask_price = None
                        bid_size = None
                        ask_size = None
                        
                        # Check if levels is a list or a single object
                        if hasattr(record, 'levels'):
                            levels_data = record.levels
                            
                            # If it's a list, get first element
                            if isinstance(levels_data, list) and len(levels_data) > 0:
                                level = levels_data[0]
                            elif hasattr(levels_data, 'bid_px'):
                                # It might be a single BidAskPair object
                                level = levels_data
                            else:
                                level = None
                                
                            if level is not None:
                                # Extract prices from BidAskPair
                                # Use 'pretty_bid_px' and 'pretty_ask_px' for human-readable float values
                                # These are the correctly formatted prices, not the raw integer values
                                if hasattr(level, 'pretty_bid_px'):
                                    bid_price = float(level.pretty_bid_px)
                                elif hasattr(level, 'bid_px'):
                                    # Fallback to raw bid_px if pretty not available
                                    bid_price = float(level.bid_px)
                                    
                                if hasattr(level, 'pretty_ask_px'):
                                    ask_price = float(level.pretty_ask_px)
                                elif hasattr(level, 'ask_px'):
                                    # Fallback to raw ask_px if pretty not available
                                    ask_price = float(level.ask_px)
                                    
                                if hasattr(level, 'bid_sz'):
                                    bid_size = int(level.bid_sz)
                                if hasattr(level, 'ask_sz'):
                                    ask_size = int(level.ask_sz)
                        
                        data = {
                            "symbol": symbol,
                            "instrument_id": int(instrument_id) if instrument_id is not None else None,
                            "timestamp": str(timestamp),
                            "bid_price": bid_price,
                            "ask_price": ask_price,
                            "bid_size": bid_size,
                            "ask_size": ask_size,
                            "received_at": datetime.now().isoformat(),
                            "record_type": record_type,
                            "connection_id": connection_id  # Include connection ID for debugging
                        }

                        # Always send data to frontend (even if price data is None)
                        yield f"data: {json.dumps(data)}\n\n"
                    
                    else:
                        # Handle other record types - send raw data
                        data = {
                            "raw_data": record.asdict() if hasattr(record, 'asdict') else str(record),
                            "record_type": record_type,
                            "timestamp": datetime.now().isoformat()
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                        
                except Exception as record_error:
                    error_data = {
                        "error": f"Record processing error: {str(record_error)}",
                        "timestamp": datetime.now().isoformat()
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
                    
        except Exception as iteration_error:
            error_data = {
                "error": f"Iteration error: {str(iteration_error)}",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    except Exception as e:
        error_msg = str(e)
        
        # Provide specific guidance for authentication errors
        if "authentication failed" in error_msg.lower() or "cram" in error_msg.lower():
            detailed_error = {
                "error": "DataBento Authentication Failed",
                "details": "Invalid API key or insufficient permissions for live data",
                "solutions": [
                    "Verify your API key is correct",
                    "Ensure your key has live data access permissions", 
                    "Check if your key is for live data (not just historical)",
                    "Contact DataBento support if key appears valid"
                ],
                "timestamp": datetime.now().isoformat()
            }
        elif "nonetype" in error_msg.lower() or "await" in error_msg.lower():
            detailed_error = {
                "error": "DataBento Client Initialization Failed",
                "details": "Client object is None, likely due to subscription failure",
                "solutions": [
                    "Check if your API key has live data permissions",
                    "Verify the dataset and schema are correct",
                    "Ensure symbols are valid for the dataset",
                    "Check DataBento service status"
                ],
                "timestamp": datetime.now().isoformat()
            }
        else:
            detailed_error = {
                "error": f"DataBento API error: {error_msg}",
                "timestamp": datetime.now().isoformat()
            }
            
        yield f"data: {json.dumps(detailed_error)}\n\n"
    finally:
        # Try to close the DataBento client if it exists
        try:
            if 'client' in locals() and client:
                if hasattr(client, 'close'):
                    client.close()
        except Exception:
            pass


@router.post("/sse/current-price")
async def subscribe_symbols(request: Request, body: Symbols):
    """
    Subscribe to symbols for real-time price streaming
    
    Args:
        request: FastAPI request object
        body: Pydantic model containing list of symbols to subscribe to (e.g., {'symbols': ['ES.FUT', 'NQ.FUT']})
    
    Returns:
        Confirmation message
    """
    client_host = request.client.host
    symbols = body.symbols
    user_subscriptions[client_host] = symbols
    
    return {
        "message": "Subscribed successfully",
        "symbols": symbols,
        "client_host": client_host
    }


@router.get("/sse/current-price")
async def sse_price_stream(request: Request, symbols: str = None):
    """
    SSE endpoint to stream real-time prices for subscribed symbols
    
    Args:
        symbols: Comma-separated list of symbols (e.g., "ES.FUT,NQ.FUT") or single symbol
                 Can also be set via POST to /sse/current-price (legacy support)
    
    Returns:
        Server-Sent Events stream with real-time price data
    """
    # Get symbols from query parameter first, fallback to user_subscriptions
    if symbols:
        # Parse comma-separated symbols
        symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    else:
        # Legacy: try to get from user_subscriptions
        client_host = request.client.host
        symbol_list = user_subscriptions.get(client_host)
    
    if not symbol_list:
        raise HTTPException(
            status_code=400, 
            detail="No symbols provided. Please include ?symbols=SYMBOL in the query string."
        )

    # Check market status quickly to avoid slow connects when closed
    open_flag, reason = await is_market_open(symbol_list)
    if not open_flag:
        # Market is closed or API key missing - use historical data fallback
        async def historical_price_fallback():
            from datetime import datetime as dt, timezone, timedelta
            try:
                client = dbt.Historical(key=settings.DATABENTO_KEY)
                end = dt.now(timezone.utc)
                start = end - timedelta(minutes=5)  # Get last 5 minutes of data
                
                # Build symbol variants
                all_variants = []
                for sym in symbol_list:
                    all_variants.extend(_root_symbol_variants(sym))
                all_variants = list(dict.fromkeys([v for v in all_variants if v]))
                
                if all_variants:
                    result = client.timeseries.get_range(
                        dataset=DATASET,
                        start=start.isoformat(),
                        end=end.isoformat(),
                        symbols=all_variants,
                        schema="ohlcv-1m",
                    )
                    df = result.to_df()
                    if not df.empty:
                        # Get latest price for each symbol
                        for symbol in symbol_list:
                            symbol_variants = _root_symbol_variants(symbol)
                            for variant in symbol_variants:
                                symbol_data = df[df.index.get_level_values('symbol') == variant]
                                if not symbol_data.empty:
                                    latest = symbol_data.iloc[-1]
                                    price_data = {
                                        "symbol": symbol,
                                        "bid_price": float(latest['close']),
                                        "ask_price": float(latest['close']),
                                        "timestamp": str(latest.name[0]) if hasattr(latest.name, '__getitem__') else datetime.now().isoformat(),
                                        "received_at": datetime.now().isoformat(),
                                        "source": "historical",
                                        "status": "market_closed",
                                        "reason": reason
                                    }
                                    yield f"data: {json.dumps(price_data)}\n\n"
                                    break
                    
                    # Send market closed status
                    payload = {"status": "market_closed", "reason": reason, "source": "historical"}
                    yield f"data: {json.dumps(payload)}\n\n"
            except Exception as e:
                error_data = {"status": "market_closed", "reason": f"historical_fallback_error: {str(e)}"}
                yield f"data: {json.dumps(error_data)}\n\n"
        
        return StreamingResponse(
            historical_price_fallback(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

    return StreamingResponse(
        stream_price_data(symbol_list, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get("/test-connection")
async def test_databento_connection():
    """
    Test DataBento API connection and configuration
    """
    if not settings.DATABENTO_KEY:
        return {
            "status": "error",
            "message": "DATABENTO_KEY environment variable not set. Please set DATABENTO_KEY environment variable.",
            "api_key_set": False,
            "dataset": DATASET,
            "schema": SCHEMA,
            "error_type": "ConfigurationError"
        }
    
    try:
        # Test basic client initialization
        client = dbt.Live(key=settings.DATABENTO_KEY)
        
        return {
            "status": "success",
            "message": "DataBento client created successfully",
            "api_key_set": settings.DATABENTO_KEY != "your-api-key-here",
            "dataset": DATASET,
            "schema": SCHEMA,
            "client_type": str(type(client))
        }
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return {
            "status": "error",
            "message": f"DataBento test failed: {str(e)}",
            "api_key_set": settings.DATABENTO_KEY != "your-api-key-here",
            "dataset": DATASET,
            "schema": SCHEMA,
            "error_type": str(type(e))
        }


@router.get("/symbols")
async def get_available_symbols():
    """
    Get list of commonly traded symbols
    """
    return {
        "futures": [
            {"symbol": "ES.FUT", "name": "E-mini S&P 500"},
            {"symbol": "NQ.FUT", "name": "E-mini NASDAQ-100"},
            {"symbol": "YM.FUT", "name": "E-mini Dow Jones"},
            {"symbol": "RTY.FUT", "name": "E-mini Russell 2000"},
            {"symbol": "GC.FUT", "name": "Gold Futures"},
            {"symbol": "CL.FUT", "name": "Crude Oil Futures"},
        ]
    }


async def stream_pnl_data(
    user_id: UUID,
    request: Request,
    positions: list[dict],
    contract_details_cache: dict[int, dict]
) -> AsyncGenerator[str, None]:
    """
    Stream real-time profit and loss (PnL) data for user's positions using DataBento Live API
    
    Args:
        user_id: User ID to fetch positions for
        request: FastAPI request object for connection management
        positions: List of position dictionaries (already fetched, no DB session needed)
        contract_details_cache: Dictionary mapping contract_id to contract details (valuePerPoint, tickSize, symbol)
        
    Returns:
        SSE stream with real-time PnL data
    """
    # Create per-connection symbol mapping to avoid cross-contamination
    symbol_mapping = {}
    
    try:
        # Check if API key is available
        if not settings.DATABENTO_KEY:
            error_data = {
                "error": "DATABENTO_KEY environment variable not set",
                "details": "Please set DATABENTO_KEY environment variable to use the live data stream",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            return
        
        # Use positions passed in (already fetched, no DB query needed)
        if not positions or len(positions) == 0:
            error_data = {
                "error": "No open positions",
                "message": "You don't have any open positions to track",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            return
        
        # Helpers to read attrs from dict (positions are already converted to dicts)
        def _get(p, key):
                return p.get(key)

        # Extract unique symbols from positions
        symbols = list({(_get(pos, 'symbol')) for pos in positions if (_get(pos, 'netPos') or 0) != 0})
        
        if not symbols:
            error_data = {
                "error": "No active positions",
                "message": "All positions have zero quantity",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            return
        
        # Store position data for PnL calculation grouped by symbol
        # Some users may have multiple positions for the same symbol across accounts
        symbol_to_positions: dict[str, list[dict]] = {}
        
        for pos in positions:
            net_pos = _get(pos, 'netPos') or 0
            if net_pos != 0:
                contract_id = _get(pos, 'contractId')
                account_id = _get(pos, 'accountId')
                symbol_name = _get(pos, 'symbol')
                account_nickname = _get(pos, 'accountNickname')
                account_display = _get(pos, 'accountDisplayName')
                net_price = _get(pos, 'netPrice') or 0
                
                # Get contract details from cache (already fetched before stream started)
                contract_details = contract_details_cache.get(contract_id, {
                            "valuePerPoint": 50,  # Default ES multiplier
                            "tickSize": 0.25,  # Default ES tick size
                            "symbol": symbol_name
                })
                
                symbol_to_positions.setdefault(symbol_name, []).append({
                    "accountId": account_id,
                    "accountNickname": account_nickname,
                    "accountDisplayName": account_display,
                    "netPos": net_pos,
                    "netPrice": net_price,
                    "contractId": contract_id,
                    "symbol": symbol_name,
                    "contractDetails": contract_details_cache.get(contract_id, {
                        "valuePerPoint": 50,
                        "tickSize": 0.25,
                        "symbol": symbol_name
                    })
                })
        
        # Initialize DataBento Live client
        print(f"[PnL SSE] Initializing Live client for symbols: {symbols}")
        client = dbt.Live(key=settings.DATABENTO_KEY)
        print(f"[PnL SSE] Live client created successfully")
        
        # Subscribe to symbols
        print(f"[PnL SSE] Subscribing to symbols: {symbols}, dataset: {DATASET}, schema: {SCHEMA}")
        client.subscribe(
            dataset=DATASET,
            schema=SCHEMA,
            symbols=symbols,
            stype_in="raw_symbol"
        )
        print(f"[PnL SSE] Subscription completed")
        
        # Send initial status message
        status_data = {
            "status": "connected",
            "message": "Connected to DataBento for PnL tracking",
            "positions_count": sum(len(v) for v in symbol_to_positions.values()),
            "symbols": symbols,
            "timestamp": datetime.now().isoformat()
        }
        print(f"[PnL SSE] Sending initial status: {status_data}")
        yield f"data: {json.dumps(status_data)}\n\n"
        
        # Send initial PnL using historical data to ensure frontend gets data immediately
        try:
            print(f"[PnL SSE] Fetching initial historical data for symbols: {symbols}")
            from datetime import datetime as dt, timezone, timedelta
            hist_client = dbt.Historical(key=settings.DATABENTO_KEY)
            end = dt.now(timezone.utc)
            start = end - timedelta(minutes=5)
            
            all_variants = []
            for sym in symbols:
                all_variants.extend(_root_symbol_variants(sym))
            all_variants = list(dict.fromkeys([v for v in all_variants if v]))
            print(f"[PnL SSE] Historical query variants: {all_variants}, start: {start.isoformat()}, end: {end.isoformat()}")
            
            if all_variants:
                result = hist_client.timeseries.get_range(
                    dataset=DATASET,
                    start=start.isoformat(),
                    end=end.isoformat(),
                    symbols=all_variants,
                    schema="ohlcv-1m",
                )
                df = result.to_df()
                print(f"[PnL SSE] Historical data received: {len(df)} rows")
                
                # Send initial PnL for all positions
                initial_pnl_count = 0
                for symbol_name, position_list in symbol_to_positions.items():
                    current_price = None
                    symbol_variants = _root_symbol_variants(symbol_name)
                    for variant in symbol_variants:
                        symbol_data = df[df.index.get_level_values('symbol') == variant]
                        if not symbol_data.empty:
                            latest = symbol_data.iloc[-1]
                            current_price = float(latest['close'])
                            print(f"[PnL SSE] Found price for {symbol_name} (variant {variant}): {current_price}")
                            break
                    
                    if current_price is None:
                        print(f"[PnL SSE] WARNING: No price found for symbol {symbol_name}")
                        continue
                    
                    for position in position_list:
                        netPos = position["netPos"]
                        netPrice = position["netPrice"]
                        contractDetails = position["contractDetails"]
                        valuePerPoint = contractDetails["valuePerPoint"]
                        
                        if netPos > 0:
                            price_diff = current_price - netPrice
                            unrealized_pnl = price_diff * netPos * valuePerPoint
                        else:
                            price_diff = netPrice - current_price
                            unrealized_pnl = price_diff * abs(netPos) * valuePerPoint
                        
                        pnl_data = {
                            "symbol": symbol_name,
                            "accountId": position["accountId"],
                            "accountNickname": position["accountNickname"],
                            "accountDisplayName": position["accountDisplayName"],
                            "netPos": netPos,
                            "entryPrice": netPrice,
                            "currentPrice": current_price,
                            "unrealizedPnL": round(unrealized_pnl, 2),
                            "bidPrice": current_price,
                            "askPrice": current_price,
                            "timestamp": datetime.now().isoformat(),
                            "positionKey": f"{symbol_name}:{position['accountId']}",
                            "source": "initial_historical"
                        }
                        print(f"[PnL SSE] Sending initial PnL: {pnl_data['symbol']}, account: {pnl_data['accountId']}, PnL: {pnl_data['unrealizedPnL']}")
                        yield f"data: {json.dumps(pnl_data)}\n\n"
                        initial_pnl_count += 1
                print(f"[PnL SSE] Sent {initial_pnl_count} initial PnL updates")
        except Exception as init_error:
            # If initial historical fails, continue with live API
            print(f"[PnL SSE] ERROR in initial historical fetch: {str(init_error)}")
            import traceback
            print(f"[PnL SSE] Traceback: {traceback.format_exc()}")
        
        try:
            # Track latest prices for each symbol
            latest_prices = {}
            record_count = 0
            
            print(f"[PnL SSE] Starting to iterate over Live client records...")
            for record in client:
                record_count += 1
                if record_count % 100 == 0:
                    print(f"[PnL SSE] Processed {record_count} records from Live API")
                
                # Check if client disconnected - do this FIRST before processing any data
                if await request.is_disconnected():
                    print(f"[PnL SSE] Client disconnected, closing connection")
                    # Try to close the DataBento client
                    try:
                        if hasattr(client, 'close'):
                            client.close()
                    except:
                        pass
                    break
                
                try:
                    # Handle different record types
                    record_type = type(record).__name__
                    
                    if record_type == "SymbolMappingMsg":
                        # Handle symbol mapping messages
                        instrument_id = getattr(record, 'instrument_id', None)
                        symbol = getattr(record, 'stype_in_symbol', None)
                        
                        if instrument_id is not None and symbol is not None:
                            symbol_mapping[instrument_id] = symbol
                            print(f"[PnL SSE] Symbol mapping: instrument_id={instrument_id} -> symbol={symbol}")
                        
                        continue
                    
                    elif record_type in ["MBP1Msg", "MBPMsg", "TradeMsg"]:
                        if record_count <= 10 or record_count % 50 == 0:
                            print(f"[PnL SSE] Received {record_type} record #{record_count}")
                        # Extract price data robustly
                        instrument_id = getattr(record, 'instrument_id', None)
                        symbol = symbol_mapping.get(instrument_id, None) or getattr(record, 'stype_in_symbol', None)
                        if not symbol or symbol not in symbol_to_positions:
                            if record_count <= 10:
                                print(f"[PnL SSE] Skipping record: symbol={symbol}, instrument_id={instrument_id}, symbol in positions: {symbol in symbol_to_positions if symbol else False}")
                            continue

                        bid_price = None
                        ask_price = None
                        last_price = None
                        if record_count <= 10:
                            print(f"[PnL SSE] Processing price data for symbol: {symbol}, instrument_id: {instrument_id}")

                        if hasattr(record, 'levels'):
                            levels_data = record.levels
                            if isinstance(levels_data, list) and len(levels_data) > 0:
                                level = levels_data[0]
                            elif hasattr(levels_data, 'bid_px') or hasattr(levels_data, 'ask_px'):
                                level = levels_data
                            else:
                                level = None
                            if level is not None:
                                if hasattr(level, 'pretty_bid_px'):
                                    bid_price = float(level.pretty_bid_px)
                                elif hasattr(level, 'bid_px'):
                                    bid_price = float(level.bid_px)
                                if hasattr(level, 'pretty_ask_px'):
                                    ask_price = float(level.pretty_ask_px)
                                elif hasattr(level, 'ask_px'):
                                    ask_price = float(level.ask_px)

                        if record_type == 'TradeMsg':
                            if hasattr(record, 'pretty_px'):
                                last_price = float(record.pretty_px)
                            elif hasattr(record, 'px'):
                                last_price = float(record.px)

                        if bid_price is None and ask_price is None and last_price is None:
                            if record_count <= 10:
                                print(f"[PnL SSE] No price data extracted for symbol {symbol}")
                            continue
                        
                        if record_count <= 10 or record_count % 50 == 0:
                            print(f"[PnL SSE] Price data for {symbol}: bid={bid_price}, ask={ask_price}, last={last_price}")
                        
                        latest_prices[symbol] = {"bid": bid_price, "ask": ask_price, "last": last_price}

                        # Calculate and emit PnL for all positions under this symbol
                        pnl_updates_sent = 0
                        for position in symbol_to_positions[symbol]:
                            netPos = position["netPos"]
                            netPrice = position["netPrice"]
                            contractDetails = position["contractDetails"]
                            valuePerPoint = contractDetails["valuePerPoint"]
                            tickSize = contractDetails["tickSize"]

                            # Determine which price to use based on position direction
                            # Long positions: use BID (what you'd get if you sell now)
                            # Short positions: use ASK (what you'd pay if you buy back now)
                            if netPos > 0:  # Long position
                                current_price = bid_price if bid_price is not None else (last_price if last_price is not None else ask_price)
                                if current_price is None:
                                    continue
                                # PnL = (Current Price - Entry Price) * Quantity * Contract Multiplier
                                price_diff = current_price - netPrice
                                unrealized_pnl = price_diff * netPos * valuePerPoint
                            else:  # Short position
                                current_price = ask_price if ask_price is not None else (last_price if last_price is not None else bid_price)
                                if current_price is None:
                                    continue
                                # PnL = (Entry Price - Current Price) * Quantity * Contract Multiplier
                                price_diff = netPrice - current_price
                                unrealized_pnl = price_diff * abs(netPos) * valuePerPoint

                            pnl_data = {
                                "symbol": symbol,
                                "accountId": position["accountId"],
                                "accountNickname": position["accountNickname"],
                                "accountDisplayName": position["accountDisplayName"],
                                "netPos": netPos,
                                "entryPrice": netPrice,
                                "currentPrice": current_price,
                                "unrealizedPnL": round(unrealized_pnl, 2),
                                "bidPrice": bid_price,
                                "askPrice": ask_price,
                                "lastPrice": last_price,
                                "valuePerPoint": valuePerPoint,
                                "tickSize": tickSize,
                                "priceDiff": round(price_diff, 4),
                                "timestamp": datetime.now().isoformat(),
                                "positionKey": f"{symbol}:{position['accountId']}"
                            }

                            if record_count <= 10 or pnl_updates_sent == 0:
                                print(f"[PnL SSE] Sending PnL update: {symbol}, account: {position['accountId']}, PnL: {pnl_data['unrealizedPnL']}")
                            yield f"data: {json.dumps(pnl_data)}\n\n"
                            pnl_updates_sent += 1
                
                except Exception as record_error:
                    if record_count <= 10:
                        print(f"[PnL SSE] ERROR processing record #{record_count}: {str(record_error)}")
                        import traceback
                        print(f"[PnL SSE] Traceback: {traceback.format_exc()}")
                    continue
                    
        except Exception as iteration_error:
            # Live API failed - fallback to historical data
            error_msg = str(iteration_error)
            print(f"[PnL SSE] ERROR in Live API iteration: {error_msg}")
            import traceback
            print(f"[PnL SSE] Traceback: {traceback.format_exc()}")
            print(f"[PnL SSE] Total records processed before error: {record_count}")
            yield f"data: {json.dumps({'status': 'live_api_failed', 'error': error_msg, 'falling_back': 'historical'})}\n\n"
            
            # Fallback to historical data
            try:
                from datetime import datetime as dt, timezone, timedelta
                hist_client = dbt.Historical(key=settings.DATABENTO_KEY)
                end = dt.now(timezone.utc)
                start = end - timedelta(minutes=5)
                
                # Build symbol variants
                all_variants = []
                for sym in symbols:
                    all_variants.extend(_root_symbol_variants(sym))
                all_variants = list(dict.fromkeys([v for v in all_variants if v]))
                
                if all_variants:
                    result = hist_client.timeseries.get_range(
                        dataset=DATASET,
                        start=start.isoformat(),
                        end=end.isoformat(),
                        symbols=all_variants,
                        schema="ohlcv-1m",
                    )
                    df = result.to_df()
                    
                    # Calculate PnL using historical data
                    for symbol_name, position_list in symbol_to_positions.items():
                        # Find latest price for this symbol
                        current_price = None
                        symbol_variants = _root_symbol_variants(symbol_name)
                        for variant in symbol_variants:
                            symbol_data = df[df.index.get_level_values('symbol') == variant]
                            if not symbol_data.empty:
                                latest = symbol_data.iloc[-1]
                                current_price = float(latest['close'])
                                break
                        
                        if current_price is None:
                            continue
                        
                        # Calculate PnL for all positions of this symbol
                        for position in position_list:
                            netPos = position["netPos"]
                            netPrice = position["netPrice"]
                            contractDetails = position["contractDetails"]
                            valuePerPoint = contractDetails["valuePerPoint"]
                            
                            # Calculate PnL
                            if netPos > 0:
                                price_diff = current_price - netPrice
                                unrealized_pnl = price_diff * netPos * valuePerPoint
                            else:
                                price_diff = netPrice - current_price
                                unrealized_pnl = price_diff * abs(netPos) * valuePerPoint
                            
                            pnl_data = {
                                "symbol": symbol_name,
                                "accountId": position["accountId"],
                                "accountNickname": position["accountNickname"],
                                "accountDisplayName": position["accountDisplayName"],
                                "netPos": netPos,
                                "entryPrice": netPrice,
                                "currentPrice": current_price,
                                "unrealizedPnL": round(unrealized_pnl, 2),
                                "bidPrice": current_price,
                                "askPrice": current_price,
                                "timestamp": datetime.now().isoformat(),
                                "positionKey": f"{symbol_name}:{position['accountId']}",
                                "source": "historical_fallback"
                            }
                            yield f"data: {json.dumps(pnl_data)}\n\n"
            except Exception as hist_error:
                error_data = {
                    "error": f"Historical fallback also failed: {str(hist_error)}",
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(error_data)}\n\n"
    
    except Exception as e:
        error_msg = str(e)
        # Try historical fallback even on initial connection error
        try:
            # Extract symbols from positions if not already defined
            if 'symbols' not in locals() or not symbols:
                symbols = list({(pos.get('symbol')) for pos in positions if (pos.get('netPos') or 0) != 0})
            
            if not symbols or not positions:
                error_data = {
                    "error": f"PnL tracking error: {error_msg}",
                    "timestamp": datetime.now().isoformat()
                }
                yield f"data: {json.dumps(error_data)}\n\n"
                return
            
            from datetime import datetime as dt, timezone, timedelta
            hist_client = dbt.Historical(key=settings.DATABENTO_KEY)
            end = dt.now(timezone.utc)
            start = end - timedelta(minutes=5)
            
            all_variants = []
            for sym in symbols:
                all_variants.extend(_root_symbol_variants(sym))
            all_variants = list(dict.fromkeys([v for v in all_variants if v]))
            
            if all_variants and positions:
                result = hist_client.timeseries.get_range(
                    dataset=DATASET,
                    start=start.isoformat(),
                    end=end.isoformat(),
                    symbols=all_variants,
                    schema="ohlcv-1m",
                )
                df = result.to_df()
                
                # Calculate PnL using historical data
                for pos in positions:
                    net_pos = pos.get("netPos") or 0
                    if net_pos != 0:
                        symbol_name = pos.get("symbol")
                        account_id = pos.get("accountId")
                        net_price = pos.get("netPrice") or 0
                        contract_id = pos.get("contractId")
                        contract_details = contract_details_cache.get(contract_id, {"valuePerPoint": 50, "tickSize": 0.25})
                        
                        current_price = net_price
                        symbol_variants = _root_symbol_variants(symbol_name)
                        for variant in symbol_variants:
                            symbol_data = df[df.index.get_level_values('symbol') == variant]
                            if not symbol_data.empty:
                                latest = symbol_data.iloc[-1]
                                current_price = float(latest['close'])
                                break
                        
                        price_diff = current_price - net_price
                        unrealized_pnl = price_diff * net_pos * contract_details.get("valuePerPoint", 50)
                        
                        pnl_data = {
                            "symbol": symbol_name,
                            "accountId": account_id,
                            "accountNickname": pos.get("accountNickname", ""),
                            "accountDisplayName": pos.get("accountDisplayName", ""),
                            "netPos": net_pos,
                            "entryPrice": net_price,
                            "currentPrice": current_price,
                            "unrealizedPnL": round(unrealized_pnl, 2),
                            "bidPrice": current_price,
                            "askPrice": current_price,
                            "timestamp": datetime.now().isoformat(),
                            "positionKey": f"{symbol_name}:{account_id}",
                            "source": "historical_fallback"
                        }
                        yield f"data: {json.dumps(pnl_data)}\n\n"
        except:
            error_data = {
                "error": f"PnL tracking error: {error_msg}",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    finally:
        # Try to close the DataBento client if it exists
        try:
            if 'client' in locals() and client:
                if hasattr(client, 'close'):
                    client.close()
        except Exception:
            pass


@router.get("/sse/pnl")
async def sse_pnl_stream(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    SSE endpoint to stream real-time profit and loss (PnL) for user's positions
    
    Returns:
        Server-Sent Events stream with real-time PnL data
    """
    # Fetch positions data and contract details BEFORE starting the stream
    # This allows us to close the database session immediately
    positions_dict = []
    contract_details_cache = {}
    
    try:
        positions = await get_positions(db, user_id)
        # Convert Pydantic models to dicts for serialization
        for pos in positions:
            if isinstance(pos, dict):
                positions_dict.append(pos)
            else:
                # Convert Pydantic model to dict
                positions_dict.append({
                    "id": getattr(pos, "id", None),
                    "accountId": getattr(pos, "accountId", None),
                    "contractId": getattr(pos, "contractId", None),
                    "accountNickname": getattr(pos, "accountNickname", None),
                    "symbol": getattr(pos, "symbol", None),
                    "netPos": getattr(pos, "netPos", 0),
                    "netPrice": getattr(pos, "netPrice", 0),
                    "bought": getattr(pos, "bought", 0),
                    "boughtValue": getattr(pos, "boughtValue", 0),
                    "sold": getattr(pos, "sold", 0),
                    "soldValue": getattr(pos, "soldValue", 0),
                    "accountDisplayName": getattr(pos, "accountDisplayName", None),
                })
        
        # Fetch contract details for all positions while we still have the DB session
        account_ids = {str(p.get("accountId") or getattr(p, "accountId", None)) for p in positions_dict if (p.get("netPos") or getattr(p, "netPos", 0) or 0) != 0}
        if account_ids:
            sub_accounts = (
                db.query(SubBrokerAccount)
                .filter(SubBrokerAccount.sub_account_id.in_(list(account_ids)))
                .all()
            )
            sub_map = {s.sub_account_id: s for s in sub_accounts}
            
            # Get unique contract IDs
            unique_contracts = {}
            for pos in positions_dict:
                net_pos = pos.get("netPos") or 0
                if net_pos != 0:
                    contract_id = pos.get("contractId")
                    account_id = str(pos.get("accountId"))
                    if contract_id and account_id in sub_map:
                        sba = sub_map[account_id]
                        key = (sba.is_demo, contract_id)
                        if key not in unique_contracts:
                            unique_contracts[key] = {
                                "contract_id": contract_id,
                                "is_demo": sba.is_demo,
                                "broker_account": db.query(BrokerAccount)
                                    .filter(BrokerAccount.user_broker_id == sba.user_broker_id)
                                    .first()
                            }
            
            # Fetch contract details for all unique contracts
            for (is_demo, contract_id), info in unique_contracts.items():
                if info["broker_account"]:
                    try:
                        contract_item = await get_contract_item(
                            contract_id, info["broker_account"].access_token, is_demo=is_demo
                        )
                        if contract_item:
                            contract_maturity = await get_contract_maturity_item(
                                contract_item["contractMaturityId"], info["broker_account"].access_token, is_demo=is_demo
                            )
                            if contract_maturity:
                                product_item = await get_product_item(
                                    contract_maturity["productId"], info["broker_account"].access_token, is_demo=is_demo
                                )
                                if product_item:
                                    contract_details_cache[contract_id] = {
                                        "valuePerPoint": product_item.get("valuePerPoint", 50),
                                        "tickSize": product_item.get("tickSize", 0.25),
                                        "symbol": contract_item.get("name", "")
                                    }
                    except Exception:
                        # Use defaults
                        contract_details_cache[contract_id] = {
                            "valuePerPoint": 50,
                            "tickSize": 0.25,
                            "symbol": ""
                        }
        
        symbols = list({p.get("symbol") for p in positions_dict if (p.get("netPos") or 0) != 0}) or []
    except Exception:
        positions_dict = []
        symbols = []
    
    # Database session will be automatically closed when the dependency exits
    
    if symbols:
        open_flag, reason = await is_market_open(symbols)
        if not open_flag:
            # Market is closed - use historical data fallback for PnL
            async def historical_pnl_fallback():
                from datetime import datetime as dt, timezone, timedelta
                try:
                    client = dbt.Historical(key=settings.DATABENTO_KEY)
                    end = dt.now(timezone.utc)
                    start = end - timedelta(minutes=5)  # Get last 5 minutes of data
                    
                    # Build symbol variants
                    all_variants = []
                    for sym in symbols:
                        all_variants.extend(_root_symbol_variants(sym))
                    all_variants = list(dict.fromkeys([v for v in all_variants if v]))
                    
                    if all_variants:
                        result = client.timeseries.get_range(
                            dataset=DATASET,
                            start=start.isoformat(),
                            end=end.isoformat(),
                            symbols=all_variants,
                            schema="ohlcv-1m",
                        )
                        df = result.to_df()
                        
                        # Calculate PnL for each position using historical closing price
                        for pos in positions_dict:
                            net_pos = pos.get("netPos") or 0
                            if net_pos != 0:
                                symbol_name = pos.get("symbol")
                                account_id = pos.get("accountId")
                                net_price = pos.get("netPrice") or 0
                                contract_id = pos.get("contractId")
                                
                                # Get contract details
                                contract_details = contract_details_cache.get(contract_id, {
                                    "valuePerPoint": 50,
                                    "tickSize": 0.25,
                                    "symbol": symbol_name
                                })
                                
                                # Find latest price for this symbol
                                current_price = net_price  # Default to entry price
                                symbol_variants = _root_symbol_variants(symbol_name)
                                for variant in symbol_variants:
                                    symbol_data = df[df.index.get_level_values('symbol') == variant]
                                    if not symbol_data.empty:
                                        latest = symbol_data.iloc[-1]
                                        current_price = float(latest['close'])
                                        break
                                
                                # Calculate unrealized PnL
                                price_diff = current_price - net_price
                                unrealized_pnl = price_diff * net_pos * contract_details.get("valuePerPoint", 50)
                                
                                pnl_data = {
                                    "symbol": symbol_name,
                                    "accountId": account_id,
                                    "accountNickname": pos.get("accountNickname", ""),
                                    "accountDisplayName": pos.get("accountDisplayName", ""),
                                    "netPos": net_pos,
                                    "entryPrice": net_price,
                                    "currentPrice": current_price,
                                    "unrealizedPnL": unrealized_pnl,
                                    "bidPrice": current_price,
                                    "askPrice": current_price,
                                    "timestamp": datetime.now().isoformat(),
                                    "positionKey": f"{symbol_name}:{account_id}",
                                    "source": "historical",
                                    "status": "market_closed",
                                    "reason": reason
                                }
                                yield f"data: {json.dumps(pnl_data)}\n\n"
                    
                        # Send market closed status
                        payload = {"status": "market_closed", "reason": reason, "source": "historical"}
                        yield f"data: {json.dumps(payload)}\n\n"
                except Exception as e:
                    error_data = {"status": "market_closed", "reason": f"historical_fallback_error: {str(e)}"}
                    yield f"data: {json.dumps(error_data)}\n\n"
            
            return StreamingResponse(
                historical_pnl_fallback(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                }
            )

    # Pass positions_dict and contract_details_cache instead of db session to avoid holding connection
    return StreamingResponse(
        stream_pnl_data(user_id, request, positions_dict, contract_details_cache),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/historical")
async def get_historical_chart(
    symbol: str,
    start: str,
    end: str,
    schema: str = "ohlcv-1m"
):
    """
    Get historical OHLCV data for a symbol
    
    Args:
        symbol: Symbol to fetch data for (e.g., "ES.FUT", "NQ.FUT")
        start: Start time in ISO format (e.g., "2022-06-06T20:50:00")
        end: End time in ISO format (e.g., "2022-06-06T21:00:00")
        schema: Data schema (default: "ohlcv-1m" for 1-minute candles)
    
    Returns:
        Historical OHLCV data as JSON
    """
    try:
        # Check if API key is available
        if not settings.DATABENTO_KEY:
            raise HTTPException(
                status_code=500,
                detail="DATABENTO_KEY environment variable not set"
            )
        
        # Parse and adjust times to ensure they're within available data range
        from datetime import datetime, timezone, timedelta
        
        # Parse input times
        start_dt = datetime.fromisoformat(start.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(end.replace('Z', '+00:00'))
        
        # DataBento typically has data available up to a few minutes ago
        # Adjust end time to be 5 minutes before current time to be safe
        current_time = datetime.now(timezone.utc)
        safe_end_time = current_time - timedelta(minutes=5)
        
        # Use the earlier of: requested end time or safe end time
        if end_dt > safe_end_time:
            end_dt = safe_end_time
            print(f"⚠️ Adjusted end time to {end_dt.isoformat()} to stay within available data range")
        
        # Ensure start time is not after end time
        if start_dt >= end_dt:
            # If start is after or equal to end, go back 1 hour from end
            start_dt = end_dt - timedelta(hours=1)
            print(f"⚠️ Adjusted start time to {start_dt.isoformat()} to ensure valid range")
        
        # Convert back to ISO strings for the API call
        start_iso = start_dt.isoformat()
        end_iso = end_dt.isoformat()
        
        print(f"📊 Fetching historical data for {symbol} from {start_iso} to {end_iso}")
        
        # Create a historical client
        client = dbt.Historical(key=settings.DATABENTO_KEY)
        
        # Try to request historical OHLCV data with retry logic
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                historical_data = client.timeseries.get_range(
                    dataset=DATASET,
                    start=start_iso,
                    end=end_iso,
                    symbols=[symbol],
                    schema=schema,
                )
                break  # Success, exit retry loop
                
            except Exception as api_error:
                error_msg = str(api_error)
                
                # Check if it's the specific "data_end_after_available_end" error
                if "data_end_after_available_end" in error_msg and retry_count < max_retries - 1:
                    retry_count += 1
                    print(f"⚠️ Retry {retry_count}/{max_retries}: {error_msg}")
                    
                    # Extract the available end time from the error message if possible
                    # Format: "data available up to '2025-10-29 05:20:00+00:00'"
                    match = re.search(r"data available up to '([^']+)'", error_msg)
                    if match:
                        available_end_str = match.group(1)
                        try:
                            available_end = datetime.fromisoformat(available_end_str)
                            # Set end time to 1 minute before available end
                            end_dt = available_end - timedelta(minutes=1)
                            end_iso = end_dt.isoformat()
                            print(f"🔄 Adjusted end time to {end_iso} based on available data range")
                        except:
                            # If parsing fails, just subtract more time
                            end_dt = end_dt - timedelta(minutes=10)
                            end_iso = end_dt.isoformat()
                            print(f"🔄 Fallback: Adjusted end time to {end_iso}")
                    else:
                        # If we can't parse the available end time, subtract more time
                        end_dt = end_dt - timedelta(minutes=10)
                        end_iso = end_dt.isoformat()
                        print(f"🔄 Fallback: Adjusted end time to {end_iso}")
                    
                    continue  # Retry with adjusted time
                else:
                    # Re-raise the error if it's not the specific error or we've exhausted retries
                    raise api_error
        
        # Convert to DataFrame
        df = historical_data.to_df().reset_index()
        
        # Convert DataFrame to records
        records = []
        for _, row in df.iterrows():
            record = {
                "timestamp": row.get("ts_event", ""),
                "symbol": row.get("symbol", symbol),
                "open": float(row.get("open", 0)),
                "high": float(row.get("high", 0)),
                "low": float(row.get("low", 0)),
                "close": float(row.get("close", 0)),
                "volume": int(row.get("volume", 0)),
            }
            records.append(record)
        
        print(f"✅ Fetched {len(records)} historical candles for {symbol}")
        
        return {
            "symbol": symbol,
            "start": start_iso,
            "end": end_iso,
            "schema": schema,
            "count": len(records),
            "data": records
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Error fetching historical data: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching historical data: {error_msg}"
        )

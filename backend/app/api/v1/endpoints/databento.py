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

# Store symbol mapping (instrument_id -> symbol name)
symbol_mapping = {}

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
    """Heuristic market status using recent historical data presence; permissive to avoid false negatives."""
    try:
        if not settings.DATABENTO_KEY:
            return (False, "missing_api_key")
        from datetime import datetime as dt, timezone, timedelta
        client = dbt.Historical(key=settings.DATABENTO_KEY)
        end = dt.now(timezone.utc)
        start = end - timedelta(minutes=90)
        # Build variant list per symbol
        all_variants: list[str] = []
        for sym in symbols:
            all_variants.extend(_root_symbol_variants(sym))
        all_variants = list(dict.fromkeys([v for v in all_variants if v]))
        if not all_variants:
            return (True, "no_symbols")
        # Query minimal range; if any data within 60 minutes, treat open
        result = client.timeseries.get_range(
            dataset=DATASET,
            start=start.isoformat(),
            end=end.isoformat(),
            symbols=all_variants,
            schema="ohlcv-1m",
        )
        df = result.to_df()
        if df.empty:
            return (True, "permissive_no_data")
        try:
            max_ts = df.index.get_level_values("ts_event").max()
        except Exception:
            max_ts = None
        if not max_ts:
            return (True, "permissive_no_ts")
        if (end - max_ts) <= timedelta(minutes=60):
            return (True, "recent_data")
        return (True, "permissive_stale")
    except Exception:
        # Be permissive to avoid blocking live
        return (True, "error_checking_permissive")


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
        
        print(f"📊 Dataset: {DATASET}")
        print(f"📋 Schema: {SCHEMA}")
        print(f"🎯 Symbols: {symbols}")
        
        # Initialize DataBento Live client
        client = dbt.Live(key=settings.DATABENTO_KEY)
        print("✅ DataBento client initialized")
        
        # Subscribe to symbols with proper parameters
        print("🔄 Subscribing to symbols...")
        client.subscribe(
            dataset=DATASET,
            schema=SCHEMA,
            symbols=symbols,
            stype_in="raw_symbol"
        )
        print(f"✅ Successfully subscribed to symbols: {symbols}")

        print("🔄 Starting data stream...")
        
        # Send initial status message
        status_data = {
            "status": "connected",
            "message": "Connected to DataBento, waiting for price data...",
            "symbols": symbols,
            "timestamp": datetime.now().isoformat()
        }
        print(f"📤 Sending status message: {status_data}")
        yield f"data: {json.dumps(status_data)}\n\n"
        
                
        try:
            for record in client:
                # Check if client disconnected
                if await request.is_disconnected():
                    print("❌ Client disconnected")
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
                            print(f"🗺️ Symbol mapping: {symbol} -> Instrument ID {instrument_id}")
                        
                        continue  # Skip symbol mapping messages for price display
                    
                    elif record_type in ["MBP1Msg", "MBPMsg", "TradeMsg"]:
                        # Handle actual price/trade data
                        # Extract data from MBP1Msg structure
                        # Get instrument_id from record
                        print(f"📦 Record: {record}")
                        instrument_id = getattr(record, 'instrument_id', None)
                        
                        # Get symbol name from mapping if available
                        symbol = symbol_mapping.get(instrument_id, f"Instrument-{instrument_id}")
                        
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
                        
                        # Debug: Print record structure to understand levels format
                        print(f"🔍 Record levels type: {type(record.levels) if hasattr(record, 'levels') else 'None'}")
                        print(f"🔍 Record levels value: {record.levels if hasattr(record, 'levels') else 'None'}")
                        
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
                                print(f"🔍 Level type: {type(level)}")
                                print(f"🔍 Level attributes: {dir(level)}")
                                
                                # Extract prices from BidAskPair
                                # Use 'pretty_bid_px' and 'pretty_ask_px' for human-readable float values
                                # These are the correctly formatted prices, not the raw integer values
                                if hasattr(level, 'pretty_bid_px'):
                                    bid_price = float(level.pretty_bid_px)
                                    print(f"📊 Extracted bid_px (pretty): {bid_price}")
                                elif hasattr(level, 'bid_px'):
                                    # Fallback to raw bid_px if pretty not available
                                    bid_price = float(level.bid_px)
                                    print(f"📊 Extracted bid_px (raw): {bid_price}")
                                    
                                if hasattr(level, 'pretty_ask_px'):
                                    ask_price = float(level.pretty_ask_px)
                                    print(f"📊 Extracted ask_px (pretty): {ask_price}")
                                elif hasattr(level, 'ask_px'):
                                    # Fallback to raw ask_px if pretty not available
                                    ask_price = float(level.ask_px)
                                    print(f"📊 Extracted ask_px (raw): {ask_price}")
                                    
                                if hasattr(level, 'bid_sz'):
                                    bid_size = int(level.bid_sz)
                                    print(f"📊 Extracted bid_sz: {bid_size}")
                                if hasattr(level, 'ask_sz'):
                                    ask_size = int(level.ask_sz)
                                    print(f"📊 Extracted ask_sz: {ask_size}")
                        
                        data = {
                            "symbol": symbol,
                            "instrument_id": int(instrument_id) if instrument_id is not None else None,
                            "timestamp": str(timestamp),
                            "bid_price": bid_price,
                            "ask_price": ask_price,
                            "bid_size": bid_size,
                            "ask_size": ask_size,
                            "received_at": datetime.now().isoformat(),
                            "record_type": record_type
                        }

                        # Always send data to frontend (even if price data is None)
                        print(f"💰 Sending {record_type} data: {data['symbol']} (ID: {data['instrument_id']}) - Bid: {data['bid_price']}, Ask: {data['ask_price']}")
                        yield f"data: {json.dumps(data)}\n\n"
                    
                    else:
                        # Handle other record types - send raw data
                        print(f"ℹ️ Unhandled record type: {record_type}")
                        data = {
                            "raw_data": record.asdict() if hasattr(record, 'asdict') else str(record),
                            "record_type": record_type,
                            "timestamp": datetime.now().isoformat()
                        }
                        yield f"data: {json.dumps(data)}\n\n"
                        
                except Exception as record_error:
                    print(f"❌ Error processing record: {record_error}")
                    error_data = {
                        "error": f"Record processing error: {str(record_error)}",
                        "timestamp": datetime.now().isoformat()
                    }
                    yield f"data: {json.dumps(error_data)}\n\n"
                    
        except Exception as iteration_error:
            print(f"❌ Error during iteration: {iteration_error}")
            error_data = {
                "error": f"Iteration error: {str(iteration_error)}",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    except Exception as e:
        error_msg = str(e)
        print(f"❌ DataBento connection error: {error_msg}")
        
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
        print("🧹 DataBento connection cleanup completed")


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
    
    print(f"📝 Client {client_host} subscribed to symbols: {symbols}")
    return {
        "message": "Subscribed successfully",
        "symbols": symbols,
        "client_host": client_host
    }


@router.get("/sse/current-price")
async def sse_price_stream(request: Request):
    """
    SSE endpoint to stream real-time prices for subscribed symbols
    
    Returns:
        Server-Sent Events stream with real-time price data
    """
    client_host = request.client.host
    symbols = user_subscriptions.get(client_host)
    
    if not symbols:
        raise HTTPException(
            status_code=400, 
            detail="No symbols subscribed. Please POST to /sse/current-price first with a symbols list."
        )

    # Check market status quickly to avoid slow connects when closed
    open_flag, reason = await is_market_open(symbols)
    if not open_flag and reason == "missing_api_key":
        async def closed_stream():
            payload = {"status": "market_closed", "reason": reason}
            yield f"data: {json.dumps(payload)}\n\n"
        return StreamingResponse(
            closed_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )

    return StreamingResponse(
        stream_price_data(symbols, request),
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
        print(f"✅ Client created: {type(client)}")
        
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
    db: Session
) -> AsyncGenerator[str, None]:
    """
    Stream real-time profit and loss (PnL) data for user's positions using DataBento Live API
    
    Args:
        user_id: User ID to fetch positions for
        request: FastAPI request object for connection management
        db: Database session
        
    Returns:
        SSE stream with real-time PnL data
    """
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
        
        # Fetch user's positions (may be Pydantic models or dicts if cached)
        positions = await get_positions(db, user_id)
        
        if not positions or len(positions) == 0:
            error_data = {
                "error": "No open positions",
                "message": "You don't have any open positions to track",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            return
        
        # Helpers to read attrs from model or dict
        def _get(p, key):
            if isinstance(p, dict):
                return p.get(key)
            return getattr(p, key, None)

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
        
        print(f"📊 Positions found: {len(positions)}")
        print(f"🎯 Symbols to track: {symbols}")
        
        # Store position data for PnL calculation grouped by symbol
        # Some users may have multiple positions for the same symbol across accounts
        symbol_to_positions: dict[str, list[dict]] = {}
        contract_details_cache: dict[int, dict] = {}  # Cache contract details by contractId
        
        for pos in positions:
            net_pos = _get(pos, 'netPos') or 0
            if net_pos != 0:
                # Get contract details if not cached
                contract_id = _get(pos, 'contractId')
                account_id = _get(pos, 'accountId')
                symbol_name = _get(pos, 'symbol')
                account_nickname = _get(pos, 'accountNickname')
                account_display = _get(pos, 'accountDisplayName')
                net_price = _get(pos, 'netPrice') or 0
                if contract_id not in contract_details_cache:
                    try:
                        # Get broker account for this position
                        db_sub_broker_account = (
                            db.query(SubBrokerAccount)
                            .filter(SubBrokerAccount.sub_account_id == str(account_id))
                            .first()
                        )
                        
                        if db_sub_broker_account:
                            db_broker_account = (
                                db.query(BrokerAccount)
                                .filter(BrokerAccount.user_broker_id == db_sub_broker_account.user_broker_id)
                                .first()
                            )
                            
                            if db_broker_account:
                                # Get contract item details
                                contract_item = await get_contract_item(
                                    contract_id, db_broker_account.access_token, is_demo=db_sub_broker_account.is_demo
                                )
                                
                                if contract_item:
                                    # Get product details for multiplier
                                    contract_maturity = await get_contract_maturity_item(
                                        contract_item["contractMaturityId"], db_broker_account.access_token, is_demo=db_sub_broker_account.is_demo
                                    )
                                    
                                    if contract_maturity:
                                        product_item = await get_product_item(
                                            contract_maturity["productId"], db_broker_account.access_token, is_demo=db_sub_broker_account.is_demo
                                        )
                                        
                                        if product_item:
                                            contract_details_cache[contract_id] = {
                                                "valuePerPoint": product_item.get("valuePerPoint", 50),  # Default ES multiplier
                                                "tickSize": product_item.get("tickSize", 0.25),  # Default ES tick size
                                                "symbol": contract_item.get("name", symbol_name)
                                            }
                                            print(f"📊 Contract {contract_id} details: {contract_details_cache[contract_id]}")
                                        else:
                                            print(f"⚠️ Could not get product details for contract {contract_id}")
                                    else:
                                        print(f"⚠️ Could not get contract maturity for contract {contract_id}")
                                else:
                                    print(f"⚠️ Could not get contract item for contract {contract_id}")
                            else:
                                print(f"⚠️ Could not find broker account for sub-broker {account_id}")
                        else:
                            print(f"⚠️ Could not find sub-broker account for account {account_id}")
                    except Exception as e:
                        print(f"❌ Error fetching contract details for {contract_id}: {e}")
                        # Use default values if we can't fetch contract details
                        contract_details_cache[contract_id] = {
                            "valuePerPoint": 50,  # Default ES multiplier
                            "tickSize": 0.25,  # Default ES tick size
                            "symbol": symbol_name
                        }
                
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
        client = dbt.Live(key=settings.DATABENTO_KEY)
        print("✅ DataBento client initialized for PnL tracking")
        
        # Subscribe to symbols
        print("🔄 Subscribing to symbols for PnL tracking...")
        client.subscribe(
            dataset=DATASET,
            schema=SCHEMA,
            symbols=symbols,
            stype_in="raw_symbol"
        )
        print(f"✅ Successfully subscribed to symbols: {symbols}")
        
        # Send initial status message
        status_data = {
            "status": "connected",
            "message": "Connected to DataBento for PnL tracking",
            "positions_count": sum(len(v) for v in symbol_to_positions.values()),
            "symbols": symbols,
            "timestamp": datetime.now().isoformat()
        }
        print(f"📤 Sending status message: {status_data}")
        yield f"data: {json.dumps(status_data)}\n\n"
        
        try:
            # Track latest prices for each symbol
            latest_prices = {}
            
            for record in client:
                # Check if client disconnected
                if await request.is_disconnected():
                    print("❌ Client disconnected")
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
                        
                        continue
                    
                    elif record_type in ["MBP1Msg", "MBPMsg", "TradeMsg"]:
                        # Extract price data robustly
                        instrument_id = getattr(record, 'instrument_id', None)
                        symbol = symbol_mapping.get(instrument_id, None) or getattr(record, 'stype_in_symbol', None)
                        if not symbol or symbol not in symbol_to_positions:
                            continue

                        bid_price = None
                        ask_price = None
                        last_price = None

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
                            continue
                        
                        latest_prices[symbol] = {"bid": bid_price, "ask": ask_price, "last": last_price}

                        # Calculate and emit PnL for all positions under this symbol
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

                            print(
                                f"💰 PnL for {symbol} (acct {position['accountId']}): "
                                f"${unrealized_pnl:.2f} (Qty: {netPos}, Entry: ${netPrice}, Current: ${current_price}, "
                                f"Multiplier: {valuePerPoint}, Price Diff: ${price_diff:.4f})"
                            )
                            yield f"data: {json.dumps(pnl_data)}\n\n"
                
                except Exception as record_error:
                    print(f"❌ Error processing record: {record_error}")
                    continue
                    
        except Exception as iteration_error:
            print(f"❌ Error during iteration: {iteration_error}")
            error_data = {
                "error": f"Iteration error: {str(iteration_error)}",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
    
    except Exception as e:
        error_msg = str(e)
        print(f"❌ DataBento PnL tracking error: {error_msg}")
        
        error_data = {
            "error": f"PnL tracking error: {error_msg}",
            "timestamp": datetime.now().isoformat()
        }
        yield f"data: {json.dumps(error_data)}\n\n"
    
    finally:
        print("🧹 DataBento PnL tracking cleanup completed")


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
    # Derive symbols from positions for quick market status check
    try:
        positions = await get_positions(db, user_id)
        symbols = list({p.symbol for p in positions if getattr(p, "netPos", 0) != 0}) or []
    except Exception:
        symbols = []
    if symbols:
        open_flag, reason = await is_market_open(symbols)
        if not open_flag and reason == "missing_api_key":
            async def closed_stream():
                payload = {"status": "market_closed", "reason": reason}
                yield f"data: {json.dumps(payload)}\n\n"
            return StreamingResponse(
                closed_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                }
            )

    return StreamingResponse(
        stream_pnl_data(user_id, request, db),
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

from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
from app.core.config import settings
from app.schemas.broker import Symbols
from typing import AsyncGenerator
import databento as dbt
import asyncio
import json
import pandas as pd
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
        
        # Fetch user's positions
        positions = await get_positions(db, user_id)
        
        if not positions or len(positions) == 0:
            error_data = {
                "error": "No open positions",
                "message": "You don't have any open positions to track",
                "timestamp": datetime.now().isoformat()
            }
            yield f"data: {json.dumps(error_data)}\n\n"
            return
        
        # Extract unique symbols from positions
        symbols = list(set([pos.symbol for pos in positions if pos.netPos != 0]))
        
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
            if pos.netPos != 0:
                # Get contract details if not cached
                if pos.contractId not in contract_details_cache:
                    try:
                        # Get broker account for this position
                        db_sub_broker_account = (
                            db.query(SubBrokerAccount)
                            .filter(SubBrokerAccount.sub_account_id == str(pos.accountId))
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
                                    pos.contractId, db_broker_account.access_token, is_demo=True
                                )
                                
                                if contract_item:
                                    # Get product details for multiplier
                                    contract_maturity = await get_contract_maturity_item(
                                        contract_item["contractMaturityId"], db_broker_account.access_token, is_demo=True
                                    )
                                    
                                    if contract_maturity:
                                        product_item = await get_product_item(
                                            contract_maturity["productId"], db_broker_account.access_token, is_demo=True
                                        )
                                        
                                        if product_item:
                                            contract_details_cache[pos.contractId] = {
                                                "valuePerPoint": product_item.get("valuePerPoint", 50),  # Default ES multiplier
                                                "tickSize": product_item.get("tickSize", 0.25),  # Default ES tick size
                                                "symbol": contract_item.get("name", pos.symbol)
                                            }
                                            print(f"📊 Contract {pos.contractId} details: {contract_details_cache[pos.contractId]}")
                                        else:
                                            print(f"⚠️ Could not get product details for contract {pos.contractId}")
                                    else:
                                        print(f"⚠️ Could not get contract maturity for contract {pos.contractId}")
                                else:
                                    print(f"⚠️ Could not get contract item for contract {pos.contractId}")
                            else:
                                print(f"⚠️ Could not find broker account for sub-broker {pos.accountId}")
                        else:
                            print(f"⚠️ Could not find sub-broker account for account {pos.accountId}")
                    except Exception as e:
                        print(f"❌ Error fetching contract details for {pos.contractId}: {e}")
                        # Use default values if we can't fetch contract details
                        contract_details_cache[pos.contractId] = {
                            "valuePerPoint": 50,  # Default ES multiplier
                            "tickSize": 0.25,  # Default ES tick size
                            "symbol": pos.symbol
                        }
                
                symbol_to_positions.setdefault(pos.symbol, []).append({
                    "accountId": pos.accountId,
                    "accountNickname": pos.accountNickname,
                    "accountDisplayName": pos.accountDisplayName,
                    "netPos": pos.netPos,
                    "netPrice": pos.netPrice,
                    "contractId": pos.contractId,
                    "symbol": pos.symbol,
                    "contractDetails": contract_details_cache.get(pos.contractId, {
                        "valuePerPoint": 50,
                        "tickSize": 0.25,
                        "symbol": pos.symbol
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
                        # Extract price data
                        instrument_id = getattr(record, 'instrument_id', None)
                        symbol = symbol_mapping.get(instrument_id, None)
                        
                        if not symbol or symbol not in symbol_to_positions:
                            continue
                        
                        # Get current price (mid-price)
                        bid_price = None
                        ask_price = None
                        
                        if hasattr(record, 'levels'):
                            levels_data = record.levels
                            
                            if isinstance(levels_data, list) and len(levels_data) > 0:
                                level = levels_data[0]
                            elif hasattr(levels_data, 'bid_px'):
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
                        
                        # Validate we have at least one price
                        if bid_price is None and ask_price is None:
                            continue
                        
                        latest_prices[symbol] = {
                            "bid": bid_price,
                            "ask": ask_price
                        }

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
                                current_price = bid_price if bid_price is not None else ask_price
                                if current_price is None:
                                    continue
                                # PnL = (Current Price - Entry Price) * Quantity * Contract Multiplier
                                price_diff = current_price - netPrice
                                unrealized_pnl = price_diff * netPos * valuePerPoint
                            else:  # Short position
                                current_price = ask_price if ask_price is not None else bid_price
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
        
        print(f"📊 Fetching historical data for {symbol} from {start} to {end}")
        
        # Create a historical client
        client = dbt.Historical(key=settings.DATABENTO_KEY)
        
        # Request historical OHLCV data
        historical_data = client.timeseries.get_range(
            dataset=DATASET,
            start=start,
            end=end,
            symbols=[symbol],
            schema=schema,
        )
        
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
            "start": start,
            "end": end,
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

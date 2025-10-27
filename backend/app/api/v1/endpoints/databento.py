from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.core.config import settings
from app.schemas.broker import Symbols
from typing import AsyncGenerator
import databento as db
import asyncio
import json
from datetime import datetime

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
        client = db.Live(key=settings.DATABENTO_KEY)
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
                                # Prices are already in the correct format (no fixed-point conversion needed)
                                if hasattr(level, 'bid_px'):
                                    bid_price = float(level.bid_px)
                                    print(f"📊 Extracted bid_px: {bid_price}")
                                if hasattr(level, 'ask_px'):
                                    ask_price = float(level.ask_px)
                                    print(f"📊 Extracted ask_px: {ask_price}")
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
        client = db.Live(key=settings.DATABENTO_KEY)
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

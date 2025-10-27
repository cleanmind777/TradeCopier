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
                    # Debug: Print raw record to understand structure
                    print(f"📦 Received record: {type(record)}")
                    
                    # Handle different record types
                    record_type = type(record).__name__
                    
                    if record_type == "SymbolMappingMsg":
                        # Handle symbol mapping messages
                        print(f"🗺️ Symbol mapping: {getattr(record, 'stype_in_symbol', 'Unknown')} -> {getattr(record, 'stype_out_symbol', 'Unknown')}")
                        continue  # Skip symbol mapping messages for price display
                    
                    elif record_type in ["MBP1Msg", "MBPMsg", "TradeMsg"]:
                        # Handle actual price/trade data
                        # Extract data from MBP1Msg structure
                        symbol = getattr(record, 'symbol', getattr(record, 'instrument_id', 'UNKNOWN'))
                        timestamp = getattr(record, 'ts_event', getattr(record.hd, 'ts_event', datetime.now()))
                        
                        # Extract bid/ask data from levels array
                        bid_price = None
                        ask_price = None
                        bid_size = None
                        ask_size = None
                        
                        if hasattr(record, 'levels') and record.levels and len(record.levels) > 0:
                            level = record.levels[0]
                            
                            # Extract prices - they may be in fixed-point format (int * 1e9)
                            # If the value is > 1000000, it's likely in fixed-point format, divide by 1e9
                            raw_bid = level.bid_px if hasattr(level, 'bid_px') else None
                            raw_ask = level.ask_px if hasattr(level, 'ask_px') else None
                            
                            # Convert to float, then check if we need to scale down
                            if raw_bid is not None:
                                bid_value = float(raw_bid)
                                # Check if value seems to be in fixed-point format (very large number)
                                if bid_value > 1000000:
                                    bid_price = bid_value / 1e9
                                else:
                                    bid_price = bid_value
                            else:
                                bid_price = None
                            
                            if raw_ask is not None:
                                ask_value = float(raw_ask)
                                # Check if value seems to be in fixed-point format (very large number)
                                if ask_value > 1000000:
                                    ask_price = ask_value / 1e9
                                else:
                                    ask_price = ask_value
                            else:
                                ask_price = None
                            
                            bid_size = int(level.bid_sz) if hasattr(level, 'bid_sz') and level.bid_sz else None
                            ask_size = int(level.ask_sz) if hasattr(level, 'ask_sz') and level.ask_sz else None
                        
                        data = {
                            "symbol": str(symbol),
                            "timestamp": str(timestamp),
                            "bid_price": bid_price,
                            "ask_price": ask_price,
                            "bid_size": bid_size,
                            "ask_size": ask_size,
                            "received_at": datetime.now().isoformat(),
                            "record_type": record_type
                        }

                        # Always send data to frontend (even if price data is None)
                        print(f"💰 Sending {record_type} data: {data['symbol']} - Bid: {data['bid_price']}, Ask: {data['ask_price']}")
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

import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
// import TradingViewWidget from "../components/trading/TradingViewWidget";
import { getWebSocketToken } from "../api/brokerApi";
import { createChart, ColorType } from "lightweight-charts";

const TradingPage: React.FC = () => {
  const [marketData, setMarketData] = useState<{
    bid: number | null;
    ask: number | null;
    last: number | null;
    timestamp: string;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [candleCount, setCandleCount] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  // Lightweight Charts refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null); // Using any to avoid complex type issues
  const lineSeriesRef = useRef<any>(null); // Using any to avoid complex type issues
  const lastUpdateTimeRef = useRef<number>(0); // Track last update time

  const sendHeartbeatIfNeeded = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
      wsRef.current.send('[]');
    } catch (error) {
      console.error("Heartbeat send error:", error);
      reconnectWebSocket();
    }
    
    heartbeatTimerRef.current = setTimeout(sendHeartbeatIfNeeded, 2500);
  };

  const subscribeToQuotes = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
      const subscribeMsg = `md/subscribeQuote\n2\n\n${JSON.stringify({ symbol: "3267313" })}`;
      wsRef.current.send(subscribeMsg);
    } catch (error) {
      console.error("Subscription error:", error);
      reconnectWebSocket();
    }
  };

  const handleWebSocketMessage = (message: MessageEvent) => {
    const data = message.data as string;
    if (data.length === 0) return;

    const frameType = data[0];
    if (frameType === 'a') {
      try {
        const parsedData = JSON.parse(data.substring(1));
        parsedData.forEach((item: any) => {
          if (item.s !== undefined && item.i !== undefined) {
            if (item.i === 1 && item.s === 200) {
              setConnectionStatus("Connected");
              subscribeToQuotes();
            }
          } else if (item.e === 'md') {
            if (item.d && item.d.quotes) {
              const quote = item.d.quotes[0];
              const entries = quote.entries || {};
              const bidData = entries.Bid || {};
              const askData = entries.Offer || {};
              const tradeData = entries.Trade || {};

              const newMarketData = {
                bid: bidData.price || null,
                ask: askData.price || null,
                last: tradeData.price || null,
                timestamp: quote.timestamp || "N/A",
              };

              console.log('Received market data:', newMarketData);
              setMarketData(newMarketData);

              // Use last price if available, otherwise use mid-price (bid+ask)/2, or fallback to bid or ask
              let price = newMarketData.last;
              if (!price && newMarketData.bid && newMarketData.ask) {
                price = (newMarketData.bid + newMarketData.ask) / 2;
                console.log('Using mid-price:', price);
              } else if (!price && newMarketData.bid) {
                price = newMarketData.bid;
                console.log('Using bid price:', price);
              } else if (!price && newMarketData.ask) {
                price = newMarketData.ask;
                console.log('Using ask price:', price);
              }

              // Update line chart with available price
              if (price && lineSeriesRef.current) {
                const currentTime = Math.floor(Date.now() / 1000);

                // Only update if at least 1 second has passed since last update
                // This prevents too many data points and keeps the chart smooth
                if (currentTime > lastUpdateTimeRef.current) {
                  lastUpdateTimeRef.current = currentTime;

                  // Create data point for line chart
                  const dataPoint = {
                    time: currentTime,
                    value: price,
                  };

                  // Update the chart
                  try {
                    lineSeriesRef.current.update(dataPoint);
                    setCandleCount(prev => prev + 1);
                    console.log('Chart updated with price:', dataPoint);
                    
                    // Auto-scale only on first few updates
                    if (candleCount < 5 && chartRef.current) {
                      chartRef.current.timeScale().fitContent();
                    }
                  } catch (error) {
                    console.error('Error updating chart:', error);
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    } else if (frameType === 'h') {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('[]');
      }
    }
  };

  const handleBeforeUnload = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "Browser closing");
    }
  };

  const reconnectWebSocket = () => {
    cleanupWebSocket();
    initializeWebSocket();
  };

  const cleanupWebSocket = () => {
    // Remove beforeunload listener first
    window.removeEventListener('beforeunload', handleBeforeUnload);

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, "Component unmounting");
        }
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
      } catch (error) {
        console.error("Cleanup error:", error);
      } finally {
        wsRef.current = null;
      }
    }

    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    
    setConnectionStatus("Disconnected");
  };

  const initializeWebSocket = async () => {
    try {
      setConnectionStatus("Connecting...");
      const token = await getWebSocketToken(user_id);
      if (!token?.access_token) {
        setConnectionStatus("Failed (No Token)");
        return;
      }

      const ws = new WebSocket("wss://md.tradovateapi.com/v1/websocket");
      wsRef.current = ws;

      // Add beforeunload listener for browser/tab close
      window.addEventListener('beforeunload', handleBeforeUnload);

      ws.onopen = () => {
        try {
          const authMsg = `authorize\n1\n\n${token.access_token}`;
          ws.send(authMsg);
          heartbeatTimerRef.current = setTimeout(sendHeartbeatIfNeeded, 2500);
        } catch (error) {
          console.error("WebSocket open error:", error);
          reconnectWebSocket();
        }
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("Error");
        reconnectWebSocket();
      };

      ws.onclose = () => {
        setConnectionStatus("Disconnected");
        if (wsRef.current === ws) {
          reconnectWebSocket();
        }
      };

    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("Failed");
      reconnectWebSocket();
    }
  };

  useEffect(() => {
    initializeWebSocket();

    return () => {
      cleanupWebSocket();
    };
  }, [user_id]);

  // Initialize lightweight chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Ensure container has dimensions before creating chart
    const containerWidth = chartContainerRef.current.clientWidth;
    if (containerWidth === 0) {
      console.warn('Chart container has no width, delaying initialization');
      return;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#000000' },
        textColor: '#333',
      },
      width: containerWidth,
      height: 500,
      grid: {
        vertLines: {
          color: '#e1e4e8',
        },
        horzLines: {
          color: '#e1e4e8',
        },
      },
      crosshair: {
        mode: 1, // Normal crosshair mode
      },
      rightPriceScale: {
        borderColor: '#d1d4dc',
      },
      timeScale: {
        borderColor: '#d1d4dc',
        timeVisible: true,
        secondsVisible: true,
      },
    });

    // Use setTimeout to ensure chart is fully rendered before adding series
    const timeoutId = setTimeout(() => {
      try {
        console.log('Initializing line series...');
        const lineSeries = (chart as any).addLineSeries({
          color: '#2962FF',
          lineWidth: 2,
          priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
          },
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 6,
          lastValueVisible: true,
          priceLineVisible: true,
        });

        chartRef.current = chart;
        lineSeriesRef.current = lineSeries;
        console.log('Line series created successfully');

      } catch (error) {
        console.error('Error adding line series:', error);
      }
    }, 0);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        lineSeriesRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Trading Dashboard</h1>
            <div className={`px-4 py-2 rounded-md ${
              connectionStatus === "Connected" ? "bg-green-100 text-green-800" :
              connectionStatus === "Connecting..." ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}>
              Status: {connectionStatus}
            </div>
          </div>

          {/* Real-time Price Chart using Lightweight Charts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <span>Real-Time Price Line Chart</span>
                <span className="text-sm font-normal text-gray-600">
                  Updates: {candleCount}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div 
                ref={chartContainerRef} 
                className="w-full"
                style={{ height: '500px' }}
              />
              {candleCount === 0 && marketData && (
                <div className="text-center text-gray-500 mt-4">
                  Connecting to market data... (Bid: ${marketData.bid}, Ask: ${marketData.ask}, Last: ${marketData.last || 'N/A'})
                </div>
              )}
              {candleCount === 0 && !marketData && (
                <div className="text-center text-gray-500 mt-4">
                  Waiting for WebSocket connection...
                </div>
              )}
            </CardContent>
          </Card>

          {/* <div>
            <TradingViewWidget symbol={"NQZ2025"} />
          </div> */}
          {marketData && (
            <Card>
              <CardHeader>Market Data</CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Bid</h3>
                    <p className="text-lg font-semibold">
                      ${marketData.bid || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Ask</h3>
                    <p className="text-lg font-semibold">
                      ${marketData.ask || "N/A"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Last</h3>
                    <p className="text-lg font-semibold">
                      ${marketData.last || "N/A"}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Last update: {marketData.timestamp}
                </p>
              </CardContent>
            </Card>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default TradingPage;
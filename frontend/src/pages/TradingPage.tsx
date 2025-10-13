import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import TradingViewWidget from "../components/trading/TradingViewWidget";
import { getWebSocketToken } from "../api/brokerApi";

const TradingPage: React.FC = () => {
  const [marketData, setMarketData] = useState<{
    bid: number | null;
    ask: number | null;
    last: number | null;
    timestamp: string;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

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
      const subscribeMsg = `md/subscribeQuote\n2\n\n${JSON.stringify({ symbol: "NQZ2025" })}`;
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

              setMarketData({
                bid: bidData.price || null,
                ask: askData.price || null,
                last: tradeData.price || null,
                timestamp: quote.timestamp || "N/A",
              });
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
          <div>
            <TradingViewWidget symbol={"NQZ2025"} />
          </div>
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
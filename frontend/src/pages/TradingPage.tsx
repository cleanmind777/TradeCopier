import React, { useState, useEffect } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/Table";
import { Trash2 } from "lucide-react";
import Modal from "../components/ui/Modal";
import Input from "../components/ui/Input";
import TradingViewWidget from "../components/trading/TradingViewWidget";
import { Tokens } from "../types/broker";
import { getWebSocketToken } from "../api/brokerApi";

const TradingPage: React.FC = () => {
  const [marketData, setMarketData] = useState<{
    bid: number | null;
    ask: number | null;
    last: number | null;
    timestamp: string;
  } | null>(null);
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [heartbeatTimer, setHeartbeatTimer] = useState<NodeJS.Timeout | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  const sendHeartbeatIfNeeded = (ws: WebSocket) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send('[]');
    }
    // Schedule next check
    const timer = setTimeout(() => sendHeartbeatIfNeeded(ws), 2500);
    setHeartbeatTimer(timer);
  };

  const subscribeToQuotes = (ws: WebSocket) => {
    // MNQ Dec 2025 contract ID (replace with the correct symbol for your needs)
    const subscribeMsg = `md/subscribeQuote\n2\n\n${JSON.stringify({ symbol: "NQZ2025" })}`;
    ws.send(subscribeMsg);
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
            // Handle response messages
            if (item.i === 1 && item.s === 200) {
              setConnectionStatus("Connected");
              subscribeToQuotes(wsConnection!);
            }
          } else if (item.e === 'md') {
            // Handle market data
            if (item.d && item.d.quotes) {
              const quote = item.d.quotes[0];
              const entries = quote.entries || {};
              const bidData = entries.Bid || {};
              const askData = entries.Offer || {};
              const tradeData = entries.Trade || {};

              const marketDataUpdate = {
                bid: bidData.price || null,
                ask: askData.price || null,
                last: tradeData.price || null,
                timestamp: quote.timestamp || "N/A",
              };

              setMarketData(marketDataUpdate);
            }
          }
        });
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    } else if (frameType === 'h') {
      // Handle heartbeat
      wsConnection?.send('[]');
    } else if (frameType === 'o') {
      setConnectionStatus("Connecting...");
    } else if (frameType === 'c') {
      setConnectionStatus("Disconnected");
    }
  };

  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        setConnectionStatus("Connecting...");
        const token = await getWebSocketToken(user_id);
        if (!token) {
          setConnectionStatus("Failed (No Token)");
          return;
        }

        const ws = new WebSocket("wss://md.tradovateapi.com/v1/websocket");

        ws.onopen = () => {
          const authMsg = `authorize\n1\n\n${token.access_token}`;
          ws.send(authMsg);
          // Start heartbeat
          const timer = setTimeout(() => sendHeartbeatIfNeeded(ws), 2500);
          setHeartbeatTimer(timer);
          setWsConnection(ws);
        };

        ws.onmessage = handleWebSocketMessage;

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionStatus("Error");
        };

        ws.onclose = () => {
          setConnectionStatus("Disconnected");
          if (heartbeatTimer) {
            clearTimeout(heartbeatTimer);
          }
          setWsConnection(null);
        };
      } catch (error) {
        console.error("Connection error:", error);
        setConnectionStatus("Failed");
      }
    };

    connectWebSocket();

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
      }
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
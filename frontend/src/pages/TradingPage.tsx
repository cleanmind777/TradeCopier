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
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;
  useEffect(() => {
    const connectWebSocket = async () => {
      const token = await getWebSocketToken(user_id);
      let accessToken = "";
      // Replace with your actual access token retrieval logic
      if (token != null) {
        accessToken = token.access_token;
      }

      const ws = new WebSocket("wss://md-demo.tradovateapi.com/v1/websocket");

      ws.onopen = () => {
        console.log("WebSocket connection opened");
        const authMsg = `authorize\n1\n\n${accessToken}`;
        ws.send(authMsg);
      };

      ws.onmessage = (message: MessageEvent) => {
        const data = message.data as string;
        if (data.length === 0) return;

        const frameType = data[0];
        if (frameType === "a") {
          try {
            const parsedData = JSON.parse(data.substring(1));
            parsedData.forEach((item: any) => {
              if (item.e === "md" && item.d && item.d.quotes) {
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
            });
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setWsConnection(null);
      };

      setWsConnection(ws);
    };

    connectWebSocket();

    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, [wsConnection]);

  return (
    <div className="flex bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 space-y-8">
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

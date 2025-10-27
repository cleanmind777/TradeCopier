import { useEffect, useState, useRef } from "react";
import Input from "../ui/Input";
import Button from "../ui/Button";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface PriceData {
  symbol?: string;
  instrument_id?: number;
  timestamp?: string;
  bid_price?: number;
  ask_price?: number;
  bid_size?: number;
  ask_size?: number;
  received_at?: string;
  record_type?: string;
  status?: string;
  test?: string;
}

const SymbolsMonitor = () => {
  const [symbolInput, setSymbolInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  const handleConnect = async () => {
    if (!symbolInput.trim()) {
      alert("Please enter at least one symbol");
      return;
    }

    // Parse comma-separated symbols
    const symbolList = symbolInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (symbolList.length === 0) {
      alert("Please enter valid symbols");
      return;
    }

    setIsConnecting(true);
    setConnectionStatus("Connecting...");

    try {
      // First, subscribe to symbols
      const response = await fetch(`${API_BASE}/databento/sse/current-price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: symbolList }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to subscribe to symbols");
      }

      // Then start the SSE stream
      const es = new EventSource(`${API_BASE}/databento/sse/current-price`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnecting(false);
        setIsConnected(true);
        setConnectionStatus("Connected");
        setSymbols(symbolList);
      };

      es.onmessage = (e) => {
        try {
          const data: PriceData = JSON.parse(e.data);
          
          // Skip status messages
          if (data.status === "connected" || data.test) {
            return;
          }

          // Update prices with the received data
          if (data.symbol) {
            setPrices((prev) => ({ ...prev, [data.symbol!]: data }));
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      es.onerror = (error) => {
        console.error("SSE error:", error);
        setIsConnected(false);
        setConnectionStatus("Connection error");
        es.close();
        eventSourceRef.current = null;
      };
    } catch (error) {
      console.error("Failed to connect:", error);
      alert(`Failed to connect: ${error instanceof Error ? error.message : "Unknown error"}`);
      setIsConnecting(false);
      setConnectionStatus("Connection failed");
    }
  };

  const handleDisconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus("Disconnected");
    setPrices({});
    setSymbols([]);
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Symbol Monitor</h2>
        
        {/* Input and Connect/Disconnect Controls */}
        <div className="flex gap-4 items-end mb-4">
          <div className="flex-1">
            <Input
              label="Symbols (comma-separated)"
              placeholder="e.g., ES.FUT, NQ.FUT, YM.FUT"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              disabled={isConnected}
            />
            <p className="text-sm text-slate-500 mt-1">
              Example: ES.FUT, NQ.FUT, YM.FUT, GC.FUT
            </p>
          </div>
          <div className="flex gap-2">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !symbolInput.trim()}
                isLoading={isConnecting}
              >
                {isConnecting ? "Connecting..." : "Connect"}
              </Button>
            ) : (
              <Button onClick={handleDisconnect} variant="outline">
                Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* Connection Status */}
        {connectionStatus && (
          <div className={`mb-4 p-3 rounded-lg ${
            isConnected 
              ? "bg-green-50 text-green-800 border border-green-200" 
              : "bg-yellow-50 text-yellow-800 border border-yellow-200"
          }`}>
            <p className="font-medium">Status: {connectionStatus}</p>
          </div>
        )}
      </div>

      {/* Price Display */}
      {isConnected && symbols.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Live Prices</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {symbols.map((symbol) => {
              const priceData = prices[symbol];
              const bid = priceData?.bid_price;
              const ask = priceData?.ask_price;
              const spread = bid && ask ? (ask - bid).toFixed(2) : null;

              return (
                <div
                  key={symbol}
                  className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <h4 className="text-lg font-semibold text-slate-800 mb-3">
                    {symbol}
                  </h4>
                  
                  {priceData ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Bid:</span>
                        <span className="font-mono font-semibold text-red-600">
                          {bid?.toFixed(2) ?? "N/A"}
                        </span>
                        {priceData.bid_size && (
                          <span className="text-slate-500 text-sm">
                            ({priceData.bid_size})
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Ask:</span>
                        <span className="font-mono font-semibold text-green-600">
                          {ask?.toFixed(2) ?? "N/A"}
                        </span>
                        {priceData.ask_size && (
                          <span className="text-slate-500 text-sm">
                            ({priceData.ask_size})
                          </span>
                        )}
                      </div>
                      {spread && (
                        <div className="flex justify-between pt-2 border-t border-slate-200">
                          <span className="text-slate-600">Spread:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {spread}
                          </span>
                        </div>
                      )}
                      <div className="text-xs text-slate-400 mt-2">
                        Last update: {priceData.received_at ? new Date(priceData.received_at!).toLocaleTimeString() : "N/A"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400">Waiting for data...</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Debug Mode - Show Raw JSON */}
      {isConnected && Object.keys(prices).length > 0 && (
        <details className="bg-slate-50 rounded-lg p-4">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Debug: Raw JSON Data
          </summary>
          <pre className="mt-4 text-xs overflow-auto max-h-96 bg-slate-900 text-slate-100 p-4 rounded">
            {JSON.stringify(prices, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

export default SymbolsMonitor;
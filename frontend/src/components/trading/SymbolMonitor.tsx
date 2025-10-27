import { useEffect, useState, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries } from "lightweight-charts";
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

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface TickData {
  time: number;
  price: number;
}

const SymbolsMonitor = () => {
  const [symbolInput, setSymbolInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [tickHistory, setTickHistory] = useState<Record<string, TickData[]>>({});
  const [candleHistory, setCandleHistory] = useState<Record<string, CandleData[]>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const chartRefs = useRef<Record<string, { chart: IChartApi; candleSeries: ISeriesApi<any> }>>({});

  // Aggregate ticks into 1-minute candles
  const aggregateTicksToCandles = (ticks: TickData[]): CandleData[] => {
    if (ticks.length === 0) return [];

    const candleMap = new Map<number, CandleData>();

    ticks.forEach(tick => {
      // Round down to the minute (1-minute candles)
      const candleTime = Math.floor(tick.time / 60) * 60;
      
      if (!candleMap.has(candleTime)) {
        // Initialize candle with first tick as open
        candleMap.set(candleTime, {
          time: candleTime,
          open: tick.price,
          high: tick.price,
          low: tick.price,
          close: tick.price
        });
      } else {
        // Update existing candle
        const candle = candleMap.get(candleTime)!;
        candle.high = Math.max(candle.high, tick.price);
        candle.low = Math.min(candle.low, tick.price);
        candle.close = tick.price; // Last price becomes close
      }
    });

    // Convert map to array and sort by time
    return Array.from(candleMap.values()).sort((a, b) => a.time - b.time);
  };

  const handleConnect = async () => {
    if (!symbolInput.trim()) {
      alert("Please enter at least one symbol");
      return;
    }

    // Parse comma-separated symbols
    const symbolList = symbolInput
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

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
          // Ensure bid_price and ask_price are valid numbers (not null, undefined, or NaN)
          if (data.symbol && 
              data.bid_price != null && !isNaN(data.bid_price) && 
              data.ask_price != null && !isNaN(data.ask_price)) {
            const symbol = data.symbol;
            const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
            
            setPrices((prev: Record<string, PriceData>) => ({ ...prev, [symbol]: data }));
            
            // Add tick to history and create candles
            const midPrice = (Number(data.bid_price) + Number(data.ask_price)) / 2;
            const tick: TickData = { time: now, price: midPrice };
            
            setTickHistory((prev: Record<string, TickData[]>) => {
              const currentTicks = prev[symbol] || [];
              const updatedTicks = [...currentTicks, tick];
              // Keep last 1000 ticks for aggregation
              const limitedTicks = updatedTicks.slice(-1000);
              
              // Aggregate ticks into candles
              const candles = aggregateTicksToCandles(limitedTicks);
              // Keep last 50 candles
              const limitedCandles = candles.slice(-50);
              
              // Update candle history
              setCandleHistory((candlePrev: Record<string, CandleData[]>) => ({
                ...candlePrev,
                [symbol]: limitedCandles
              }));
              
              // Update chart if it exists
              const chartData = chartRefs.current[symbol];
              if (chartData && limitedCandles.length > 0) {
                try {
                  // Filter valid candles only
                  const validCandles = limitedCandles
                    .filter(c => 
                      c.open != null && !isNaN(c.open) && isFinite(c.open) &&
                      c.high != null && !isNaN(c.high) && isFinite(c.high) &&
                      c.low != null && !isNaN(c.low) && isFinite(c.low) &&
                      c.close != null && !isNaN(c.close) && isFinite(c.close) &&
                      c.time != null && !isNaN(c.time) && isFinite(c.time)
                    )
                    .map(c => ({
                      time: c.time,
                      open: Number(c.open),
                      high: Number(c.high),
                      low: Number(c.low),
                      close: Number(c.close)
                    }));
                  
                  if (validCandles.length > 0) {
                    chartData.candleSeries.setData(validCandles);
                  }
                } catch (error) {
                  console.error(`Error setting candle data for ${symbol}:`, error);
                }
              }
              
              return { ...prev, [symbol]: limitedTicks };
            });
          }
        } catch (error) {
          console.error("Error parsing SSE data:", error);
        }
      };

      es.onerror = (error: Event) => {
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
    
    // Clean up all charts
    Object.values(chartRefs.current).forEach(({ chart }) => {
      chart.remove();
    });
    chartRefs.current = {};
    
    setIsConnected(false);
    setConnectionStatus("Disconnected");
    setPrices({});
    setTickHistory({});
    setCandleHistory({});
    setSymbols([]);
  };

  const initializeChart = (symbol: string, container: HTMLDivElement) => {
    if (chartRefs.current[symbol]) {
      return; // Chart already initialized
    }

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'white' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#e0e0e0' },
        horzLines: { color: '#e0e0e0' },
      },
      width: container.clientWidth,
      height: 300,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickVisible: true,
      title: symbol,
    });

    chartRefs.current[symbol] = { chart, candleSeries };

    // Set initial candle data if available
    const history = candleHistory[symbol] || [];
    if (history.length > 0) {
      try {
        const validCandles = history
          .filter((c: CandleData) => 
            c.open != null && !isNaN(c.open) && isFinite(c.open) &&
            c.high != null && !isNaN(c.high) && isFinite(c.high) &&
            c.low != null && !isNaN(c.low) && isFinite(c.low) &&
            c.close != null && !isNaN(c.close) && isFinite(c.close) &&
            c.time != null && !isNaN(c.time) && isFinite(c.time)
          )
          .map((c: CandleData) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          }));
        
        if (validCandles.length > 0) {
          candleSeries.setData(validCandles);
        }
      } catch (error) {
        console.error(`Error setting initial candle data for ${symbol}:`, error);
      }
    }

    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      chart.applyOptions({
        width: container.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSymbolInput(e.target.value)}
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
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Live Prices</h3>
          
          {symbols.map((symbol: string) => {
            const priceData = prices[symbol];
            const bid = priceData?.bid_price;
            const ask = priceData?.ask_price;
            const spread = bid && ask ? (ask - bid).toFixed(2) : null;
            const candles = candleHistory[symbol] || [];

            return (
              <div
                key={symbol}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h4 className="text-lg font-semibold text-slate-800 mb-3">
                  {symbol}
                </h4>
                
                {priceData ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Bid:</span>
                        <div className="text-right">
                          <span className="font-mono font-semibold text-red-600 block">
                            {bid?.toFixed(2) ?? "N/A"}
                          </span>
                          {priceData.bid_size && (
                            <span className="text-slate-500 text-xs">
                              ({priceData.bid_size})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Ask:</span>
                        <div className="text-right">
                          <span className="font-mono font-semibold text-green-600 block">
                            {ask?.toFixed(2) ?? "N/A"}
                          </span>
                          {priceData.ask_size && (
                            <span className="text-slate-500 text-xs">
                              ({priceData.ask_size})
                            </span>
                          )}
                        </div>
                      </div>
                      {spread && (
                        <div className="flex justify-between items-center col-span-2 pt-2 border-t border-slate-200">
                          <span className="text-slate-600">Spread:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {spread}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Chart */}
                    {candles.length > 0 && (
                      <div className="mt-4">
                        <div
                          ref={(el: HTMLDivElement | null) => {
                            if (el && !chartRefs.current[symbol]) {
                              initializeChart(symbol, el);
                            }
                          }}
                          className="w-full rounded-lg overflow-hidden"
                        />
                        <div className="text-xs text-slate-400 mt-2">
                          Candles: {candles.length} | Last update: {priceData.received_at ? new Date(priceData.received_at!).toLocaleTimeString() : "N/A"}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-slate-400">Waiting for data...</div>
                )}
              </div>
            );
          })}
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
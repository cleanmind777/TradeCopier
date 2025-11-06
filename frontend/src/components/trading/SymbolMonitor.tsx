import { useEffect, useState, useRef } from "react";
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries } from "lightweight-charts";
import Button from "../ui/Button";
import { getHistoricalChart } from "../../api/databentoApi";

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


interface OHLCVData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SymbolsMonitorProps {
  initialSymbol?: string;
  compact?: boolean;
  height?: number; // height in px for compact mode
}

const SymbolsMonitor: React.FC<SymbolsMonitorProps> = ({ initialSymbol = "", compact = false, height = 600 }) => {
  const [symbolInput, setSymbolInput] = useState(initialSymbol);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [ohlcvHistory, setOhlcvHistory] = useState<Record<string, OHLCVData[]>>({});
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '30m' | '45m' | '1h' | '12h' | '1d'>('1m');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);
  const chartRefs = useRef<Record<string, { chart: IChartApi; candleSeries: ISeriesApi<any> }>>({});
  const prevSymbolRef = useRef<string>("");

  // Sync symbolInput with initialSymbol prop
  useEffect(() => {
    setSymbolInput(initialSymbol);
  }, [initialSymbol]);

  // In compact mode, handle symbol changes: disconnect if connected, then connect with new symbol to load historical data
  useEffect(() => {
    if (!compact || !symbolInput) return;

    // Only reconnect if the symbol actually changed
    if (prevSymbolRef.current === symbolInput) {
      // Symbol hasn't changed, skip reconnection unless not connected
      if (!isConnected && !isConnecting) {
        handleConnect();
      }
      return;
    }

    // Symbol changed - update ref
    prevSymbolRef.current = symbolInput;

    // If already connected or connecting, disconnect first to clean up
    if (isConnected || isConnecting) {
      handleDisconnect();
      // Wait a bit for cleanup to complete, then connect with new symbol
      const timeoutId = setTimeout(() => {
        handleConnect();
      }, 150);
      return () => clearTimeout(timeoutId);
    } else {
      // Not connected yet, just connect directly
      handleConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolInput, compact]);

  // Helper function to get current minute timestamp
  const getCurrentMinuteTimestamp = (): number => {
    const now = new Date();
    now.setSeconds(0, 0); // Reset seconds and milliseconds
    return Math.floor(now.getTime() / 1000);
  };

  // Helper function to get timeframe in minutes
  const getTimeframeMinutes = (tf: typeof timeframe): number => {
    switch (tf) {
      case '1m': return 1;
      case '5m': return 5;
      case '15m': return 15;
      case '30m': return 30;
      case '45m': return 45;
      case '1h': return 60;
      case '12h': return 12 * 60;
      case '1d': return 24 * 60;
    }
  };

  // Aggregate 1-minute OHLCV data to higher timeframes
  const aggregateToTimeframe = (oneMinuteData: OHLCVData[], targetTimeframe: typeof timeframe): OHLCVData[] => {
    if (targetTimeframe === '1m' || oneMinuteData.length === 0) {
      return oneMinuteData;
    }

    const timeframeMinutes = getTimeframeMinutes(targetTimeframe);
    const aggregatedMap = new Map<number, OHLCVData>();

    oneMinuteData.forEach(candle => {
      // Calculate the bucket time for the target timeframe
      const bucketTime = Math.floor(candle.time / (timeframeMinutes * 60)) * (timeframeMinutes * 60);
      
      if (!aggregatedMap.has(bucketTime)) {
        // Create new aggregated candle
        aggregatedMap.set(bucketTime, {
          time: bucketTime,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        });
      } else {
        // Update existing aggregated candle
        const existing = aggregatedMap.get(bucketTime)!;
        existing.high = Math.max(existing.high, candle.high);
        existing.low = Math.min(existing.low, candle.low);
        existing.close = candle.close; // Last candle's close becomes the close
        existing.volume += candle.volume;
      }
    });

    // Convert map to array and sort by time
    return Array.from(aggregatedMap.values()).sort((a, b) => a.time - b.time);
  };

  // Update OHLCV data for current minute
  const updateCurrentMinuteData = (symbol: string, price: number) => {
    const currentMinute = getCurrentMinuteTimestamp();
    
    setOhlcvHistory(prevHistory => {
      const history = prevHistory[symbol] || [];
      const lastCandle = history[history.length - 1];
      
      // Check if we need to create a new candle (new minute)
      if (!lastCandle || lastCandle.time !== currentMinute) {
        // Create new candle for current minute
        const newCandle: OHLCVData = {
          time: currentMinute,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: 1
        };
        
        const updatedHistory = [...history, newCandle].slice(-1000); // Keep last 1000 candles
        return { ...prevHistory, [symbol]: updatedHistory };
      } else {
        // Update existing candle for current minute
        const updatedCandle: OHLCVData = {
          ...lastCandle,
          high: Math.max(lastCandle.high, price),
          low: Math.min(lastCandle.low, price),
          close: price,
          volume: lastCandle.volume + 1
        };
        
        const updatedHistory = [...history.slice(0, -1), updatedCandle];
        return { ...prevHistory, [symbol]: updatedHistory };
      }
    });
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
    setConnectionStatus("Loading historical data...");

    try {
      // Load historical data for each symbol
      const now = new Date();
      // Ensure end is at least 2 minutes ago to avoid real-time data issues
      const endTime = new Date(now.getTime() - 2 * 60 * 1000);
      // Start is 24 hours before end
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
      
      const start = startTime.toISOString();
      const end = endTime.toISOString();
      
      console.log(`📊 Loading historical data for ${symbolList.length} symbols`);
      console.log(`📅 Time range: ${start} to ${end}`);
      
      for (const symbol of symbolList) {
        try {
          const historicalData = await getHistoricalChart(symbol, start, end, "ohlcv-1m");
          
          if (historicalData && historicalData.data) {
            console.log(`✅ Loaded ${historicalData.data.length} historical candles for ${symbol}`);
            
            // Convert historical data to OHLCVData format
            const historicalOhlcv = historicalData.data.map(candle => ({
              time: Math.floor(new Date(candle.timestamp).getTime() / 1000),
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume
            }));
            
            // Add to existing OHLCV history
            setOhlcvHistory(prev => ({
              ...prev,
              [symbol]: historicalOhlcv
            }));
          }
        } catch (error) {
          console.error(`❌ Failed to load historical data for ${symbol}:`, error);
        }
      }
      
      // Check market status; if closed, show historical only and skip SSE
      try {
        const statusRes = await fetch(`${API_BASE}/databento/market-status?symbols=${encodeURIComponent(symbolList.join(","))}`);
        const statusJson = await statusRes.json();
        if (statusJson && statusJson.open === false) {
          setSymbols(symbolList);
          setIsConnecting(false);
          setIsConnected(false);
          setConnectionStatus("Market closed - showing historical data");
          return;
        }
      } catch {}

      // Now subscribe to real-time data
      setConnectionStatus("Connecting to real-time stream...");
      try {
        const response = await fetch(`${API_BASE}/databento/sse/current-price`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols: symbolList }),
        });
        if (!response.ok) {
          throw new Error("Failed to subscribe to symbols");
        }
      } catch {}

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
          if (data.status === "market_closed") {
            setConnectionStatus("Market closed - showing historical data");
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }
            setIsConnected(false);
            return;
          }

          // Update prices with the received data
          // Ensure bid_price and ask_price are valid numbers (not null, undefined, or NaN)
          if (data.symbol && 
              data.bid_price != null && !isNaN(data.bid_price) && 
              data.ask_price != null && !isNaN(data.ask_price)) {
            const symbol = data.symbol;
            
            setPrices((prev: Record<string, PriceData>) => ({ ...prev, [symbol]: data }));
            
            // Update OHLCV data for current minute
            const midPrice = (Number(data.bid_price) + Number(data.ask_price)) / 2;
            updateCurrentMinuteData(symbol, midPrice);
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
    setOhlcvHistory({});
    setSymbols([]);
  };

  const initializeChart = (symbol: string, container: HTMLDivElement) => {
    if (chartRefs.current[symbol]) {
      return; // Chart already initialized
    }

    console.log(`Initializing chart for ${symbol}`, container.clientWidth, container.clientHeight);

    // Use container height if height prop is undefined, otherwise use the prop or default
    const chartHeight = compact 
      ? (height !== undefined ? height : container.clientHeight || 400)
      : 300;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: compact ? '#0f172a' : 'white' },
        textColor: compact ? '#e2e8f0' : '#333',
      },
      grid: {
        vertLines: { color: compact ? '#1f2937' : '#e0e0e0' },
        horzLines: { color: compact ? '#1f2937' : '#e0e0e0' },
      },
      width: container.clientWidth,
      height: chartHeight,
      crosshair: {
        mode: 1, // Normal crosshair mode
      },
      rightPriceScale: {
        borderColor: compact ? '#334155' : '#d1d4dc',
        visible: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: compact ? '#334155' : '#d1d4dc',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: false,
        shiftVisibleRangeOnNewBar: false,
      },
    });

    // Configure custom time format for axis ticks and crosshair (dd:hh:mm)
    const formatTick = (t: any) => {
      let date: Date;
      if (typeof t === 'number') {
        date = new Date(t * 1000);
      } else if (t && typeof t === 'object' && 'year' in t) {
        // Business day format
        const year = (t as any).year;
        const month = ((t as any).month ?? 1) - 1;
        const day = (t as any).day ?? 1;
        date = new Date(Date.UTC(year, month, day));
      } else {
        date = new Date();
      }
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const hh = String(date.getUTCHours()).padStart(2, '0');
      const mm = String(date.getUTCMinutes()).padStart(2, '0');
      return `${dd}:${hh}:${mm}`;
    };

    chart.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: any) => formatTick(time),
      } as any,
      localization: {
        timeFormatter: (time: any) => formatTick(time),
      } as any,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: compact ? '#22c55e' : '#26a69a',
      downColor: compact ? '#ef4444' : '#ef5350',
      borderVisible: false,
      wickVisible: true,
      title: symbol,
      priceScaleId: 'right',
    });

    chartRefs.current[symbol] = { chart, candleSeries };

    // Set initial OHLCV data if available
    const oneMinuteData = ohlcvHistory[symbol] || [];
    const aggregatedData = aggregateToTimeframe(oneMinuteData, timeframe);
    console.log(`Initial chart setup for ${symbol}:`, oneMinuteData.length, '1m candles, aggregated to', aggregatedData.length, `${timeframe} candles`);
    if (aggregatedData.length > 0) {
      try {
        const validCandles = aggregatedData
          .filter((c: OHLCVData) => 
            c.open != null && !isNaN(c.open) && isFinite(c.open) &&
            c.high != null && !isNaN(c.high) && isFinite(c.high) &&
            c.low != null && !isNaN(c.low) && isFinite(c.low) &&
            c.close != null && !isNaN(c.close) && isFinite(c.close) &&
            c.time != null && !isNaN(c.time) && isFinite(c.time)
          )
          .map((c: OHLCVData) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          }));
        
        if (validCandles.length > 0) {
          console.log(`Setting initial ${validCandles.length} ${timeframe} candles for ${symbol}`);
          candleSeries.setData(validCandles as any);
        } else {
          console.log(`No valid ${timeframe} candles for ${symbol}`);
        }
      } catch (error) {
        console.error(`Error setting initial ${timeframe} candle data for ${symbol}:`, error);
      }
    } else {
      console.log(`No initial ${timeframe} candles for ${symbol}, will update when data arrives`);
    }

    // Configure axes to improve visibility and responsiveness
    chart.timeScale().applyOptions({
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 10,
      barSpacing: 3,
      fixLeftEdge: false,
      fixRightEdge: false,
      lockVisibleTimeRangeOnResize: false,
      rightBarStaysOnScroll: false,
      shiftVisibleRangeOnNewBar: false,
    });
    chart.priceScale('right').applyOptions({
      borderVisible: true,
      entireTextOnly: false,
      visible: true,
      alignLabels: true,
      autoScale: true,
      mode: 0,
    } as any);

    // Don't auto-fit content initially - let user control zoom
    // chart.timeScale().fitContent();

    // Handle resize - use ResizeObserver for more accurate container size tracking
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: containerHeight } = entry.contentRect;
        if (width > 0) {
          const safeHeight = containerHeight > 0 ? containerHeight : (height !== undefined ? height : 400);
          const newHeight = compact 
            ? (height !== undefined ? height : safeHeight)
            : 300;
          chart.applyOptions({
            width,
            height: newHeight,
          });
        }
      }
    });

    resizeObserver.observe(container);

    // Also handle window resize as fallback
    const handleResize = () => {
      if (container.clientWidth > 0) {
        chart.applyOptions({
          width: container.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
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

  // Update charts when OHLCV data or timeframe changes
  useEffect(() => {
    if (!isConnected || symbols.length === 0) return;

    console.log(`📈 Updating charts with ${timeframe} timeframe`);
    
    symbols.forEach((symbol) => {
      const oneMinuteData = ohlcvHistory[symbol] || [];
      const aggregatedData = aggregateToTimeframe(oneMinuteData, timeframe);
      
      const chartData = chartRefs.current[symbol];
      if (chartData && aggregatedData.length > 0) {
        const validCandles = aggregatedData
          .filter((c: OHLCVData) => 
            c.open != null && !isNaN(c.open) && isFinite(c.open) &&
            c.high != null && !isNaN(c.high) && isFinite(c.high) &&
            c.low != null && !isNaN(c.low) && isFinite(c.low) &&
            c.close != null && !isNaN(c.close) && isFinite(c.close) &&
            c.time != null && !isNaN(c.time) && isFinite(c.time)
          )
          .map((c: OHLCVData) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close)
          }));

        console.log(`📊 Rendering ${validCandles.length} ${timeframe} candles for ${symbol}`);
        // Update the series with new data
        chartData.candleSeries.setData((validCandles as any) || []);
      }
    });
  }, [ohlcvHistory, symbols, isConnected, timeframe]);


  return (
    <div className={compact ? "w-full h-full" : "p-6 space-y-6"}>
      {!compact && (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Symbol Monitor</h2>
        
        {/* Connect/Disconnect Controls */}
        {!isConnected && symbolInput && (
          <div className="mb-4">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !symbolInput.trim()}
              isLoading={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Connect to Monitor"}
            </Button>
          </div>
        )}

        {isConnected && (
          <div className="mb-4">
            <Button onClick={handleDisconnect} variant="outline">
              Disconnect
            </Button>
          </div>
        )}

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
      )}

      {/* Price Display */}
      {symbols.length > 0 && (
        <div className={compact ? "w-full h-full flex flex-col min-h-0" : "bg-white rounded-lg shadow-md p-6 space-y-6"}>
          <div className={`flex items-center justify-between ${compact ? "mb-2 flex-shrink-0" : "mb-4"}`}>
            {!compact && <h3 className="text-xl font-bold text-slate-800">Live Prices</h3>}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={compact ? "text-xs text-slate-300" : "text-sm text-slate-600"}>Timeframe:</span>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as any)}
                  className={compact ? "border border-slate-600 bg-slate-800 text-slate-100 rounded px-2 py-1 text-xs" : "border border-slate-300 rounded px-2 py-1 text-sm"}
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="45m">45m</option>
                  <option value="1h">1h</option>
                  <option value="12h">12h</option>
                  <option value="1d">1d</option>
                </select>
              </div>
              {!compact && (<div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Chart Controls:</span>
                <button
                  onClick={() => {
                    Object.values(chartRefs.current).forEach(({ chart }) => {
                      chart.timeScale().fitContent();
                    });
                  }}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Fit All
                </button>
                <button
                  onClick={() => {
                    Object.values(chartRefs.current).forEach(({ chart }) => {
                      chart.timeScale().scrollToPosition(0, false);
                    });
                  }}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Reset View
                </button>
              </div>)}
            </div>
          </div>
          
          {symbols.map((symbol: string) => {
            const priceData = prices[symbol];
            const bid = priceData?.bid_price;
            const ask = priceData?.ask_price;
            const spread = bid && ask ? (ask - bid).toFixed(2) : null;
            const oneMinuteData = ohlcvHistory[symbol] || [];
            const aggregatedData = aggregateToTimeframe(oneMinuteData, timeframe);

            return (
              <div
                key={symbol}
                className={compact ? "w-full h-full flex flex-col min-h-0 flex-1" : "border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"}
              >
                {!compact && (
                  <h4 className="text-lg font-semibold text-slate-800 mb-3">
                    {symbol}
                  </h4>
                )}
                
                {(priceData || aggregatedData.length > 0) ? (
                  <div className="space-y-4">
                    {!compact && (<div className="grid grid-cols-2 gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-600">Bid:</span>
                        <div className="text-right">
                          <span className="font-mono font-semibold text-red-600 block">
                            {bid?.toFixed(2) ?? "N/A"}
                          </span>
                          {priceData?.bid_size && (
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
                          {priceData?.ask_size && (
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
                    </div>)}

                    {/* Chart */}
                    <div className={compact ? "flex-1 min-h-0 flex flex-col" : "mt-4"}>
                      <div
                        ref={(el: HTMLDivElement | null) => {
                          if (el && !chartRefs.current[symbol]) {
                            initializeChart(symbol, el);
                          }
                        }}
                        className={compact ? (height !== undefined ? "w-full overflow-hidden rounded-md" : "w-full h-full flex-1 min-h-0 overflow-hidden rounded-md") : "w-full h-[300px] rounded-lg overflow-hidden"}
                        style={compact && height !== undefined ? { height: `${height}px` } : undefined}
                      />
                      {!compact && (
                        <div className="text-xs text-slate-400 mt-2">
                          {timeframe} Candles: {aggregatedData.length} | 1m Base: {oneMinuteData.length} | Last update: {priceData?.received_at ? new Date(priceData.received_at!).toLocaleTimeString() : "Historical"}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={compact ? "text-slate-300" : "text-slate-400"}>Waiting for data...</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Debug Mode - Show Raw JSON */}
      {!compact && isConnected && Object.keys(prices).length > 0 && (
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
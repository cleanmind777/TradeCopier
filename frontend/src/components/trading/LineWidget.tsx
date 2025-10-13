import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

interface LineWidgetProps {
  symbol: string;
}

const LineWidget: React.FC<LineWidgetProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<any>(null);
  const [series, setSeries] = useState<any>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartInstance = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: {
          color: '#eee',
        },
        horzLines: {
          color: '#eee',
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#ccc',
      },
      timeScale: {
        borderColor: '#ccc',
      },
    });

    const lineSeries = chartInstance.addSeries({
      lineWidth: 2,
      color: '#2962FF',
    });
    setChart(chartInstance);
    setSeries(lineSeries);

    return () => {
      chartInstance.remove();
    };
  }, []);

  useEffect(() => {
    if (!symbol || !series) return;

    // Close existing WebSocket connection if any
    if (ws) {
      ws.close();
    }

    // Create new WebSocket connection
    const newWs = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`);
    
    newWs.onmessage = (event) => {
      const tradeData = JSON.parse(event.data);
      const price = parseFloat(tradeData.p);
      const time = Math.floor(tradeData.T / 1000);
      
      series.update({
        time,
        value: price,
      });
    };

    setWs(newWs);

    return () => {
      newWs.close();
    };
  }, [symbol, series]);

  return (
    <div 
      ref={chartContainerRef}
      style={{ width: '100%', height: '300px' }}
    />
  );
};

export default LineWidget;
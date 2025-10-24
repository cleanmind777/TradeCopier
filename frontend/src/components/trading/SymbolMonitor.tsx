import React, { useEffect, useState } from "react";

const SymbolsMonitor = ({ symbols }: { symbols: string[] }) => {
  const [prices, setPrices] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    // POST symbols array to server to start SSE
    const startSSE = async () => {
      const response = await fetch("https://api.dev.tc.streetagent.ai/api/v1/databento/sse/current-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols }),
      });

      if (!response.ok) {
        console.error("Failed to start SSE");
        return;
      }

      const es = new EventSource("https://api.dev.tc.streetagent.ai/api/v1/databento/sse/current-price");

      es.onmessage = (e) => {
        // For unnamed events fallback
        const data = JSON.parse(e.data);
        setPrices((prev) => ({ ...prev, [data.symbol]: data }));
      };

      // Listen to named events for each symbol to update independently
      symbols.forEach(symbol => {
        es.addEventListener(symbol, (e: MessageEvent) => {
          const data = JSON.parse(e.data);
          setPrices((prev) => ({ ...prev, [symbol]: data }));
        });
      });

      es.onerror = () => es.close();

      return () => es.close();
    };

    const closeSource = startSSE();

    return () => {
      closeSource.then((close) => close && close());
    };
  }, [symbols]);

  return (
    <div>
      {symbols.map((symbol) => (
        <div key={symbol}>
          <h4>{symbol}</h4>
          <pre>{JSON.stringify(prices[symbol], null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

export default SymbolsMonitor;
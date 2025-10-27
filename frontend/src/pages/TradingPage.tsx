import React, { useState, useEffect, useRef } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Label from "../components/ui/Label";
import SymbolsMonitor from "../components/trading/SymbolMonitor";
// import TradingViewWidget from "../components/trading/TradingViewWidget";
import {
  getWebSocketToken,
  executeLimitOrder,
  executeLimitOrderWithSLTP,
  executeMarketOrder,
} from "../api/brokerApi";
import { getGroup } from "../api/groupApi";
import { createChart, ColorType } from "lightweight-charts";
import { GroupInfo } from "../types/group";
import {
  MarketOrder,
  LimitOrder,
  LimitOrderWithSLTP,
  SLTP,
} from "../types/broker";

const TradingPage: React.FC = () => {
  const [marketData, setMarketData] = useState<{
    bid: number | null;
    ask: number | null;
    last: number | null;
    timestamp: string;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connected");
  const [candleCount, setCandleCount] = useState<number>(0);

  // Trading state
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<string>("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [isOrdering, setIsOrdering] = useState<boolean>(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [symbol, setSymbol] = useState<string>("");

  // SL/TP state
  const [slTpOption, setSlTpOption] = useState<
    "none" | "default1" | "default2" | "custom"
  >("none");
  const [customSL, setCustomSL] = useState<string>("");
  const [customTP, setCustomTP] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  // Lightweight Charts refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null); // Using any to avoid complex type issues
  const lineSeriesRef = useRef<any>(null); // Using any to avoid complex type issues
  const lastUpdateTimeRef = useRef<number>(0); // Track last update time

  // Load user groups
  const loadGroups = async () => {
    if (!user_id) return;
    try {
      const userGroups = await getGroup(user_id);
      setGroups(userGroups);
      if (userGroups.length > 0) {
        setSelectedGroup(userGroups[0]);
      }
    } catch (error) {
      console.error("Error loading groups:", error);
    }
  };

  // Execute buy/sell order directly via WebSocket
  const executeOrder = async (action: "Buy" | "Sell") => {
    if (
      !selectedGroup
    ) {
      alert("Please select a group");
      return;
    }

    if (!orderQuantity || parseInt(orderQuantity) <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    if (orderType === "limit" && (!limitPrice || parseFloat(limitPrice) <= 0)) {
      alert("Please enter a valid limit price");
      return;
    }

    // Validate SL/TP if custom values are selected
    if (slTpOption === "custom" && (!customSL || parseFloat(customSL) <= 0)) {
      alert("Please enter a valid stop loss value");
      return;
    }
    if (slTpOption === "custom" && (!customTP || parseFloat(customTP) <= 0)) {
      alert("Please enter a valid take profit value");
      return;
    }

    setIsOrdering(true);

    try {
      // Prepare order data for each sub-broker in the group
      // const orders = selectedGroup.sub_brokers.map((subBroker) => {
      //   const orderData = {
      //     accountId: parseInt(subBroker.sub_account_id), // Using the sub-broker ID as account ID
      //     action: action,
      //     symbol: "3267313", // Using the same symbol as in market data
      //     orderQty: parseInt(orderQuantity) * subBroker.qty,
      //     orderType: orderType === "market" ? "Market" : "Limit",
      //     isAutomated: false,
      //     ...(orderType === "limit" && { price: parseFloat(limitPrice) }),
      //   };
      //   return orderData;
      // });
      let slValue = 0;
      let tpValue = 0;

      switch (slTpOption) {
        case "none":
          slValue = 0;
          tpValue = 0;
          break;
        case "default1":
          slValue = 10;
          tpValue = 10;
          break;
        case "default2":
          slValue = 20;
          tpValue = 20;
          break;
        case "custom":
          slValue = parseFloat(customSL);
          tpValue = parseFloat(customTP);
          break;
      }
      if (orderType === "market") {
        const order: MarketOrder = {
          group_id: selectedGroup.id,
          user_id: user_id,
          symbol: symbol,
          quantity: parseInt(orderQuantity),
          action: action,
        };
        const response = await executeMarketOrder(order);
        console.log("Market Order: ", response);
      }
      if (orderType === "limit") {
        if (slValue == 0 && tpValue == 0) {
          const order: LimitOrder = {
            group_id: selectedGroup.id,
            user_id: user_id,
            symbol: symbol,
            quantity: parseInt(orderQuantity),
            action: action,
            price: parseFloat(limitPrice),
          };
          const response = await executeLimitOrder(order);
          console.log("Limit Order: ", response);
        }
        else {
          const order: LimitOrderWithSLTP = {
            group_id: selectedGroup.id,
            user_id: user_id,
            symbol: symbol,
            quantity: parseInt(orderQuantity),
            action: action,
            price: parseFloat(limitPrice),
            sltp: {
              sl: slValue,
              tp: tpValue
            }
          };
          const response = await executeLimitOrderWithSLTP(order);
          console.log("Limit Order: ", response);
        }
      }
      // Calculate SL/TP values

      // Send orders via WebSocket using Tradovate's startOrderStrategy
      // Format: command\nid\n\n{json_data}
      // const orderMessage = `order/startOrderStrategy\n${Date.now()}\n\n${JSON.stringify(
      //   {
      //     orders: orders,
      //     sl: slValue,
      //     tp: tpValue,
      //   }
      // )}`;

      // console.log("Sending order via WebSocket:", orderMessage);
      // wsRef.current.send(orderMessage);

      // Add to order history
      const orderRecord = {
        id: Date.now(),
        action,
        quantity: orderQuantity,
        orderType,
        limitPrice: orderType === "limit" ? limitPrice : null,
        groupName: selectedGroup.name,
        subBrokers: selectedGroup.sub_brokers.length,
        timestamp: new Date().toISOString(),
        status: "Pending",
        sl: slValue,
        tp: tpValue,
      };

      setOrderHistory((prev) => [orderRecord, ...prev]);

      // Reset form
      setOrderQuantity("1");
      setLimitPrice("");
      setOrderType("market");

      alert(
        `Order submitted for ${action} ${orderQuantity} contracts across ${selectedGroup.sub_brokers.length} sub-brokers`
      );
    } catch (error) {
      console.error("Error executing order:", error);
      alert("Error executing order. Please try again.");
    } finally {
      setIsOrdering(false);
    }
  };

  // const sendHeartbeatIfNeeded = () => {
  //   if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

  //   try {
  //     wsRef.current.send("[]");
  //   } catch (error) {
  //     console.error("Heartbeat send error:", error);
  //     reconnectWebSocket();
  //   }

  //   heartbeatTimerRef.current = setTimeout(sendHeartbeatIfNeeded, 2500);
  // };

  // const subscribeToQuotes = () => {
  //   if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

  //   try {
  //     const subscribeMsg = `md/subscribeQuote\n2\n\n${JSON.stringify({
  //       symbol: "3267313",
  //     })}`;
  //     wsRef.current.send(subscribeMsg);
  //   } catch (error) {
  //     console.error("Subscription error:", error);
  //     reconnectWebSocket();
  //   }
  // };

  // const handleWebSocketMessage = (message: MessageEvent) => {
  //   const data = message.data as string;
  //   if (data.length === 0) return;

  //   const frameType = data[0];
  //   if (frameType === "a") {
  //     try {
  //       const parsedData = JSON.parse(data.substring(1));
  //       parsedData.forEach((item: any) => {
  //         if (item.s !== undefined && item.i !== undefined) {
  //           if (item.i === 1 && item.s === 200) {
  //             setConnectionStatus("Connected");
  //             subscribeToQuotes();
  //           }
  //         } else if (item.e === "md") {
  //           if (item.d && item.d.quotes) {
  //             const quote = item.d.quotes[0];
  //             const entries = quote.entries || {};
  //             const bidData = entries.Bid || {};
  //             const askData = entries.Offer || {};
  //             const tradeData = entries.Trade || {};

  //             const newMarketData = {
  //               bid: bidData.price || null,
  //               ask: askData.price || null,
  //               last: tradeData.price || null,
  //               timestamp: quote.timestamp || "N/A",
  //             };

  //             console.log("Received market data:", newMarketData);
  //             setMarketData(newMarketData);

  //             // Use last price if available, otherwise use mid-price (bid+ask)/2, or fallback to bid or ask
  //             let price = newMarketData.last;
  //             if (!price && newMarketData.bid && newMarketData.ask) {
  //               price = (newMarketData.bid + newMarketData.ask) / 2;
  //               console.log("Using mid-price:", price);
  //             } else if (!price && newMarketData.bid) {
  //               price = newMarketData.bid;
  //               console.log("Using bid price:", price);
  //             } else if (!price && newMarketData.ask) {
  //               price = newMarketData.ask;
  //               console.log("Using ask price:", price);
  //             }

  //             // Update line chart with available price
  //             if (price && lineSeriesRef.current) {
  //               const currentTime = Math.floor(Date.now() / 1000);

  //               // Only update if at least 2 seconds have passed since last update
  //               // This prevents too many data points and keeps the chart smooth
  //               if (currentTime >= lastUpdateTimeRef.current + 2) {
  //                 lastUpdateTimeRef.current = currentTime;

  //                 // Create data point for line chart
  //                 const dataPoint = {
  //                   time: currentTime,
  //                   value: price,
  //                 };

  //                 // Update the chart
  //                 try {
  //                   lineSeriesRef.current.update(dataPoint);
  //                   setCandleCount((prev) => prev + 1);
  //                   console.log("Chart updated with price:", dataPoint);

  //                   // Auto-scale only on first few updates
  //                   if (candleCount < 5 && chartRef.current) {
  //                     chartRef.current.timeScale().fitContent();
  //                   }
  //                 } catch (error) {
  //                   console.error("Error updating chart:", error);
  //                 }
  //               }
  //             }
  //           }
  //         } else if (item.e === "order") {
  //           // Handle order responses
  //           console.log("Order response received:", item);
  //           if (item.d && item.d.orderId) {
  //             // Update order history with response
  //             setOrderHistory((prev) =>
  //               prev.map((order) =>
  //                 order.id === item.d.orderId
  //                   ? { ...order, status: item.d.status || "Executed" }
  //                   : order
  //               )
  //             );
  //           }
  //         }
  //       });
  //     } catch (error) {
  //       console.error("Error parsing WebSocket message:", error);
  //     }
  //   } else if (frameType === "h") {
  //     if (wsRef.current?.readyState === WebSocket.OPEN) {
  //       wsRef.current.send("[]");
  //     }
  //   }
  // };

  // const handleBeforeUnload = () => {
  //   if (wsRef.current?.readyState === WebSocket.OPEN) {
  //     wsRef.current.close(1000, "Browser closing");
  //   }
  // };

  // const reconnectWebSocket = () => {
  //   cleanupWebSocket();
  //   initializeWebSocket();
  // };

  // const cleanupWebSocket = () => {
  //   // Remove beforeunload listener first
  //   window.removeEventListener("beforeunload", handleBeforeUnload);

  //   if (wsRef.current) {
  //     try {
  //       if (wsRef.current.readyState === WebSocket.OPEN) {
  //         wsRef.current.close(1000, "Component unmounting");
  //       }
  //       wsRef.current.onopen = null;
  //       wsRef.current.onmessage = null;
  //       wsRef.current.onerror = null;
  //       wsRef.current.onclose = null;
  //     } catch (error) {
  //       console.error("Cleanup error:", error);
  //     } finally {
  //       wsRef.current = null;
  //     }
  //   }

  //   if (heartbeatTimerRef.current) {
  //     clearTimeout(heartbeatTimerRef.current);
  //     heartbeatTimerRef.current = null;
  //   }

  //   setConnectionStatus("Disconnected");
  // };

  // const initializeWebSocket = async () => {
  //   try {
  //     setConnectionStatus("Connecting...");
  //     const token = await getWebSocketToken(user_id);
  //     if (!token?.access_token) {
  //       setConnectionStatus("Failed (No Token)");
  //       return;
  //     }

  //     const ws = new WebSocket("wss://md.tradovateapi.com/v1/websocket");
  //     wsRef.current = ws;

  //     // Add beforeunload listener for browser/tab close
  //     window.addEventListener("beforeunload", handleBeforeUnload);

  //     ws.onopen = () => {
  //       try {
  //         const authMsg = `authorize\n1\n\n${token.access_token}`;
  //         ws.send(authMsg);
  //         heartbeatTimerRef.current = setTimeout(sendHeartbeatIfNeeded, 2500);
  //       } catch (error) {
  //         console.error("WebSocket open error:", error);
  //         reconnectWebSocket();
  //       }
  //     };

  //     ws.onmessage = handleWebSocketMessage;

  //     ws.onerror = (error) => {
  //       console.error("WebSocket error:", error);
  //       setConnectionStatus("Error");
  //       reconnectWebSocket();
  //     };

  //     ws.onclose = () => {
  //       setConnectionStatus("Disconnected");
  //       if (wsRef.current === ws) {
  //         reconnectWebSocket();
  //       }
  //     };
  //   } catch (error) {
  //     console.error("Connection error:", error);
  //     setConnectionStatus("Failed");
  //     reconnectWebSocket();
  //   }
  // };

  useEffect(() => {
    // initializeWebSocket();
    loadGroups();

    // return () => {
    //   cleanupWebSocket();
    // };
  }, [user_id]);

  // Initialize lightweight chart
  // useEffect(() => {
  //   if (!chartContainerRef.current) return;

  //   // Ensure container has dimensions before creating chart
  //   const containerWidth = chartContainerRef.current.clientWidth;
  //   if (containerWidth === 0) {
  //     console.warn("Chart container has no width, delaying initialization");
  //     return;
  //   }

  //   const chart = createChart(chartContainerRef.current, {
  //     layout: {
  //       background: { type: ColorType.Solid, color: "#000000" },
  //       textColor: "#333",
  //     },
  //     width: containerWidth,
  //     height: 500,
  //     grid: {
  //       vertLines: {
  //         color: "#e1e4e8",
  //       },
  //       horzLines: {
  //         color: "#e1e4e8",
  //       },
  //     },
  //     crosshair: {
  //       mode: 1, // Normal crosshair mode
  //     },
  //     rightPriceScale: {
  //       borderColor: "#d1d4dc",
  //     },
  //     timeScale: {
  //       borderColor: "#d1d4dc",
  //       timeVisible: true,
  //       secondsVisible: true,
  //     },
  //   });

  //   // Use setTimeout to ensure chart is fully rendered before adding series
  //   const timeoutId = setTimeout(() => {
  //     try {
  //       console.log("Initializing line series...");
  //       const lineSeries = (chart as any).addLineSeries({
  //         color: "#2962FF",
  //         lineWidth: 2,
  //         priceFormat: {
  //           type: "price",
  //           precision: 2,
  //           minMove: 0.01,
  //         },
  //         crosshairMarkerVisible: true,
  //         crosshairMarkerRadius: 6,
  //         lastValueVisible: true,
  //         priceLineVisible: true,
  //       });

  //       chartRef.current = chart;
  //       lineSeriesRef.current = lineSeries;
  //       console.log("Line series created successfully");
  //     } catch (error) {
  //       console.error("Error adding line series:", error);
  //     }
  //   }, 0);

  //   // Handle resize
  //   const handleResize = () => {
  //     if (chartContainerRef.current && chartRef.current) {
  //       chartRef.current.applyOptions({
  //         width: chartContainerRef.current.clientWidth,
  //       });
  //     }
  //   };

  //   window.addEventListener("resize", handleResize);

  //   return () => {
  //     clearTimeout(timeoutId);
  //     window.removeEventListener("resize", handleResize);
  //     if (chartRef.current) {
  //       chartRef.current.remove();
  //       chartRef.current = null;
  //       lineSeriesRef.current = null;
  //     }
  //   };
  // }, []);

  return (
    <div className="flex bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Trading Dashboard</h1>
            <div
              className={`px-4 py-2 rounded-md ${
                connectionStatus === "Connected"
                  ? "bg-green-100 text-green-800"
                  : connectionStatus === "Connecting..."
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              Status: {connectionStatus}
            </div>
          </div>

          {/* Real-time Price Chart using Lightweight Charts
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
                style={{ height: "500px" }}
              />
              {candleCount === 0 && marketData && (
                <div className="text-center text-gray-500 mt-4">
                  Connecting to market data... (Bid: ${marketData.bid}, Ask: $
                  {marketData.ask}, Last: ${marketData.last || "N/A"})
                </div>
              )}
              {candleCount === 0 && !marketData && (
                <div className="text-center text-gray-500 mt-4">
                  Waiting for WebSocket connection...
                </div>
              )}
            </CardContent>
          </Card> */}

          {/* <div>
            <TradingViewWidget symbol={"NQZ2025"} />
          </div> */}
          {/* {marketData && (
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
          )} */}
          <SymbolsMonitor />
          {/* Trading Interface */}
          {/* Trading Interface */}
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Trading Interface</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Symbol Input */}
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  type="text"
                  value={symbol}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSymbol(e.target.value)
                  }
                  placeholder="Enter symbol"
                  className="w-full"
                />
              </div>

              {/* Group Selection */}
              <div className="space-y-2">
                <Label htmlFor="group-select">Select Group</Label>
                <select
                  id="group-select"
                  value={selectedGroup?.id || ""}
                  onChange={(e) => {
                    const group = groups.find((g) => g.id === e.target.value);
                    setSelectedGroup(group || null);
                  }}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={groups.length === 0}
                >
                  <option value="">
                    {groups.length === 0
                      ? "No groups available"
                      : "Select a group"}
                  </option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.sub_brokers.length} sub-brokers)
                    </option>
                  ))}
                </select>
              </div>

              {selectedGroup && (
                <>
                  {/* Group Info */}
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h3 className="font-semibold mb-2">Group Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Name:</span>{" "}
                        {selectedGroup.name}
                      </div>
                      <div>
                        <span className="text-gray-500">Sub-brokers:</span>{" "}
                        {selectedGroup.sub_brokers.length}
                      </div>
                    </div>
                  </div>

                  {/* Order Form */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Quantity */}
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={orderQuantity}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setOrderQuantity(e.target.value)
                          }
                          min="1"
                          placeholder="Enter quantity"
                        />
                      </div>

                      {/* Order Type */}
                      <div className="space-y-2">
                        <Label htmlFor="order-type">Order Type</Label>
                        <select
                          id="order-type"
                          value={orderType}
                          onChange={(e) =>
                            setOrderType(e.target.value as "market" | "limit")
                          }
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="market">Market Order</option>
                          <option value="limit">Limit Order</option>
                        </select>
                      </div>
                    </div>

                    {orderType === "limit" && (
                      <>
                        {/* Limit Price */}
                        <div className="space-y-2">
                          <Label htmlFor="limit-price">Limit Price</Label>
                          <Input
                            id="limit-price"
                            type="number"
                            step="0.01"
                            value={limitPrice}
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>
                            ) => setLimitPrice(e.target.value)}
                            placeholder="Enter limit price"
                          />
                        </div>
                        {/* SL/TP Configuration */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="sl-tp-option">
                              Stop Loss / Take Profit
                            </Label>
                            <select
                              id="sl-tp-option"
                              value={slTpOption}
                              onChange={(e) =>
                                setSlTpOption(
                                  e.target.value as
                                    | "none"
                                    | "default1"
                                    | "default2"
                                    | "custom"
                                )
                              }
                              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="none">None</option>
                              <option value="default1">
                                Default1 (SL: 10, TP: 10)
                              </option>
                              <option value="default2">
                                Default2 (SL: 20, TP: 20)
                              </option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>

                          {/* Custom SL/TP Input Fields */}
                          {slTpOption === "custom" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="custom-sl">
                                  Custom Stop Loss
                                </Label>
                                <Input
                                  id="custom-sl"
                                  type="number"
                                  step="0.01"
                                  value={customSL}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                  ) => setCustomSL(e.target.value)}
                                  placeholder="Enter SL value"
                                  min="0"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="custom-tp">
                                  Custom Take Profit
                                </Label>
                                <Input
                                  id="custom-tp"
                                  type="number"
                                  step="0.01"
                                  value={customTP}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>
                                  ) => setCustomTP(e.target.value)}
                                  placeholder="Enter TP value"
                                  min="0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                      <Button
                        onClick={() => executeOrder("Buy")}
                        disabled={isOrdering || !selectedGroup}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        {isOrdering ? "Executing..." : "BUY"}
                      </Button>
                      <Button
                        onClick={() => executeOrder("Sell")}
                        disabled={isOrdering || !selectedGroup}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      >
                        {isOrdering ? "Executing..." : "SELL"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Order History */}
          {orderHistory.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold">Order History</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {orderHistory.slice(0, 10).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            order.action === "Buy"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {order.action}
                        </span>
                        <span className="font-medium">
                          {order.quantity} contracts
                        </span>
                        <span className="text-sm text-gray-500">
                          {order.orderType}
                        </span>
                        {order.limitPrice && (
                          <span className="text-sm text-gray-500">
                            @ ${order.limitPrice}
                          </span>
                        )}
                        {order.sl > 0 && (
                          <span className="text-sm text-red-500">
                            SL: ${order.sl}
                          </span>
                        )}
                        {order.tp > 0 && (
                          <span className="text-sm text-green-500">
                            TP: ${order.tp}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          Group: {order.groupName}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            order.status === "Pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : order.status === "Executed"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {order.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(order.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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

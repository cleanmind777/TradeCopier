import React, { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import SymbolsMonitor from "../components/trading/SymbolMonitor";
// import TradingViewWidget from "../components/trading/TradingViewWidget";
import {
  executeLimitOrder,
  executeLimitOrderWithSLTP,
  executeMarketOrder,
  getAccounts,
  getPositions,
  getOrders,
  exitAllPostions,
} from "../api/brokerApi";
import { getGroup } from "../api/groupApi";
import { GroupInfo } from "../types/group";
import {
  MarketOrder,
  LimitOrder,
  LimitOrderWithSLTP,
  TradovateAccountsResponse,
  TradovatePositionListResponse,
} from "../types/broker";
import { getHistoricalChart } from "../api/databentoApi";
import LoadingModal from "../components/ui/LoadingModal";

const TradingPage: React.FC = () => {
  // Trading state
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [orderQuantity, setOrderQuantity] = useState<string>("1");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState<string>("");
  const [isOrdering, setIsOrdering] = useState<boolean>(false);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [symbol, setSymbol] = useState<string>("NQZ5");
  const [pendingSymbol, setPendingSymbol] = useState<string>("NQZ5");
  
  // PnL tracking state
  const [pnlData, setPnlData] = useState<Record<string, any>>({});
  const [isConnectedToPnL, setIsConnectedToPnL] = useState<boolean>(false);
  const [groupPnL, setGroupPnL] = useState<{
    totalPnL: number;
    symbolPnL: number;
    lastUpdate: string;
  }>({
    totalPnL: 0,
    symbolPnL: 0,
    lastUpdate: ""
  });

  // Accounts and positions for aggregates/balance
  const [accounts, setAccounts] = useState<TradovateAccountsResponse[]>([]);
  const [positions, setPositions] = useState<TradovatePositionListResponse[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [groupBalance, setGroupBalance] = useState<number>(0); // kept for future toolbar summaries
  const [groupSymbolNet, setGroupSymbolNet] = useState<{ netPos: number; avgNetPrice: number; }>({ netPos: 0, avgNetPrice: 0 });
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);

  // Real-time price data (bid, ask, last, sizes)
  const [currentPrice, setCurrentPrice] = useState<{
    bid?: number;
    ask?: number;
    last?: number;
    bidSize?: number;
    askSize?: number;
  }>({});
  const priceEventSourceRef = useRef<EventSource | null>(null);

  // Equity per sub-broker (balance + unrealizedPnL)
  const [subBrokerEquities, setSubBrokerEquities] = useState<Record<string, {
    accountId: string;
    nickname: string;
    balance: number;
    unrealizedPnL: number;
    equity: number;
  }>>({});

  // Offline PnL fallback
  const offlinePnlIntervalRef = useRef<number | null>(null);

  // SL/TP state
  const [slTpOption, setSlTpOption] = useState<
    "none" | "default1" | "default2" | "custom"
  >("none");
  const [customSL, setCustomSL] = useState<string>("");
  const [customTP, setCustomTP] = useState<string>("");

  const eventSourceRef = useRef<EventSource | null>(null);
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  // Monitor tabs
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "accounts">("positions");

  // Aggregated group-position monitoring rows by symbol for ALL groups and ALL symbols
  const groupMonitorRows = useMemo(() => {
    if (groups.length === 0 || positions.length === 0) return [] as Array<{
      groupName: string;
      symbol: string;
      openPositions: number;
      openPnL: number;
      realizedPnL: number;
      totalAccounts: number;
    }>;

    const rows: Array<{
      groupName: string;
      symbol: string;
      openPositions: number;
      openPnL: number;
      realizedPnL: number;
      totalAccounts: number;
    }> = [];

    // Loop through ALL groups
    for (const group of groups) {
      const accountIdSet = new Set(
        group.sub_brokers.map((s) => parseInt(s.sub_account_id))
      );

      // Group positions by symbol for accounts in this group
      const symbolToPositions = new Map<string, TradovatePositionListResponse[]>();
      positions
        .filter((p) => accountIdSet.has(p.accountId))
        .forEach((p) => {
          const sym = (p.symbol || "").toUpperCase();
          if (!symbolToPositions.has(sym)) symbolToPositions.set(sym, []);
          symbolToPositions.get(sym)!.push(p);
        });

      // Sum realized PnL across accounts in group
      const realizedPnLTotal = accounts
        .filter((a) => accountIdSet.has(a.accountId))
        .reduce((sum, a) => sum + (a.realizedPnL || 0), 0);

      const totalAccounts = group.sub_brokers.length;

      // For each symbol in this group
      for (const [sym, list] of symbolToPositions.entries()) {
        // Open Position: total net position (sum of netPos values)
        const totalNetPos = list.reduce((sum, p) => sum + (p.netPos || 0), 0);

        // Open PnL: sum from live pnlData if available
        let openPnLSum = 0;
        list.forEach((p) => {
          const key1 = `${p.symbol}:${p.accountId}`;
          const live = pnlData[key1];
          if (live && typeof live.unrealizedPnL === "number") {
            openPnLSum += live.unrealizedPnL;
          }
        });

        rows.push({
          groupName: group.name,
          symbol: sym,
          openPositions: totalNetPos, // Total net position for this group/symbol
          openPnL: openPnLSum,
          realizedPnL: realizedPnLTotal,
          totalAccounts,
        });
      }
    }

    // Sort by group name, then symbol for stable display
    rows.sort((a, b) => {
      if (a.groupName !== b.groupName) {
        return a.groupName.localeCompare(b.groupName);
      }
      return a.symbol.localeCompare(b.symbol);
    });
    return rows;
  }, [groups, positions, pnlData, accounts]);

  // Typing-only symbol entry (no dropdown)

  // Calculate PnL for selected group and symbol
  const calculateGroupPnL = () => {
    if (!selectedGroup) {
      setGroupPnL({
        totalPnL: 0,
        symbolPnL: 0,
        lastUpdate: ""
      });
      return;
    }

    let totalPnL = 0;
    let symbolPnL = 0;
    let lastUpdate = "";

    // Get sub-broker account IDs from selected group
    const groupAccountIds = selectedGroup.sub_brokers.map(sub => sub.sub_account_id);
    
    console.log("🔍 Calculating PnL for group:", selectedGroup.name);
    console.log("📊 Group account IDs:", groupAccountIds);
    console.log("📈 Available PnL data keys:", Object.keys(pnlData));

    // Calculate PnL for all positions in the group
    Object.values(pnlData).forEach((data: any) => {
      const accountIdStr = data.accountId?.toString();
      const accountIdNum = data.accountId;
      
      // Check if this account ID matches any in the group (handle both string and number formats)
      const isAccountInGroup = groupAccountIds.some(groupAccountId => 
        groupAccountId === accountIdStr || 
        groupAccountId === accountIdNum?.toString() ||
        parseInt(groupAccountId) === accountIdNum
      );
      
      if (isAccountInGroup) {
        const pnl = data.unrealizedPnL || 0;
        totalPnL += pnl;
        
        console.log(`💰 Account ${accountIdStr} (${data.symbol}): $${pnl}`);
        
        // If symbol matches, add to symbol-specific PnL
        if (symbol && data.symbol === symbol) {
          symbolPnL += pnl;
          console.log(`🎯 Symbol ${symbol} PnL: $${pnl}`);
        }
        
        // Track the latest update time
        if (data.timestamp && (!lastUpdate || data.timestamp > lastUpdate)) {
          lastUpdate = data.timestamp;
        }
      }
    });

    console.log(`📊 Total Group PnL: $${totalPnL}, Symbol PnL: $${symbolPnL}`);

    setGroupPnL({
      totalPnL: Math.round(totalPnL * 100) / 100, // Round to 2 decimal places
      symbolPnL: Math.round(symbolPnL * 100) / 100,
      lastUpdate: lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : ""
    });
  };

  // Helper: map symbol prefix to valuePerPoint for approximate PnL when offline
  const getValuePerPoint = (sym: string): number => {
    const s = (sym || "").toUpperCase();
    if (s.startsWith("MNQ")) return 2; // Micro NASDAQ
    if (s.startsWith("NQ")) return 20; // E-mini NASDAQ
    if (s.startsWith("MES")) return 5; // Micro S&P
    if (s.startsWith("ES")) return 50; // E-mini S&P
    if (s.startsWith("MYM")) return 0.5 * 10; // Micro YM often $0.5/tick, $5/point
    if (s.startsWith("YM")) return 5;  // E-mini Dow $5/point
    if (s.startsWith("M2K")) return 5; // Micro Russell
    if (s.startsWith("RTY")) return 50; // E-mini Russell
    if (s.startsWith("MGC")) return 10; // Micro Gold $10/point
    if (s.startsWith("GC")) return 100; // Gold $100/point
    if (s.startsWith("MCL")) return 10; // Micro Crude
    if (s.startsWith("CL")) return 1000 / 100; // $1000 per $1, treat per point ~ 1000
    return 50; // default
  };

  // Derive group total balance from accounts
  useEffect(() => {
    if (!selectedGroup || accounts.length === 0) {
      setGroupBalance(0);
      return;
    }
    const ids = new Set(selectedGroup.sub_brokers.map(s => parseInt(s.sub_account_id)));
    const total = accounts
      .filter(a => ids.has(a.accountId))
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    setGroupBalance(total);
  }, [selectedGroup, accounts]);

  // Derive group symbol aggregates (net position and avg net price)
  useEffect(() => {
    if (!selectedGroup || !symbol || positions.length === 0) {
      setGroupSymbolNet({ netPos: 0, avgNetPrice: 0 });
      return;
    }
    const ids = new Set(selectedGroup.sub_brokers.map(s => parseInt(s.sub_account_id)));
    const filtered = positions.filter(p => ids.has(p.accountId) && p.symbol?.toUpperCase().startsWith(symbol.toUpperCase().slice(0, 2)));
    const totalQty = filtered.reduce((sum, p) => sum + (p.netPos || 0), 0);
    const weightedPriceNumer = filtered.reduce((sum, p) => sum + (p.netPos || 0) * (p.netPrice || 0), 0);
    const avgPrice = totalQty !== 0 ? weightedPriceNumer / totalQty : 0;
    setGroupSymbolNet({ netPos: totalQty, avgNetPrice: avgPrice });
  }, [selectedGroup, symbol, positions]);

  // Fetch accounts and positions
  useEffect(() => {
    const load = async () => {
      if (!user_id) return;
      setIsPageLoading(true);
      const [acc, pos, ord] = await Promise.all([
        getAccounts(user_id),
        getPositions(user_id),
        getOrders(user_id),
      ]);
      if (acc) setAccounts(acc);
      if (pos) setPositions(pos);
      if (ord) setOrders(ord);
      setIsPageLoading(false);
    };
    load();
  }, [user_id]);

  const handleFlattenAll = async () => {
    try {
      setIsOrdering(true);
      const exitList = positions.map((position) => {
        const action = position.netPos > 0 ? "Sell" : "Buy";
        return {
          accountId: position.accountId,
          action,
          symbol: position.symbol,
          orderQty: Math.abs(position.netPos),
          orderType: "Market",
          isAutomated: true,
        };
      });
      if (exitList.length > 0) {
        await exitAllPostions(exitList as any);
      }
      const [acc, pos, ord] = await Promise.all([
        getAccounts(user_id),
        getPositions(user_id),
        getOrders(user_id),
      ]);
      if (acc) setAccounts(acc);
      if (pos) setPositions(pos);
      if (ord) setOrders(ord);
    } catch (e) {
      console.error("Flatten all failed", e);
    } finally {
      setIsOrdering(false);
    }
  };

  // Offline PnL calculation using historical last price
  const calculateOfflinePnL = async () => {
    try {
      if (!selectedGroup) return;
      if (!symbol) return;
      if (positions.length === 0) return;

      const now = new Date();
      const endIso = new Date(now.getTime() - 60 * 1000).toISOString();
      const startIso = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

      const hist = await getHistoricalChart(symbol, startIso, endIso, "ohlcv-1m");
      if (!hist || !hist.data || hist.data.length === 0) return;
      const lastClose = hist.data[hist.data.length - 1].close;

      const ids = new Set(selectedGroup.sub_brokers.map(s => parseInt(s.sub_account_id)));
      const relevant = positions.filter(p => ids.has(p.accountId) && p.netPos !== 0 && p.symbol?.toUpperCase().startsWith(symbol.toUpperCase().slice(0, 2)));

      let totalPnL = 0;
      let symbolPnL = 0;
      for (const p of relevant) {
        const vpp = getValuePerPoint(p.symbol || symbol);
        const qty = p.netPos;
        const entry = p.netPrice || 0;
        const priceDiff = qty >= 0 ? (lastClose - entry) : (entry - lastClose);
        const pnl = priceDiff * Math.abs(qty) * vpp;
        totalPnL += pnl;
        symbolPnL += pnl;
      }
      setGroupPnL(() => ({
        totalPnL: Math.round(totalPnL * 100) / 100,
        symbolPnL: Math.round(symbolPnL * 100) / 100,
        lastUpdate: new Date().toLocaleTimeString(),
      }));
    } catch (e) {
      // Silent fail to avoid UI spam
    }
  };

  // Trigger offline PnL when SSE disconnects
  useEffect(() => {
    if (isConnectedToPnL) {
      if (offlinePnlIntervalRef.current) {
        window.clearInterval(offlinePnlIntervalRef.current);
        offlinePnlIntervalRef.current = null;
      }
      return;
    }
    // Immediately compute once, then every 30s
    calculateOfflinePnL();
    offlinePnlIntervalRef.current = window.setInterval(() => {
      calculateOfflinePnL();
    }, 30000) as any;
    return () => {
      if (offlinePnlIntervalRef.current) {
        window.clearInterval(offlinePnlIntervalRef.current);
        offlinePnlIntervalRef.current = null;
      }
    };
  }, [isConnectedToPnL, selectedGroup, symbol, positions]);

  // Connect to PnL SSE stream
  const connectToPnLStream = () => {
    if (!user_id) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    const eventSource = new EventSource(`${API_BASE}/databento/sse/pnl?user_id=${user_id}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log("Connected to PnL stream for Trading Page");
      setIsConnectedToPnL(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        // Check for status messages
        if (data.status === "connected") {
          console.log("✅ PnL stream connected:", data);
          return;
        }

        // Check for errors
        if (data.error) {
          console.error("❌ PnL stream error:", data);
          return;
        }

        // Update PnL data; key by symbol+account to avoid overwriting
        if (data.symbol && data.unrealizedPnL !== undefined) {
          const key = data.positionKey || `${data.symbol}:${data.accountId}`;
          console.log(`📊 Received PnL data:`, {
            key,
            symbol: data.symbol,
            accountId: data.accountId,
            unrealizedPnL: data.unrealizedPnL,
            netPos: data.netPos,
            entryPrice: data.entryPrice,
            currentPrice: data.currentPrice
          });
          
          setPnlData(prev => ({
            ...prev,
            [key]: data
          }));
        }
      } catch (error) {
        console.error("Error parsing PnL data:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("PnL SSE error:", error);
      setIsConnectedToPnL(false);
    };
  };

  // Subscribe to real-time price stream when symbol changes
  useEffect(() => {
    if (!symbol) {
      if (priceEventSourceRef.current) {
        priceEventSourceRef.current.close();
        priceEventSourceRef.current = null;
      }
      setCurrentPrice({});
      return;
    }

    const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    
    // Subscribe to symbol
    fetch(`${API_BASE}/databento/sse/current-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: [symbol] }),
    }).catch(console.error);

    // Connect to SSE stream
    const es = new EventSource(`${API_BASE}/databento/sse/current-price`);
    priceEventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.status === "connected" || data.test || data.error) return;
        
        if (data.symbol === symbol) {
          setCurrentPrice({
            bid: data.bid_price,
            ask: data.ask_price,
            last: data.last_price || (data.bid_price && data.ask_price ? (data.bid_price + data.ask_price) / 2 : undefined),
            bidSize: data.bid_size,
            askSize: data.ask_size,
          });
        }
      } catch (err) {
        console.error("Error parsing price data:", err);
      }
    };

    es.onerror = () => {
      console.error("Price SSE error");
      es.close();
    };

    return () => {
      if (priceEventSourceRef.current) {
        priceEventSourceRef.current.close();
        priceEventSourceRef.current = null;
      }
    };
  }, [symbol]);

  // Calculate equity per sub-broker (balance + unrealizedPnL) for ALL accounts from ALL groups
  useEffect(() => {
    if (groups.length === 0 || accounts.length === 0) {
      setSubBrokerEquities({});
      return;
    }

    const equities: Record<string, {
      accountId: string;
      nickname: string;
      balance: number;
      unrealizedPnL: number;
      equity: number;
    }> = {};

    // Iterate through all groups to get all sub-brokers
    groups.forEach(group => {
      group.sub_brokers.forEach(subBroker => {
        const accountId = subBroker.sub_account_id;
        const account = accounts.find(a => a.accountId.toString() === accountId);
        const balance = account?.amount || 0;
        
        // Sum unrealizedPnL for this account across all positions
        let unrealizedPnL = 0;
        Object.values(pnlData).forEach((data: any) => {
          const dataAccountId = data.accountId?.toString();
          if (dataAccountId === accountId) {
            unrealizedPnL += data.unrealizedPnL || 0;
          }
        });

        const equity = balance + unrealizedPnL;
        
        equities[accountId] = {
          accountId,
          nickname: subBroker.nickname || subBroker.sub_account_name || `Account ${accountId}`,
          balance,
          unrealizedPnL,
          equity,
        };
      });
    });

    setSubBrokerEquities(equities);
  }, [groups, accounts, pnlData]);

  // Update PnL calculations when data changes
  useEffect(() => {
    calculateGroupPnL();
  }, [pnlData, selectedGroup, symbol]);

  // Connect to PnL stream when component mounts
  useEffect(() => {
    connectToPnLStream();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [user_id]);

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

      // Refresh dependent data after order so UI (monitor, netPos, equities, pnls) updates
      try {
        const [acc, pos, ord] = await Promise.all([
          getAccounts(user_id),
          getPositions(user_id),
          getOrders(user_id),
        ]);
        if (acc) setAccounts(acc);
        if (pos) setPositions(pos);
        if (ord) setOrders(ord);
      } catch (e) {
        // Silent fail; SSE/next poll will catch up
      }

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
    <div className="flex bg-slate-50 h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Header />
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-5">
          <div className="flex-shrink-0 space-y-4 md:space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Trading</h1>
                <p className="text-slate-500 text-xs md:text-sm">Manage positions, place orders, and monitor group performance</p>
              </div>
              <div
                className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-sm ${
                  isConnectedToPnL ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                }`}
              >
                {isConnectedToPnL ? "PnL: Live" : "PnL: Offline"}
            </div>
            </div>

            {/* Trading Toolbar */}
            <div className="rounded-md bg-slate-900 text-slate-100 p-2 md:p-2.5 shadow-sm border border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Symbol select */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Symbol</span>
                  <input
                    value={pendingSymbol}
                    onChange={(e) => setPendingSymbol(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && pendingSymbol) setSymbol(pendingSymbol); }}
                    placeholder="NQZ5"
                    className="h-8 w-28 rounded border border-slate-700 bg-slate-800 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => setSymbol(pendingSymbol)}
                    disabled={!pendingSymbol}
                    className={`h-8 px-3 rounded text-sm font-medium ${pendingSymbol ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 cursor-not-allowed'} text-white`}
                  >
                    Select
                  </button>
                </div>
                <div className="w-px h-6 bg-slate-700" />
                {/* Qty */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Qty</span>
                  <input
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    type="number"
                    min={1}
                    className="h-8 w-16 rounded border border-slate-700 bg-slate-800 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="w-px h-6 bg-slate-700" />
                {/* Group select */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Group</span>
                  <select
                    value={selectedGroup?.id || ""}
                    onChange={(e) => {
                      const group = groups.find((g) => g.id === e.target.value);
                      setSelectedGroup(group || null);
                    }}
                    className="h-8 min-w-[160px] rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select group</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-px h-6 bg-slate-700" />
                {/* Order type and price */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Type</span>
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as any)}
                    className="h-8 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="market">Market</option>
                    <option value="limit">Limit</option>
                  </select>
                  {orderType === "limit" && (
                    <>
                      <span className="text-xs text-slate-400">Price</span>
                      <input
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        type="number"
                        step="0.01"
                        className="h-8 w-24 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </>
                  )}
                </div>
                {orderType === "limit" && (
                  <>
                    <div className="w-px h-6 bg-slate-700" />
                    {/* SL/TP */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">SL/TP</span>
                      <select
                        value={slTpOption}
                        onChange={(e) => setSlTpOption(e.target.value as any)}
                        className="h-8 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="none">None</option>
                        <option value="default1">Default1 (10/10)</option>
                        <option value="default2">Default2 (20/20)</option>
                        <option value="custom">Custom</option>
                      </select>
                      {slTpOption === "custom" && (
                        <>
                          <span className="text-xs text-slate-400">SL</span>
                          <input
                            value={customSL}
                            onChange={(e) => setCustomSL(e.target.value)}
                            type="number"
                            step="0.01"
                            className="h-8 w-20 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-400">TP</span>
                          <input
                            value={customTP}
                            onChange={(e) => setCustomTP(e.target.value)}
                            type="number"
                            step="0.01"
                            className="h-8 w-20 rounded border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </>
                      )}
                    </div>
                  </>
                )}
                {/* Compact PnL & Net badges */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">PnL</span>
                  <span className={`${groupPnL.totalPnL>=0? 'text-emerald-300' : 'text-rose-300'} px-2 py-0.5 rounded bg-slate-800 border border-slate-700`}>${groupPnL.totalPnL.toFixed(0)}</span>
                  {symbol && (
                    <span className={`${groupPnL.symbolPnL>=0? 'text-emerald-300' : 'text-rose-300'} px-2 py-0.5 rounded bg-slate-800 border border-slate-700`}>{symbol}: ${groupPnL.symbolPnL.toFixed(0)}</span>
                  )}
                </div>
                <div className="w-px h-6 bg-slate-700" />
                {/* Group balance and symbol net */}
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <span>Bal ${groupBalance.toFixed(0)}</span>
                  {symbol && (
                    <span>Net {groupSymbolNet.netPos} @ {groupSymbolNet.avgNetPrice ? groupSymbolNet.avgNetPrice.toFixed(2) : 0}</span>
                  )}
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => executeOrder("Buy")}
                    disabled={isOrdering || !selectedGroup || (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0))}
                    className="h-8 px-3 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                    title={orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0) ? 'Enter a valid limit price' : ''}
                  >
                    {orderType === 'limit' ? 'Buy Limit' : 'Buy Mkt'}
                  </button>
                  <button
                    onClick={() => executeOrder("Sell")}
                    disabled={isOrdering || !selectedGroup || (orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0))}
                    className="h-8 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
                    title={orderType === 'limit' && (!limitPrice || parseFloat(limitPrice) <= 0) ? 'Enter a valid limit price' : ''}
                  >
                    {orderType === 'limit' ? 'Sell Limit' : 'Sell Mkt'}
                  </button>
                </div>
              </div>
            </div>

            {/* Real-time Price Display */}
            {symbol && (
              <div className="bg-slate-800 text-slate-100 rounded-md p-2 shadow-sm border border-slate-700">
                <div className="flex items-center gap-3 md:gap-6 text-xs flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Bid:</span>
                    <span className="font-mono font-semibold text-red-400">
                      {currentPrice.bid?.toFixed(2) || "—"}
                    </span>
                    {currentPrice.bidSize !== undefined && (
                      <span className="text-slate-400">({currentPrice.bidSize})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Ask:</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {currentPrice.ask?.toFixed(2) || "—"}
                    </span>
                    {currentPrice.askSize !== undefined && (
                      <span className="text-slate-400">({currentPrice.askSize})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Last:</span>
                    <span className="font-mono font-semibold">
                      {currentPrice.last?.toFixed(2) || "—"}
                    </span>
                  </div>
                  {currentPrice.bid && currentPrice.ask && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Spread:</span>
                      <span className="font-mono">
                        {(currentPrice.ask - currentPrice.bid).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Equity per Sub-Broker - Show all accounts from all groups */}
            {Object.keys(subBrokerEquities).length > 0 && (
              <div className="bg-slate-800 text-slate-100 rounded-md p-2 shadow-sm border border-slate-700">
                <div className="text-xs font-semibold mb-1.5 text-slate-300">Equity per Sub-Broker</div>
                <div className="flex items-center gap-2 md:gap-4 flex-wrap text-xs">
                  {Object.values(subBrokerEquities).map((equity) => (
                    <div key={equity.accountId} className="flex items-center gap-2 bg-slate-700/50 px-2 py-1 rounded">
                      <span className="text-slate-400">{equity.nickname}:</span>
                      <span className={`font-semibold ${equity.equity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${equity.equity.toFixed(2)}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        (Bal: ${equity.balance.toFixed(2)}, PnL: ${equity.unrealizedPnL >= 0 ? '+' : ''}${equity.unrealizedPnL.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          
          {/* Chart - majority of the page */}
          <div className="flex-1 min-h-0 rounded-md border border-slate-200 overflow-hidden" style={{ minHeight: '400px' }}>
            <SymbolsMonitor initialSymbol={symbol} compact height={undefined} />
              </div>
          
          {/* Monitor Tabs (Group Positions, Orders, Accounts) */}
          <div className="mt-4 bg-white rounded-md border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between p-3 border-b border-slate-200">
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('positions')} className={`px-3 py-1.5 text-sm rounded ${activeTab==='positions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>Positions</button>
                <button onClick={() => setActiveTab('orders')} className={`px-3 py-1.5 text-sm rounded ${activeTab==='orders' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>Orders</button>
                <button onClick={() => setActiveTab('accounts')} className={`px-3 py-1.5 text-sm rounded ${activeTab==='accounts' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>Accounts</button>
              </div>
              <button onClick={handleFlattenAll} disabled={isOrdering || positions.length===0} className="px-3 py-1.5 text-sm rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50">Flatten All / Exit All & Cancel All</button>
                      </div>
            <div className="p-3 overflow-x-auto">
              {activeTab === 'positions' && (
                groupMonitorRows.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Group Name</th>
                        <th className="text-right font-semibold px-3 py-2">Open Position</th>
                        <th className="text-left font-semibold px-3 py-2">Symbol</th>
                        <th className="text-right font-semibold px-3 py-2">Open PnL</th>
                        <th className="text-right font-semibold px-3 py-2">Realized PnL</th>
                        <th className="text-right font-semibold px-3 py-2">Total Accounts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMonitorRows.map((row, idx) => (
                        <tr key={`${row.groupName}-${row.symbol}-${idx}`} className="border-b last:border-0">
                          <td className="px-3 py-2">{row.groupName}</td>
                          <td className="px-3 py-2 text-right">{row.openPositions}</td>
                          <td className="px-3 py-2">{row.symbol}</td>
                          <td className={`px-3 py-2 text-right ${row.openPnL>=0? 'text-emerald-600' : 'text-rose-600'}`}>${row.openPnL.toFixed(2)}</td>
                          <td className={`px-3 py-2 text-right ${row.realizedPnL>=0? 'text-emerald-600' : 'text-rose-600'}`}>${row.realizedPnL.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right">{row.totalAccounts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-4 text-slate-500">
                    {groups.length === 0 ? "Loading groups..." : positions.length === 0 ? "No open positions found" : "No positions match the selected criteria"}
                      </div>
                )
              )}
                {activeTab === 'orders' && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Account</th>
                        <th className="text-left font-semibold px-3 py-2">Display</th>
                        <th className="text-left font-semibold px-3 py-2">Symbol</th>
                        <th className="text-left font-semibold px-3 py-2">Action</th>
                        <th className="text-left font-semibold px-3 py-2">Status</th>
                        <th className="text-left font-semibold px-3 py-2">Time</th>
                        <th className="text-right font-semibold px-3 py-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length > 0 ? (
                        orders.map((order) => (
                          <tr key={order.id} className="border-b last:border-0">
                            <td className="px-3 py-2">{order.accountNickname}</td>
                            <td className="px-3 py-2">{order.accountDisplayName}</td>
                            <td className="px-3 py-2">{order.symbol}</td>
                            <td className="px-3 py-2">{order.action}</td>
                            <td className="px-3 py-2">{order.ordStatus}</td>
                            <td className="px-3 py-2">{new Date(order.timestamp).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{order.price}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-slate-500">No orders found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                {activeTab === 'accounts' && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Account</th>
                        <th className="text-left font-semibold px-3 py-2">Display</th>
                        <th className="text-right font-semibold px-3 py-2">Amount</th>
                        <th className="text-right font-semibold px-3 py-2">Realized PnL</th>
                        <th className="text-right font-semibold px-3 py-2">Week PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.length > 0 ? (
                        accounts.map((account) => (
                          <tr key={account.id} className="border-b last:border-0">
                            <td className="px-3 py-2">{account.accountNickname}</td>
                            <td className="px-3 py-2">{account.accountDisplayName}</td>
                            <td className={`px-3 py-2 text-right ${account.amount>=0? 'text-emerald-600' : 'text-rose-600'}`}>${account.amount.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-right ${account.realizedPnL>=0? 'text-emerald-600' : 'text-rose-600'}`}>${account.realizedPnL.toFixed(2)}</td>
                            <td className={`px-3 py-2 text-right ${account.weekRealizedPnL>=0? 'text-emerald-600' : 'text-rose-600'}`}>${account.weekRealizedPnL.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No accounts found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                      </div>
                      </div>

          {/* Group Position Monitor removed per request */}
          <LoadingModal isOpen={isOrdering || isPageLoading} message={isOrdering ? "Submitting order..." : "Loading..."} />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default TradingPage;

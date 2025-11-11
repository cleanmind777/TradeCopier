import React, { useState, useEffect, useRef, useMemo } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
// import TradingViewWidget from "../components/trading/TradingViewWidget";
import {
  executeLimitOrder,
  executeLimitOrderWithSLTP,
  executeMarketOrder,
  getAllTradingData,
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
import LoadingModal from "../components/ui/LoadingModal";
import { tradovateWSMultiClient } from "../services/tradovateWsMulti";
import { getAllWebSocketTokens } from "../api/brokerApi";

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
  const [isMarketClosed, setIsMarketClosed] = useState<boolean>(false);

  // Real-time price data (bid, ask, last, sizes)
  const [currentPrice, setCurrentPrice] = useState<{
    bid?: number;
    ask?: number;
    last?: number;
    bidSize?: number;
    askSize?: number;
  }>({});
  const priceEventSourceRef = useRef<EventSource | null>(null);
  const [isPriceIdle, setIsPriceIdle] = useState<boolean>(false);
  const lastPriceTsRef = useRef<number>(0);

  // Equity per sub-broker (balance + unrealizedPnL)
  const [subBrokerEquities, setSubBrokerEquities] = useState<Record<string, {
    accountId: string;
    nickname: string;
    balance: number;
    unrealizedPnL: number;
    equity: number;
  }>>({});


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
  // Shows positions from all groups, or "All" if no groups are loaded
  const groupMonitorRows = useMemo(() => {
    if (positions.length === 0) return [] as Array<{
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

    // If no groups loaded, show all positions under "All" group
    if (groups.length === 0) {
      const symbolToPositions = new Map<string, TradovatePositionListResponse[]>();
      positions.forEach((p) => {
        const sym = (p.symbol || "").toUpperCase();
        if (!symbolToPositions.has(sym)) symbolToPositions.set(sym, []);
        symbolToPositions.get(sym)!.push(p);
      });

      // Get all accounts for realized PnL calculation
      const allAccountsMap = new Map<number, TradovateAccountsResponse>();
      accounts.forEach((a) => {
        allAccountsMap.set(a.accountId, a);
      });
      const realizedPnLTotal = Array.from(allAccountsMap.values()).reduce((sum, a) => sum + (a.realizedPnL || 0), 0);

      for (const [sym, list] of symbolToPositions.entries()) {
        const totalNetPos = list.reduce((sum, p) => sum + (p.netPos || 0), 0);
        let openPnLSum = 0;
        list.forEach((p) => {
          const key1 = `${p.symbol}:${p.accountId}`;
          const live = pnlData[key1];
          if (live && typeof live.unrealizedPnL === "number") {
            openPnLSum += live.unrealizedPnL;
          }
        });

        // Count unique accounts that have a non-zero position for this symbol
        const accountsWithPositions = new Set<number>();
        list.forEach((p) => {
          if ((p.netPos || 0) !== 0) accountsWithPositions.add(p.accountId);
        });

        rows.push({
          groupName: "All",
          symbol: sym,
          openPositions: totalNetPos,
          openPnL: openPnLSum,
          realizedPnL: realizedPnLTotal,
          totalAccounts: accountsWithPositions.size,
        });
      }
    } else {
      // Create a map of accountId -> group name for quick lookup
      const accountToGroupMap = new Map<number, string>();
      for (const group of groups) {
        group.sub_brokers.forEach((s) => {
          const accountId = parseInt(s.sub_account_id);
          accountToGroupMap.set(accountId, group.name);
        });
      }

      // Group positions by (groupName, symbol) - show ALL positions
      const groupSymbolToPositions = new Map<string, TradovatePositionListResponse[]>();
      positions.forEach((p) => {
        const accountId = Number(p.accountId);
        const groupName = accountToGroupMap.get(accountId) || "All"; // Use "All" for accounts not in any group
        const sym = (p.symbol || "").toUpperCase();
        const key = `${groupName}:${sym}`;
        if (!groupSymbolToPositions.has(key)) {
          groupSymbolToPositions.set(key, []);
        }
        groupSymbolToPositions.get(key)!.push(p);
      });

      // Process each (group, symbol) combination
      for (const [key, list] of groupSymbolToPositions.entries()) {
        const [groupName, sym] = key.split(":");
        
        // Get account IDs for this group (or all accounts if "All")
        let groupAccountIds: Set<number>;
        if (groupName === "All") {
          // For "All" group, use all account IDs from positions in this list
          groupAccountIds = new Set(list.map(p => Number(p.accountId)));
        } else {
          const group = groups.find(g => g.name === groupName);
          groupAccountIds = new Set(
            group?.sub_brokers.map((s) => parseInt(s.sub_account_id)) || []
          );
        }

        // Sum realized PnL across accounts in group
        const realizedPnLTotal = accounts
          .filter((a) => groupAccountIds.has(Number(a.accountId)))
          .reduce((sum, a) => sum + (a.realizedPnL || 0), 0);

        // Open Position: total net position (sum of netPos values)
        const totalNetPos = list.reduce((sum, p) => sum + (Number(p.netPos) || 0), 0);

        // Open PnL: sum from live pnlData if available
        let openPnLSum = 0;
        list.forEach((p) => {
          const key1 = `${p.symbol}:${p.accountId}`;
          const live = pnlData[key1];
          if (live && typeof live.unrealizedPnL === "number") {
            openPnLSum += live.unrealizedPnL;
          }
        });

        // Count unique accounts that have a non-zero position for this symbol
        const accountsWithPositions = new Set<number>();
        list.forEach((p) => {
          if ((Number(p.netPos) || 0) !== 0) accountsWithPositions.add(Number(p.accountId));
        });

        rows.push({
          groupName: groupName,
          symbol: sym,
          openPositions: totalNetPos,
          openPnL: openPnLSum,
          realizedPnL: realizedPnLTotal,
          totalAccounts: accountsWithPositions.size,
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

  // Helper function to filter trading data by selected group and symbol
  const filterTradingData = (
    accounts: TradovateAccountsResponse[],
    positions: TradovatePositionListResponse[],
    orders: any[],
    currentSymbol?: string,
    currentGroup?: GroupInfo | null
  ) => {
    // Use provided parameters or fall back to state
    const symbolToUse = currentSymbol !== undefined ? currentSymbol : symbol;
    const groupToUse = currentGroup !== undefined ? currentGroup : selectedGroup;
    
    let filteredAccounts = accounts || [];
    let filteredPositions = positions || [];
    let filteredOrders = orders || [];

    // Filter by selected group's account IDs
    if (groupToUse && groupToUse.sub_brokers.length > 0) {
      const groupAccountIds = new Set(
        groupToUse.sub_brokers.map(s => parseInt(s.sub_account_id))
      );
      
      filteredAccounts = filteredAccounts.filter((a: any) => 
        groupAccountIds.has(a.accountId)
      );
      filteredPositions = filteredPositions.filter((p: any) => 
        groupAccountIds.has(p.accountId)
      );
      filteredOrders = filteredOrders.filter((o: any) => 
        groupAccountIds.has(o.accountId)
      );
    }

    // Filter positions and orders by selected symbol (exact match or prefix match)
    if (symbolToUse && symbolToUse.trim()) {
      const symbolUpper = symbolToUse.toUpperCase();
      // Try exact match first, then fall back to prefix match for futures contracts
      filteredPositions = filteredPositions.filter((p: any) => {
        if (!p.symbol) return false;
        const pSymbol = p.symbol.toUpperCase();
        // Exact match
        if (pSymbol === symbolUpper) return true;
        // Prefix match (e.g., "NQ" matches "NQZ5", "NQH6", etc.)
        const symbolPrefix = symbolUpper.slice(0, 2);
        return pSymbol.startsWith(symbolPrefix);
      });
      filteredOrders = filteredOrders.filter((o: any) => {
        if (!o.symbol) return false;
        const oSymbol = o.symbol.toUpperCase();
        // Exact match
        if (oSymbol === symbolUpper) return true;
        // Prefix match
        const symbolPrefix = symbolUpper.slice(0, 2);
        return oSymbol.startsWith(symbolPrefix);
      });
    }

    return { filteredAccounts, filteredPositions, filteredOrders };
  };

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
        
        // If symbol matches, add to symbol-specific PnL
        if (symbol && data.symbol === symbol) {
          symbolPnL += pnl;
        }
        
        // Track the latest update time
        if (data.timestamp && (!lastUpdate || data.timestamp > lastUpdate)) {
          lastUpdate = data.timestamp;
        }
      }
    });


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
  }, [selectedGroup?.id, accounts]);

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
  }, [selectedGroup?.id, symbol, positions]);

  // Fetch accounts, positions, and orders on mount and when symbol changes
  // Reload all data when symbol changes (like first loading)
  // Positions: Show ALL groups (only filter by symbol if set)
  // Accounts/Orders: Filter by selected group (for toolbar display)
  useEffect(() => {
    const load = async () => {
      if (!user_id) return;
      setIsPageLoading(true);
      try {
        const data = await getAllTradingData(user_id);
        
        if (data) {
          // Ensure we have arrays, not null
          const rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
          const rawPositions = Array.isArray(data.positions) ? data.positions : [];
          const rawOrders = Array.isArray(data.orders) ? data.orders : [];
          
          // For positions: show ALL groups (only filter by symbol if set)
          let filteredPositions = rawPositions;
          if (symbol && symbol.trim()) {
            const symbolUpper = symbol.toUpperCase();
            filteredPositions = filteredPositions.filter((p: any) => {
              if (!p || !p.symbol) return false;
              const pSymbol = p.symbol.toUpperCase();
              if (pSymbol === symbolUpper) return true;
              const symbolPrefix = symbolUpper.slice(0, 2);
              return pSymbol.startsWith(symbolPrefix);
            });
          }
          
          // For accounts: keep ALL accounts (needed for groupMonitorRows realized PnL calculation)
          // Filtering by group will be done in the accounts tab display
          const allAccounts = rawAccounts;
          
          // For orders: show ALL orders if no group selected, otherwise filter by group
          let filteredOrders = rawOrders;
          if (selectedGroup && selectedGroup.sub_brokers.length > 0) {
            const groupAccountIds = new Set(
              selectedGroup.sub_brokers.map(s => parseInt(s.sub_account_id))
            );
            filteredOrders = filteredOrders.filter((o: any) => 
              o && o.accountId && groupAccountIds.has(Number(o.accountId))
            );
          }
          
          // Filter orders by symbol if set
          if (symbol && symbol.trim()) {
            const symbolUpper = symbol.toUpperCase();
            filteredOrders = filteredOrders.filter((o: any) => {
              if (!o || !o.symbol) return false;
              const oSymbol = o.symbol.toUpperCase();
              if (oSymbol === symbolUpper) return true;
              const symbolPrefix = symbolUpper.slice(0, 2);
              return oSymbol.startsWith(symbolPrefix);
            });
          }
          
          setAccounts(allAccounts);
          setPositions(filteredPositions);
          setOrders(filteredOrders);
        } else {
          // Set empty arrays to ensure UI shows "no data" message
          setAccounts([]);
          setPositions([]);
          setOrders([]);
        }
      } catch (error) {
        // Silent error handling
      } finally {
        setIsPageLoading(false);
      }
    };
    load();
    // Reload when user_id or symbol changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user_id, symbol]);

  // Subscribe to WebSocket updates for positions, orders, and accounts
  // Use refs to access current selectedGroup and symbol without re-subscribing
  const selectedGroupRef = useRef(selectedGroup);
  const symbolRef = useRef(symbol);
  
  // Track if WebSocket has sent initial data (to prevent empty arrays from overwriting API data)
  const wsHasDataRef = useRef({ positions: false, orders: false, accounts: false });
  
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup?.id]);
  
  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  // Ref to store refresh functions and debounce timers
  const refreshDataRef = useRef<{
    refreshTradingData: (immediate?: boolean) => Promise<void>;
    refreshPnLStream: () => void;
  } | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const pnlRefreshTimerRef = useRef<number | null>(null);
  const isRefreshingRef = useRef<boolean>(false);
  const wsRefreshTimerRef = useRef<number | null>(null); // Debounce timer for WebSocket-triggered refreshes
  const handleWebSocketEventRef = useRef<(() => void) | null>(null); // Ref to store WebSocket event handler

  // Subscribe once, filter using refs
  useEffect(() => {
    if (!user_id) return;

    // Reset WebSocket data flags when user changes
    wsHasDataRef.current = { positions: false, orders: false, accounts: false };

    // Refresh function - executes immediately when called from WebSocket updates
    const refreshTradingData = async (immediate = false) => {
      // Prevent overlapping requests
      if (isRefreshingRef.current) {
        return;
      }

      // Clear any pending refresh timer
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      const executeRefresh = async () => {
        if (isRefreshingRef.current) {
          return;
        }
        
        isRefreshingRef.current = true;
        try {
          const data = await getAllTradingData(user_id);
          if (data) {
            console.log(`[WS TRIGGER] ✅ API data received: ${data.positions?.length || 0} positions, ${data.orders?.length || 0} orders, ${data.accounts?.length || 0} accounts`);
            // Use current symbol from refs
            const currentSymbol = symbolRef.current;
            const currentGroup = selectedGroupRef.current;
            
            // Ensure we have arrays, not null
            const rawAccounts = Array.isArray(data.accounts) ? data.accounts : [];
            const rawPositions = Array.isArray(data.positions) ? data.positions : [];
            const rawOrders = Array.isArray(data.orders) ? data.orders : [];
            
            // For positions: show ALL groups (only filter by symbol if set)
            let filteredPositions = rawPositions;
            if (currentSymbol && currentSymbol.trim()) {
              const symbolUpper = currentSymbol.toUpperCase();
              filteredPositions = filteredPositions.filter((p: any) => {
                if (!p || !p.symbol) return false;
                const pSymbol = p.symbol.toUpperCase();
                if (pSymbol === symbolUpper) return true;
                const symbolPrefix = symbolUpper.slice(0, 2);
                return pSymbol.startsWith(symbolPrefix);
              });
            }
            
            // For accounts: keep ALL accounts (needed for groupMonitorRows)
            const allAccounts = rawAccounts;
            
            // For orders: show ALL orders if no group selected, otherwise filter by group
            let filteredOrders = rawOrders;
            if (currentGroup && currentGroup.sub_brokers.length > 0) {
              const groupAccountIds = new Set(
                currentGroup.sub_brokers.map(s => parseInt(s.sub_account_id))
              );
              filteredOrders = filteredOrders.filter((o: any) => 
                o && o.accountId && groupAccountIds.has(Number(o.accountId))
              );
            }
            
            // Filter orders by symbol if set
            if (currentSymbol && currentSymbol.trim()) {
              const symbolUpper = currentSymbol.toUpperCase();
              filteredOrders = filteredOrders.filter((o: any) => {
                if (!o || !o.symbol) return false;
                const oSymbol = o.symbol.toUpperCase();
                if (oSymbol === symbolUpper) return true;
                const symbolPrefix = symbolUpper.slice(0, 2);
                return oSymbol.startsWith(symbolPrefix);
              });
            }
            
            setAccounts(allAccounts);
            setPositions(filteredPositions);
            setOrders(filteredOrders);
          }
        } catch (error) {
          // Silent error handling
        } finally {
          isRefreshingRef.current = false;
        }
      };

      // If immediate (from WebSocket), execute right away
      // Otherwise, debounce for 2 seconds (for manual refreshes)
      if (immediate) {
        executeRefresh();
      } else {
        refreshTimerRef.current = window.setTimeout(executeRefresh, 2000);
      }
    };

    // Debounced PnL stream refresh
    const refreshPnLStream = () => {
      // Clear any pending refresh
      if (pnlRefreshTimerRef.current) {
        window.clearTimeout(pnlRefreshTimerRef.current);
        pnlRefreshTimerRef.current = null;
      }

      // Debounce: only reconnect after 1 second of no updates
      pnlRefreshTimerRef.current = window.setTimeout(() => {
        if (user_id) {
          connectToPnLStream();
        }
      }, 1000); // 1 second debounce
    };

    // Store in ref for WebSocket listeners
    refreshDataRef.current = {
      refreshTradingData,
      refreshPnLStream,
    };

    // Throttled function to handle all WebSocket events
    // Fire immediately on first event, then ignore events for 500ms
    const handleWebSocketEvent = () => {
      try {
        // If there's already a timer, we're in the throttle window - ignore this event
        if (wsRefreshTimerRef.current) {
          // Timer is already set, meaning we're in the throttle window
          // Just reset the timer to extend the window
          window.clearTimeout(wsRefreshTimerRef.current);
          wsRefreshTimerRef.current = null;
        }

        // If we're already refreshing, skip
        if (isRefreshingRef.current) {
          return;
        }

        // Fire immediately on first event
        console.log(`[WS TRIGGER] ⚡ Immediate trigger - sending API requests`);
        
        const refreshFn = refreshDataRef.current;
        if (!refreshFn) {
          console.log(`[WS TRIGGER] ❌ refreshDataRef is null, skipping`);
          return;
        }
        
        refreshFn.refreshTradingData(true); // true = immediate
        refreshFn.refreshPnLStream();

        // Set throttle timer - ignore events for next 500ms
        console.log(`[WS TRIGGER] Setting throttle timer (500ms)`);
        wsRefreshTimerRef.current = window.setTimeout(() => {
          wsRefreshTimerRef.current = null;
          console.log(`[WS TRIGGER] Throttle window ended`);
        }, 500);
        
      } catch (error) {
        console.log(`[WS TRIGGER] ❌ Error in handleWebSocketEvent:`, error);
      }
    };
    
    // Store handler in ref so it's accessible from WebSocket listeners
    handleWebSocketEventRef.current = handleWebSocketEvent;
    console.log(`[WS TRIGGER] Registered handleWebSocketEvent in ref`);

    console.log(`[WS TRIGGER] Registering WebSocket listeners...`);
    const unsubPositions = tradovateWSMultiClient.onPositions((_allPositions) => {
      console.log(`[WS TRIGGER] Positions listener called with ${_allPositions?.length || 0} positions`);
      // Track that WebSocket has sent an event
      wsHasDataRef.current.positions = true;
      
      // Trigger debounced refresh (will combine with other WebSocket events)
      if (handleWebSocketEventRef.current) {
        console.log(`[WS TRIGGER] Calling handleWebSocketEvent from positions listener`);
        handleWebSocketEventRef.current();
      } else {
        console.log(`[WS TRIGGER] ❌ handleWebSocketEventRef.current is null in positions listener!`);
      }
      
      // DO NOT update state from WebSocket data - only use API data
    });

    console.log(`[WS TRIGGER] Positions listener registered`);
    const unsubOrders = tradovateWSMultiClient.onOrders((_allOrders) => {
      console.log(`[WS TRIGGER] Orders listener called with ${_allOrders?.length || 0} orders`);
      // Track that WebSocket has sent an event
      wsHasDataRef.current.orders = true;
      
      // Trigger debounced refresh (will combine with other WebSocket events)
      if (handleWebSocketEventRef.current) {
        console.log(`[WS TRIGGER] Calling handleWebSocketEvent from orders listener`);
        handleWebSocketEventRef.current();
      } else {
        console.log(`[WS TRIGGER] ❌ handleWebSocketEventRef.current is null in orders listener!`);
      }
      
      // DO NOT update state from WebSocket data - only use API data
    });

    console.log(`[WS TRIGGER] Orders listener registered`);
    const unsubAccounts = tradovateWSMultiClient.onAccounts((_allAccounts) => {
      console.log(`[WS TRIGGER] Accounts listener called with ${_allAccounts?.length || 0} accounts`);
      // Track that WebSocket has sent an event
      wsHasDataRef.current.accounts = true;
      
      // Trigger debounced refresh (will combine with other WebSocket events)
      if (handleWebSocketEventRef.current) {
        console.log(`[WS TRIGGER] Calling handleWebSocketEvent from accounts listener`);
        handleWebSocketEventRef.current();
      } else {
        console.log(`[WS TRIGGER] ❌ handleWebSocketEventRef.current is null in accounts listener!`);
      }
      
      // DO NOT update state from WebSocket data - only use API data
    });
    console.log(`[WS TRIGGER] Accounts listener registered`);

    return () => {
      unsubPositions();
      unsubOrders();
      unsubAccounts();
      refreshDataRef.current = null;
      handleWebSocketEventRef.current = null;
      
      // Clear any pending timers
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (pnlRefreshTimerRef.current) {
        window.clearTimeout(pnlRefreshTimerRef.current);
        pnlRefreshTimerRef.current = null;
      }
      if (wsRefreshTimerRef.current) {
        window.clearTimeout(wsRefreshTimerRef.current);
        wsRefreshTimerRef.current = null;
      }
      
      // Disconnect PnL SSE when leaving TradingPage
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnectedToPnL(false);
      }
      
      isRefreshingRef.current = false;
    };
    // Only subscribe once when user_id changes, filtering uses refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user_id]);

  // Refresh PnL when positions change (from polling or manual updates)
  const prevPositionsRef = useRef<string>("");
  useEffect(() => {
    if (!positions || positions.length === 0) {
      prevPositionsRef.current = "";
      // If all positions are closed, clear PnL data and disconnect stream
      setPnlData({});
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnectedToPnL(false);
      }
      return;
    }

    // Create a hash of position keys (symbol:accountId) to detect changes
    const currentPositionKeys = new Set(
      positions
        .filter((p: any) => (p.netPos || 0) !== 0)
        .map((p: any) => `${p.symbol}:${p.accountId}`)
    );
    const positionsHash = Array.from(currentPositionKeys).sort().join(",");

    // Only process if position keys actually changed
    if (positionsHash === prevPositionsRef.current) {
      return;
    }

    prevPositionsRef.current = positionsHash;

    // Clear stale PnL data for positions that no longer exist
    setPnlData((prev) => {
      const next = { ...prev };
      let hasChanges = false;
      Object.keys(prev).forEach((key) => {
        if (!currentPositionKeys.has(key)) {
          delete next[key];
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
    
    // Recalculate PnL when positions change (from WebSocket updates)
    // PnL stream is already connected, just recalculate
    calculateGroupPnL();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const handleFlattenAll = async () => {
    // Check if market is closed
    if (isMarketClosed) {
      alert("Current Market Close");
      return;
    }

    try {
      setIsOrdering(true);
      const exitList = positions
        .filter((p) => (Number(p.netPos) || 0) !== 0)
        .map((position) => {
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
      // Wait briefly for provider to reflect flatten
      // WebSocket will update positions automatically
      await new Promise((r) => setTimeout(r, 1000));
      
      // Clear stale PnL data - WebSocket will update positions automatically
      setPnlData({});
      // PnL stream will automatically update when positions change via WebSocket
      // Normalize unrealized PnL to zero for accounts that are now flat to refresh equities immediately
      try {
        const netByAccount: Record<number, number> = {};
        (positions || []).forEach((p: any) => {
          const acc = Number(p.accountId);
          netByAccount[acc] = (netByAccount[acc] || 0) + (Number(p.netPos) || 0);
        });
        const flatAccounts = new Set<number>(
          Object.entries(netByAccount)
            .filter(([, net]) => (Number(net) || 0) === 0)
            .map(([acc]) => Number(acc))
        );
        if (flatAccounts.size > 0) {
          // Check if all group positions are flat FIRST, before updating pnlData
          if (selectedGroup) {
            const groupAccountIds = new Set(selectedGroup.sub_brokers.map(s => s.sub_account_id));
            const groupNet = (positions || [])
              .filter((p: any) => groupAccountIds.has(p.accountId.toString()))
              .reduce((sum: number, p: any) => sum + (Number(p.netPos) || 0), 0);
            
            // If all group positions are flat, immediately zero toolbar PnL
            if (groupNet === 0) {
              setGroupPnL({ totalPnL: 0, symbolPnL: 0, lastUpdate: new Date().toLocaleTimeString() });
            }
          }

          // Zero out PnL data for flat accounts
          setPnlData((prev) => {
            const next = { ...prev } as Record<string, any>;
            Object.entries(prev).forEach(([key, value]: [string, any]) => {
              if (value && flatAccounts.has(Number(value.accountId))) {
                next[key] = { ...value, unrealizedPnL: 0 };
              }
            });
            return next;
          });
        }
      } catch {}
    } catch (e) {
      // Silent error handling
    } finally {
      setIsOrdering(false);
    }
  };

  // Connect to PnL SSE stream
  const connectToPnLStream = () => {
    if (!user_id) {
      return;
    }

    // Close existing connection first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnectedToPnL(false);
    }

    const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    const url = `${API_BASE}/databento/sse/pnl?user_id=${user_id}`;
    
    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnectedToPnL(true);
      };

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        // Check for status messages
        if (data.status === "connected") {
          setIsConnectedToPnL(true);
          return;
        }

        // Check for errors
        if (data.error) {
          setIsConnectedToPnL(false);
          return;
        }

        // Check for market closed status
        if (data.status === "market_closed") {
          setIsConnectedToPnL(false);
          setIsMarketClosed(true);
          return;
        }

        // Update PnL data; key by symbol+account to avoid overwriting
        if (data.symbol && data.unrealizedPnL !== undefined) {
          const key = data.positionKey || `${data.symbol}:${data.accountId}`;
          
          setPnlData(prev => ({
            ...prev,
            [key]: data
          }));
        }
      } catch (error) {
        // Silent error handling
      }
    };

      eventSource.onerror = (error) => {
        setIsConnectedToPnL(false);
        
        // Close the connection if it's in a bad state
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null;
        }
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          if (user_id && !eventSourceRef.current) {
            connectToPnLStream();
          }
        }, 5000);
      };
    } catch (error) {
      setIsConnectedToPnL(false);
    }
  };

  // Use ref to track current symbol for SSE handler
  const currentSymbolRef = useRef(symbol);
  useEffect(() => {
    currentSymbolRef.current = symbol;
  }, [symbol]);

  // Track connection ID to ignore data from old connections
  const sseConnectionIdRef = useRef<string | null>(null);

  // Subscribe to real-time price stream when symbol changes
  useEffect(() => {
    // Close old connection first and clear price
    if (priceEventSourceRef.current) {
      priceEventSourceRef.current.close();
      priceEventSourceRef.current = null;
      sseConnectionIdRef.current = null;
    }
    setCurrentPrice({});

    if (!symbol) {
      return;
    }

    const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    
    const start = async () => {
      // Quick market status check first
      try {
        const statusRes = await fetch(`${API_BASE}/databento/market-status?symbols=${encodeURIComponent(symbol)}`);
        const statusJson = await statusRes.json();
        if (!statusJson.open) {
          setIsPriceIdle(true);
          setIsMarketClosed(true);
          // Still attempt SSE unless API key is missing
          if (statusJson.reason === 'missing_api_key') {
            return;
          }
        } else {
          setIsMarketClosed(false);
        }
      } catch {
        // On error, assume market is closed to be safe
        setIsMarketClosed(true);
      }
      
      // Create EventSource with current symbol
      const currentSymbol = currentSymbolRef.current;
      if (!currentSymbol) return; // Symbol changed while async operation was running
      
      const es = new EventSource(`${API_BASE}/databento/sse/current-price?symbols=${encodeURIComponent(currentSymbol)}`);
      priceEventSourceRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          
          // Handle connection status message
          if (data.status === "connected") {
            sseConnectionIdRef.current = data.connection_id || null;
            setIsMarketClosed(false);
            return;
          }
          
          // Check for market closed status
          if (data.status === "market_closed") {
            setIsMarketClosed(true);
            setIsPriceIdle(true);
            return;
          }
          
          if (data.test || data.error) return;
          
          // Ignore data from old connections
          if (data.connection_id && sseConnectionIdRef.current && data.connection_id !== sseConnectionIdRef.current) {
            return;
          }
          
          // Use ref to get current symbol (not closure value)
          const symbolToCheck = currentSymbolRef.current;
          if (!symbolToCheck) return; // Symbol was cleared
          
          // Normalize symbols for comparison (handle .FUT suffix variations)
          const normalizeSymbol = (s: string) => s.toUpperCase().replace('.FUT', '');
          const dataSymbolNormalized = normalizeSymbol(data.symbol || '');
          const currentSymbolNormalized = normalizeSymbol(symbolToCheck);
          
          if (dataSymbolNormalized === currentSymbolNormalized) {
            setCurrentPrice({
              bid: data.bid_price,
              ask: data.ask_price,
              last: data.last_price || (data.bid_price && data.ask_price ? (data.bid_price + data.ask_price) / 2 : undefined),
              bidSize: data.bid_size,
              askSize: data.ask_size,
            });
            lastPriceTsRef.current = Date.now();
            setIsPriceIdle(false);
          } else {
            // Log when we receive data for a different symbol (shouldn't happen with backend filtering)
          }
        } catch (error) {
          // Silent error handling
        }
      };

      es.onerror = () => {
        // keep connection light; mark as idle rather than erroring UI
        setIsPriceIdle(true);
        es.close();
        sseConnectionIdRef.current = null;
      };
    };

    const idleCb = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: any) => number);
    let timeoutId: number | undefined;
    if (typeof idleCb === "function") {
      idleCb(start, { timeout: 1000 });
    } else {
      timeoutId = window.setTimeout(start, 250);
    }

    // Idle detector
    const idleInterval = window.setInterval(() => {
      const since = Date.now() - (lastPriceTsRef.current || 0);
      if (since > 15000) {
        setIsPriceIdle(true);
      }
    }, 5000);

    return () => {
      window.clearInterval(idleInterval);
      if (timeoutId) window.clearTimeout(timeoutId);
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

  // Update PnL calculations when data changes (including positions)
  useEffect(() => {
    calculateGroupPnL();
  }, [pnlData, selectedGroup?.id, symbol, positions]);

  // Reset PnL to 0 when all positions in selected group are flat
  useEffect(() => {
    if (!selectedGroup || !positions || positions.length === 0) {
      return;
    }

    // Get sub-broker account IDs from selected group
    const groupAccountIds = new Set(
      selectedGroup.sub_brokers.map(sub => sub.sub_account_id.toString())
    );

    // Check if all positions for this group are flat
    const groupPositions = positions.filter((p: any) => 
      groupAccountIds.has(p.accountId?.toString())
    );

    const allFlat = groupPositions.length === 0 || 
      groupPositions.every((p: any) => Number(p.netPos) === 0);

    if (allFlat) {
      setGroupPnL({
        totalPnL: 0,
        symbolPnL: 0,
        lastUpdate: new Date().toLocaleTimeString()
      });
      // Clear PnL data for flat accounts
      setPnlData((prev) => {
        const next = { ...prev };
        Object.keys(prev).forEach((key) => {
          const data = prev[key];
          if (data && groupAccountIds.has(data.accountId?.toString())) {
            delete next[key];
          }
        });
        return next;
      });
    }
  }, [positions, selectedGroup?.id]);

  // Connect/reconnect PnL stream when user_id changes or when positions change
  // PnL stream should work independently of selected symbol/group - it tracks all positions
  useEffect(() => {
    if (!user_id) {
      // Close connection if user_id is cleared
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnectedToPnL(false);
      }
      return;
    }

    // Connect/reconnect PnL stream - it will track all positions for the user
    connectToPnLStream();
    
    return () => {
      // Disconnect PnL SSE when component unmounts or user_id changes
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnectedToPnL(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Silent error handling
    }
  };

  // Execute buy/sell order directly via WebSocket
  const executeOrder = async (action: "Buy" | "Sell") => {
    // Check if market is closed
    if (isMarketClosed) {
      alert("Current Market Close");
      return;
    }

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
        await executeMarketOrder(order);
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
          await executeLimitOrder(order);
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
          await executeLimitOrderWithSLTP(order);
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

      // Wait briefly for provider to reflect new positions
      await new Promise((r) => setTimeout(r, 500));

      // WebSocket will automatically update positions, orders, and accounts
      // Clear stale PnL data - WebSocket will update positions automatically
      setPnlData({});
      // PnL stream will automatically update when positions change via WebSocket

      // Reset form
      setOrderQuantity("1");
      setLimitPrice("");
      setOrderType("market");

      // Success notification removed per user request
    } catch (error) {
      // Error alert kept for user feedback
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

  // Load groups once on mount
  useEffect(() => {
    if (user_id) {
      loadGroups();
    }
  }, [user_id]);

  // Connect WebSocket to all broker accounts when user_id changes
  const prevUserIdRef = useRef<string | null>(null);
  const tokenFetchAttemptRef = useRef<number>(0);
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second
  
  useEffect(() => {
    const currentUserId = user_id;
    
    // Only connect if userId actually changed
    if (currentUserId && prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      tokenFetchAttemptRef.current = 0;
      
      // Fetch tokens for all broker accounts and connect with retry logic
      const fetchTokensWithRetry = async (attempt: number = 0): Promise<void> => {
        console.log(`[TradingPage] Fetching WebSocket tokens for user: ${currentUserId} (attempt ${attempt + 1}/${MAX_RETRIES})`);
        
        try {
          const tokensList = await getAllWebSocketTokens(currentUserId);
          console.log(`[TradingPage] Received ${tokensList?.length || 0} WebSocket tokens:`, tokensList);
          
          if (tokensList && Array.isArray(tokensList) && tokensList.length > 0) {
            // Filter out any invalid tokens and map to ensure all required fields are present
            const validTokens = tokensList.filter(t => 
              t && 
              t.id && 
              t.access_token && 
              t.md_access_token
            );
            
            if (validTokens.length === 0) {
              console.error(`[TradingPage] No valid tokens found. All tokens are missing required fields.`);
              console.error(`[TradingPage] Token structure:`, tokensList.map(t => ({
                hasId: !!t?.id,
                hasAccessToken: !!t?.access_token,
                hasMdToken: !!t?.md_access_token,
                keys: t ? Object.keys(t) : []
              })));
              
              // Retry if we haven't exceeded max retries
              if (attempt < MAX_RETRIES - 1) {
                console.log(`[TradingPage] Retrying token fetch in ${RETRY_DELAY}ms...`);
                setTimeout(() => fetchTokensWithRetry(attempt + 1), RETRY_DELAY);
              }
              return;
            }
            
            // Map tokens to ensure is_demo has a default value
            const mappedTokens = validTokens.map(t => ({
              id: String(t.id), // Ensure id is a string
              access_token: t.access_token,
              md_access_token: t.md_access_token,
              is_demo: t.is_demo ?? false
            }));
            
            console.log(`[TradingPage] Mapped ${mappedTokens.length} valid tokens, connecting to WebSocket...`);
            tradovateWSMultiClient.connectAll(currentUserId, mappedTokens);
            tokenFetchAttemptRef.current = 0; // Reset on success
          } else {
            console.error(`[TradingPage] No tokens received or empty list. Response:`, tokensList);
            
            // Retry if we haven't exceeded max retries
            if (attempt < MAX_RETRIES - 1) {
              console.log(`[TradingPage] Retrying token fetch in ${RETRY_DELAY}ms...`);
              setTimeout(() => fetchTokensWithRetry(attempt + 1), RETRY_DELAY);
            } else {
              console.error(`[TradingPage] Failed to fetch tokens after ${MAX_RETRIES} attempts`);
            }
          }
        } catch (error: any) {
          console.error(`[TradingPage] Error fetching WebSocket tokens (attempt ${attempt + 1}):`, error);
          if (error.response) {
            console.error(`[TradingPage] API Error Response:`, error.response.data);
            console.error(`[TradingPage] API Error Status:`, error.response.status);
          }
          
          // Retry if we haven't exceeded max retries and it's not a 4xx error (client error)
          if (attempt < MAX_RETRIES - 1 && (!error.response || error.response.status >= 500)) {
            console.log(`[TradingPage] Retrying token fetch in ${RETRY_DELAY}ms...`);
            setTimeout(() => fetchTokensWithRetry(attempt + 1), RETRY_DELAY);
          } else {
            console.error(`[TradingPage] Failed to fetch tokens after ${attempt + 1} attempts`);
          }
        }
      };
      
      fetchTokensWithRetry(0);
    } else if (!currentUserId) {
      // If userId is cleared, disconnect all
      prevUserIdRef.current = null;
      tokenFetchAttemptRef.current = 0;
      tradovateWSMultiClient.disconnectAll();
    }

    return () => {
      // Disconnect WebSocket when component unmounts (user leaves TradingPage)
      tradovateWSMultiClient.disconnectAll();
    };
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
                <div className="w-px h-6 bg-slate-700" />
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
                {/* push following controls to the far right */}
                <div className="flex-1" />
                <button
                  onClick={handleFlattenAll}
                  disabled={isOrdering || positions.every(p => (Number(p.netPos) || 0) === 0)}
                  className="h-8 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50"
                  aria-label="Flatten All / Exit All & Cancel All"
                >
                  Flatten / Exit & Cancel
                </button>
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
          
          
          {/* Monitor Tabs (Group Positions, Orders, Accounts) */}
          <div className="mt-4 bg-white rounded-md border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between p-3 border-b border-slate-200">
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('positions')} className={`px-3 py-1.5 text-sm rounded ${activeTab==='positions' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>Positions</button>
                <button onClick={() => setActiveTab('orders')} className={`px-3 py-1.5 text-sm rounded ${activeTab==='orders' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>Orders</button>
                <button onClick={() => setActiveTab('accounts')} className={`px-3 py-1.5 text-sm rounded ${activeTab==='accounts' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}>Accounts</button>
              </div>
                      </div>
            <div className="p-3 overflow-x-auto">
              {/* Debug info - remove in production */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mb-2 text-xs text-gray-500">
                  Debug: positions={positions.length}, orders={orders.length}, accounts={accounts.length}, groupMonitorRows={groupMonitorRows.length}
                </div>
              )}
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
                {activeTab === 'accounts' && (() => {
                  // Filter accounts by selected group for display (if group is selected)
                  let displayAccounts = accounts;
                  if (selectedGroup && selectedGroup.sub_brokers.length > 0) {
                    const groupAccountIds = new Set(
                      selectedGroup.sub_brokers.map(s => parseInt(s.sub_account_id))
                    );
                    displayAccounts = accounts.filter((a: any) => 
                      groupAccountIds.has(a.accountId)
                    );
                  }
                  
                  return (
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
                        {displayAccounts.length > 0 ? (
                          displayAccounts.map((account) => (
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
                  );
                })()}
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

import { getWebSocketTokenForGroup } from "../api/brokerApi";

type PositionUpdate = any; // TradovatePositionListResponse
type OrderUpdate = any; // TradovateOrderListResponse
type AccountUpdate = any; // TradovateAccountsResponse

type PositionListener = (positions: PositionUpdate[]) => void;
type OrderListener = (orders: OrderUpdate[]) => void;
type AccountListener = (accounts: AccountUpdate[]) => void;

// Single WebSocket connection manager
class SingleWSConnection {
  private ws: WebSocket | null = null;
  private heartbeatTimer: any = null;
  private reconnectTimer: any = null;
  private isConnecting = false;
  private brokerAccountId: string;
  private tokens: { access_token: string; md_access_token: string; is_demo: boolean };
  private numericUserId: string | null = null;
  private messageIdCounter = 10;
  
  // State for this connection
  private currentPositions: PositionUpdate[] = [];
  private currentOrders: OrderUpdate[] = [];
  private currentAccounts: AccountUpdate[] = [];

  private onUpdateCallback: (() => void) | null = null; // Callback to notify parent of updates

  constructor(brokerAccountId: string, tokens: { access_token: string; md_access_token: string; is_demo: boolean }, onUpdate?: () => void) {
    this.brokerAccountId = brokerAccountId;
    this.tokens = tokens;
    this.onUpdateCallback = onUpdate || null;
  }
  
  setOnUpdateCallback(callback: () => void) {
    this.onUpdateCallback = callback;
  }

  async connect() {
    if (this.isConnecting) {
      console.log(`[TradovateWS-${this.brokerAccountId}] Already connecting, skipping`);
      return;
    }
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log(`[TradovateWS-${this.brokerAccountId}] Already connected, skipping`);
      return;
    }
    
    this.isConnecting = true;

    try {
      // Extract numeric user ID from JWT token
      let numericUserId: string | null = null;
      try {
        const tokenParts = this.tokens.access_token.split('.');
        if (tokenParts.length >= 2) {
          const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
          numericUserId = payload.sub || null;
          console.log(`[TradovateWS-${this.brokerAccountId}] Extracted numeric user ID: ${numericUserId}`);
        }
      } catch (e) {
        console.warn(`[TradovateWS-${this.brokerAccountId}] Could not extract user ID from token:`, e);
      }

      const wsEndpoint = this.tokens.is_demo 
        ? "wss://demo.tradovateapi.com/v1/websocket"
        : "wss://live.tradovateapi.com/v1/websocket";
      console.log(`[TradovateWS-${this.brokerAccountId}] Connecting to ${this.tokens.is_demo ? 'demo' : 'live'} WebSocket: ${wsEndpoint}`);
      
      const ws = new WebSocket(wsEndpoint);
      this.ws = ws;

      ws.onopen = () => {
        try {
          const authMsg = `authorize\n1\n\n${this.tokens.access_token}`;
          ws.send(authMsg);
          this.scheduleHeartbeat();
          setTimeout(() => {
            if (numericUserId) {
              this.numericUserId = numericUserId;
            }
            this.subscribePositions();
            this.subscribeOrders();
            this.subscribeAccounts();
          }, 500);
        } catch {
          this.reconnect();
        }
      };

      ws.onmessage = (evt) => this.handleMessage(evt);
      ws.onerror = (error) => {
        console.error(`[TradovateWS-${this.brokerAccountId}] WebSocket error:`, error);
        if (!this.isConnecting && !this.reconnectTimer) {
          this.reconnect();
        }
      };
      ws.onclose = (event) => {
        console.log(`[TradovateWS-${this.brokerAccountId}] WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        if (event.code !== 1000 && !this.isConnecting && !this.reconnectTimer) {
          this.reconnect();
        }
      };
    } catch (error) {
      console.error(`[TradovateWS-${this.brokerAccountId}] Connection error:`, error);
      if (!this.isConnecting && !this.reconnectTimer) {
        this.reconnect();
      }
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(1000, "client disconnect"); } catch {}
      this.ws = null;
    }
    this.numericUserId = null;
    this.currentPositions = [];
    this.currentOrders = [];
    this.currentAccounts = [];
  }

  private scheduleHeartbeat() {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
    }
    this.heartbeatTimer = setTimeout(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send("[]");
        } catch {}
      }
      this.scheduleHeartbeat();
    }, 25000);
  }

  private reconnect() {
    if (this.reconnectTimer) return;
    console.log(`[TradovateWS-${this.brokerAccountId}] Scheduling reconnect in 1500ms`);
    this.disconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`[TradovateWS-${this.brokerAccountId}] Executing reconnect`);
      this.connect();
    }, 1500);
  }

  private subscribePositions() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.numericUserId) {
      console.error(`[TradovateWS-${this.brokerAccountId}] Cannot subscribe to positions: numeric user ID not available`);
      return;
    }
    try {
      const id = this.messageIdCounter++;
      const subscribeMsg = `user/syncrequest\n${id}\n\n{"users": [${this.numericUserId}]}`;
      console.log(`[TradovateWS-${this.brokerAccountId}] Subscribing to user data via user/syncrequest for numeric userId: ${this.numericUserId}`);
      this.ws.send(subscribeMsg);
    } catch (error) {
      console.error(`[TradovateWS-${this.brokerAccountId}] Error subscribing to positions:`, error);
      this.reconnect();
    }
  }

  private subscribeOrders() {
    // Orders are handled by user/syncrequest, no separate subscription needed
    console.log(`[TradovateWS-${this.brokerAccountId}] Orders subscription handled by user/syncrequest`);
  }

  private subscribeAccounts() {
    // Accounts are handled by user/syncrequest, no separate subscription needed
    console.log(`[TradovateWS-${this.brokerAccountId}] Accounts subscription handled by user/syncrequest`);
  }

  private handleMessage(message: MessageEvent) {
    const data = message.data as string;
    if (!data || data.length === 0) return;

    const frameType = data[0];
    if (frameType === "a") {
      try {
        const items = JSON.parse(data.substring(1));
        items.forEach((item: any) => {
          if (item.s !== undefined && item.i !== undefined) {
            if (item.s === 200 && item.i === 1) {
              console.log(`[TradovateWS-${this.brokerAccountId}] Authorization successful`);
            }
            return;
          }
          
          // Handle props events (entity updates from user/syncrequest)
          if (item.e === "props" && item.d) {
            const entityType = item.d.entityType;
            const eventType = item.d.eventType;
            const entity = item.d.entity;
            
            if (!entity) return;
            
            // Trigger listeners immediately when we receive order/position/account updates
            if (entityType === "position") {
              console.log(`[TradovateWS-${this.brokerAccountId}] Position ${eventType} received`);
              this.handlePositionUpdate(entity, eventType);
            } else if (entityType === "order") {
              console.log(`[TradovateWS-${this.brokerAccountId}] Order ${eventType} received`);
              this.handleOrderUpdate(entity, eventType);
            } else if (entityType === "cashBalance" || entityType === "account") {
              console.log(`[TradovateWS-${this.brokerAccountId}] ${entityType} ${eventType} received`);
              this.handleAccountUpdate(entity, eventType, entityType);
            } else if (entityType === "marginSnapshot") {
              // marginSnapshot indicates account margin changed - trigger account update callback
              console.log(`[TradovateWS-${this.brokerAccountId}] marginSnapshot received, triggering callback`);
              if (this.onUpdateCallback) {
                this.onUpdateCallback();
              } else {
                console.log(`[TradovateWS-${this.brokerAccountId}] onUpdateCallback is null!`);
              }
            } else if (entityType === "auditUserAction") {
              // auditUserAction indicates a trade action (BuyMarket, SellMarket, etc.) - trigger update
              console.log(`[TradovateWS-${this.brokerAccountId}] auditUserAction received, triggering callback`);
              if (this.onUpdateCallback) {
                this.onUpdateCallback();
              } else {
                console.log(`[TradovateWS-${this.brokerAccountId}] onUpdateCallback is null!`);
              }
            }
          }
          
          // Handle initial sync data (might come as arrays)
          if (item.d && Array.isArray(item.d)) {
            item.d.forEach((entity: any) => {
              if (entity && typeof entity === 'object') {
                // Try to determine entity type from properties
                if (entity.contractId !== undefined || entity.netPos !== undefined) {
                  // This looks like a position
                  this.handlePositionUpdate(entity, "Created");
                } else if (entity.ordStatus !== undefined || entity.status !== undefined) {
                  // This looks like an order
                  this.handleOrderUpdate(entity, "Created");
                } else if (entity.amount !== undefined || entity.accountId !== undefined) {
                  // This looks like an account/cashBalance
                  this.handleAccountUpdate(entity, "Created", "cashBalance");
                }
              }
            });
          }
        });
      } catch (error) {
        console.error(`[TradovateWS-${this.brokerAccountId}] Error parsing message:`, error);
      }
    } else if (frameType === "h") {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("[]");
      }
    }
  }

  private handlePositionUpdate(entity: any, eventType: string) {
    if (eventType === "Created" || eventType === "Updated") {
      const existingIndex = this.currentPositions.findIndex(
        (p: any) => p.id === entity.id || 
        (p.accountId === entity.accountId && p.contractId === entity.contractId)
      );
      
      if (existingIndex >= 0) {
        this.currentPositions[existingIndex] = { ...this.currentPositions[existingIndex], ...entity };
      } else {
        this.currentPositions.push(entity);
      }
      
      this.currentPositions = this.currentPositions.filter((p: any) => !p.archived);
    } else if (eventType === "Deleted" || entity.archived) {
      this.currentPositions = this.currentPositions.filter(
        (p: any) => p.id !== entity.id && 
        !(p.accountId === entity.accountId && p.contractId === entity.contractId)
      );
    }
    
    // Immediately notify parent to trigger listeners
    console.log(`[TradovateWS-${this.brokerAccountId}] handlePositionUpdate: calling onUpdateCallback`);
    if (this.onUpdateCallback) {
      this.onUpdateCallback();
    } else {
      console.log(`[TradovateWS-${this.brokerAccountId}] handlePositionUpdate: onUpdateCallback is null!`);
    }
  }

  private handleOrderUpdate(entity: any, eventType: string) {
    if (eventType === "Created" || eventType === "Updated") {
      const existingIndex = this.currentOrders.findIndex((o: any) => o.id === entity.id);
      
      if (existingIndex >= 0) {
        this.currentOrders[existingIndex] = { ...this.currentOrders[existingIndex], ...entity };
      } else {
        this.currentOrders.push(entity);
      }
      
      this.currentOrders = this.currentOrders.filter((o: any) => {
        if (o.archived) return false;
        const status = o.ordStatus || o.status;
        return status !== "Filled" && status !== "Cancelled" && status !== "Rejected";
      });
    } else if (eventType === "Deleted" || entity.archived) {
      this.currentOrders = this.currentOrders.filter((o: any) => o.id !== entity.id);
    }
    
    // Immediately notify parent to trigger listeners
    console.log(`[TradovateWS-${this.brokerAccountId}] handleOrderUpdate: calling onUpdateCallback`);
    if (this.onUpdateCallback) {
      this.onUpdateCallback();
    } else {
      console.log(`[TradovateWS-${this.brokerAccountId}] handleOrderUpdate: onUpdateCallback is null!`);
    }
  }

  private handleAccountUpdate(entity: any, eventType: string, entityType: string) {
    if (entityType === "cashBalance") {
      const accountId = entity.accountId;
      const existingIndex = this.currentAccounts.findIndex((a: any) => a.accountId === accountId);
      
      if (existingIndex >= 0) {
        this.currentAccounts[existingIndex] = {
          ...this.currentAccounts[existingIndex],
          amount: entity.amount,
          realizedPnL: entity.realizedPnL,
          weekRealizedPnL: entity.weekRealizedPnL,
        };
      } else {
        this.currentAccounts.push({
          accountId: accountId,
          amount: entity.amount,
          realizedPnL: entity.realizedPnL,
          weekRealizedPnL: entity.weekRealizedPnL,
        });
      }
    } else if (entityType === "account") {
      const existingIndex = this.currentAccounts.findIndex((a: any) => a.accountId === entity.accountId || a.id === entity.id);
      
      if (existingIndex >= 0) {
        this.currentAccounts[existingIndex] = { ...this.currentAccounts[existingIndex], ...entity };
      } else {
        this.currentAccounts.push(entity);
      }
    }
    
    // Immediately notify parent to trigger listeners
    console.log(`[TradovateWS-${this.brokerAccountId}] handleAccountUpdate: calling onUpdateCallback`);
    if (this.onUpdateCallback) {
      this.onUpdateCallback();
    } else {
      console.log(`[TradovateWS-${this.brokerAccountId}] handleAccountUpdate: onUpdateCallback is null!`);
    }
  }

  getPositions(): PositionUpdate[] {
    return [...this.currentPositions];
  }

  getOrders(): OrderUpdate[] {
    return [...this.currentOrders];
  }

  getAccounts(): AccountUpdate[] {
    return [...this.currentAccounts];
  }
}

// Multi-connection WebSocket manager
export class TradovateWSMultiClient {
  private connections = new Map<string, SingleWSConnection>();
  private positionListeners = new Set<PositionListener>();
  private orderListeners = new Set<OrderListener>();
  private accountListeners = new Set<AccountListener>();
  private updateTimer: any = null;

  async connectAll(userId: string, tokensList: Array<{ id: string; access_token: string; md_access_token: string; is_demo: boolean }>) {
    console.log(`[TradovateWSMulti] Connecting to ${tokensList.length} broker account(s)`);
    
    // Disconnect removed accounts
    const currentIds = new Set(tokensList.map(t => t.id));
    for (const [accountId, connection] of this.connections.entries()) {
      if (!currentIds.has(accountId)) {
        console.log(`[TradovateWSMulti] Disconnecting removed account: ${accountId}`);
        connection.disconnect();
        this.connections.delete(accountId);
      }
    }

    // Connect to all accounts
    for (const tokens of tokensList) {
      if (!this.connections.has(tokens.id)) {
        const connection = new SingleWSConnection(tokens.id, {
          access_token: tokens.access_token,
          md_access_token: tokens.md_access_token,
          is_demo: tokens.is_demo
        }, () => {
          // Immediately trigger aggregation when any connection receives an update
          this.aggregateAndNotify();
        });
        this.connections.set(tokens.id, connection);
        await connection.connect();
      } else {
        // Update callback for existing connection
        const connection = this.connections.get(tokens.id);
        if (connection) {
          connection.setOnUpdateCallback(() => {
            this.aggregateAndNotify();
          });
        }
      }
    }

    // Start periodic aggregation if not already started
    if (!this.updateTimer) {
      this.startAggregation();
    }
    
    // Immediately trigger aggregation to notify listeners with current state
    // This ensures UI gets initial data even if WebSocket hasn't received updates yet
    setTimeout(() => {
      this.aggregateAndNotify();
    }, 2000); // Give WebSocket time to establish and receive initial sync data
  }

  disconnectAll() {
    console.log(`[TradovateWSMulti] Disconnecting all connections`);
    for (const connection of this.connections.values()) {
      connection.disconnect();
    }
    this.connections.clear();
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  private startAggregation() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }
    // Aggregate and notify listeners every 500ms to reduce overhead
    // WebSocket updates are already real-time, so we don't need 100ms polling
    this.updateTimer = setInterval(() => {
      this.aggregateAndNotify();
    }, 500);
  }

  private aggregateAndNotify() {
    console.log(`[TradovateWSMulti] aggregateAndNotify called - ${this.positionListeners.size} position listeners, ${this.orderListeners.size} order listeners, ${this.accountListeners.size} account listeners`);
    
    // Aggregate positions from all connections
    const allPositions: PositionUpdate[] = [];
    for (const connection of this.connections.values()) {
      allPositions.push(...connection.getPositions());
    }

    // Aggregate orders from all connections
    const allOrders: OrderUpdate[] = [];
    for (const connection of this.connections.values()) {
      allOrders.push(...connection.getOrders());
    }

    // Aggregate accounts from all connections
    const allAccounts: AccountUpdate[] = [];
    for (const connection of this.connections.values()) {
      allAccounts.push(...connection.getAccounts());
    }

    console.log(`[TradovateWSMulti] Aggregated: ${allPositions.length} positions, ${allOrders.length} orders, ${allAccounts.length} accounts`);

    // Always notify listeners if they exist, even if arrays are empty
    // This ensures UI updates when positions/orders/accounts are cleared
    if (this.positionListeners.size > 0) {
      console.log(`[TradovateWSMulti] Notifying ${this.positionListeners.size} position listeners`);
      this.positionListeners.forEach((cb) => cb(allPositions));
    }
    if (this.orderListeners.size > 0) {
      console.log(`[TradovateWSMulti] Notifying ${this.orderListeners.size} order listeners`);
      this.orderListeners.forEach((cb) => cb(allOrders));
    }
    if (this.accountListeners.size > 0) {
      console.log(`[TradovateWSMulti] Notifying ${this.accountListeners.size} account listeners`);
      this.accountListeners.forEach((cb) => cb(allAccounts));
    }
  }

  onPositions(listener: PositionListener) {
    this.positionListeners.add(listener);
    // Immediately notify with current state
    const allPositions: PositionUpdate[] = [];
    for (const connection of this.connections.values()) {
      allPositions.push(...connection.getPositions());
    }
    listener(allPositions);
    return () => this.positionListeners.delete(listener);
  }

  onOrders(listener: OrderListener) {
    this.orderListeners.add(listener);
    // Immediately notify with current state
    const allOrders: OrderUpdate[] = [];
    for (const connection of this.connections.values()) {
      allOrders.push(...connection.getOrders());
    }
    listener(allOrders);
    return () => this.orderListeners.delete(listener);
  }

  onAccounts(listener: AccountListener) {
    this.accountListeners.add(listener);
    // Immediately notify with current state
    const allAccounts: AccountUpdate[] = [];
    for (const connection of this.connections.values()) {
      allAccounts.push(...connection.getAccounts());
    }
    listener(allAccounts);
    return () => this.accountListeners.delete(listener);
  }
}

export const tradovateWSMultiClient = new TradovateWSMultiClient();


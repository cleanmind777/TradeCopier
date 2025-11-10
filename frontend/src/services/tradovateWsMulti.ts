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

  constructor(brokerAccountId: string, tokens: { access_token: string; md_access_token: string; is_demo: boolean }) {
    this.brokerAccountId = brokerAccountId;
    this.tokens = tokens;
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
          
          if (item.e === "props" && item.d) {
            const entityType = item.d.entityType;
            const eventType = item.d.eventType;
            const entity = item.d.entity;
            
            if (!entity) return;
            
            if (entityType === "position") {
              this.handlePositionUpdate(entity, eventType);
            } else if (entityType === "order") {
              this.handleOrderUpdate(entity, eventType);
            } else if (entityType === "cashBalance" || entityType === "account") {
              this.handleAccountUpdate(entity, eventType, entityType);
            }
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
      console.log(`[TradovateWS-${this.brokerAccountId}] Position ${eventType.toLowerCase()}: ${entity.id}, total: ${this.currentPositions.length}`);
    } else if (eventType === "Deleted" || entity.archived) {
      this.currentPositions = this.currentPositions.filter(
        (p: any) => p.id !== entity.id && 
        !(p.accountId === entity.accountId && p.contractId === entity.contractId)
      );
      console.log(`[TradovateWS-${this.brokerAccountId}] Position deleted/archived: ${entity.id}`);
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
      
      console.log(`[TradovateWS-${this.brokerAccountId}] Order ${eventType.toLowerCase()}: ${entity.id}, status: ${entity.ordStatus || entity.status}`);
    } else if (eventType === "Deleted" || entity.archived) {
      this.currentOrders = this.currentOrders.filter((o: any) => o.id !== entity.id);
      console.log(`[TradovateWS-${this.brokerAccountId}] Order deleted/archived: ${entity.id}`);
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
      
      console.log(`[TradovateWS-${this.brokerAccountId}] Account cashBalance updated: ${accountId}`);
    } else if (entityType === "account") {
      const existingIndex = this.currentAccounts.findIndex((a: any) => a.accountId === entity.accountId || a.id === entity.id);
      
      if (existingIndex >= 0) {
        this.currentAccounts[existingIndex] = { ...this.currentAccounts[existingIndex], ...entity };
      } else {
        this.currentAccounts.push(entity);
      }
      
      console.log(`[TradovateWS-${this.brokerAccountId}] Account ${eventType.toLowerCase()}: ${entity.accountId || entity.id}`);
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
        });
        this.connections.set(tokens.id, connection);
        await connection.connect();
      }
    }

    // Start periodic aggregation if not already started
    if (!this.updateTimer) {
      this.startAggregation();
    }
    
    // Immediately trigger aggregation to notify listeners with current state
    this.aggregateAndNotify();
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
    // Aggregate and notify listeners every 100ms
    this.updateTimer = setInterval(() => {
      this.aggregateAndNotify();
    }, 100);
  }

  private aggregateAndNotify() {
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

    // Always notify listeners if they exist, even if arrays are empty
    // This ensures UI updates when positions/orders/accounts are cleared
    if (this.positionListeners.size > 0) {
      this.positionListeners.forEach((cb) => cb(allPositions));
    }
    if (this.orderListeners.size > 0) {
      this.orderListeners.forEach((cb) => cb(allOrders));
    }
    if (this.accountListeners.size > 0) {
      this.accountListeners.forEach((cb) => cb(allAccounts));
    }
  }

  onPositions(listener: PositionListener) {
    this.positionListeners.add(listener);
    return () => this.positionListeners.delete(listener);
  }

  onOrders(listener: OrderListener) {
    this.orderListeners.add(listener);
    return () => this.orderListeners.delete(listener);
  }

  onAccounts(listener: AccountListener) {
    this.accountListeners.add(listener);
    return () => this.accountListeners.delete(listener);
  }
}

export const tradovateWSMultiClient = new TradovateWSMultiClient();


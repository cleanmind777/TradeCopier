import { getWebSocketToken, getWebSocketTokenForGroup } from "../api/brokerApi";

type PositionUpdate = any; // TradovatePositionListResponse
type OrderUpdate = any; // TradovateOrderListResponse
type AccountUpdate = any; // TradovateAccountsResponse

type PositionListener = (positions: PositionUpdate[]) => void;
type OrderListener = (orders: OrderUpdate[]) => void;
type AccountListener = (accounts: AccountUpdate[]) => void;

export class TradovateWSClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: any = null;
  private reconnectTimer: any = null;
  private isConnecting = false;
  private userId: string | null = null;
  private groupId: string | null = null;
  private numericUserId: string | null = null; // Numeric user ID from JWT token for user/syncrequest
  private positionListeners = new Set<PositionListener>();
  private orderListeners = new Set<OrderListener>();
  private accountListeners = new Set<AccountListener>();
  private messageIdCounter = 10; // Start from 10 to avoid conflicts
  
  // Maintain current state for positions, orders, and accounts
  // These are updated incrementally from WebSocket events
  private currentPositions: PositionUpdate[] = [];
  private currentOrders: OrderUpdate[] = [];
  private currentAccounts: AccountUpdate[] = [];

  async connect(userId: string, groupId?: string) {
    // If already connecting, skip
    if (this.isConnecting) {
      console.log(`[TradovateWS] Already connecting, skipping (userId: ${userId}, groupId: ${groupId})`);
      return;
    }
    
    // If already connected with same userId and groupId, don't reconnect
    if (this.ws?.readyState === WebSocket.OPEN && this.userId === userId && this.groupId === (groupId || null)) {
      console.log(`[TradovateWS] Already connected with same userId and groupId, skipping (userId: ${userId}, groupId: ${groupId})`);
      return;
    }
    
    // If groupId changed, disconnect first
    if (this.ws?.readyState === WebSocket.OPEN && this.groupId !== (groupId || null)) {
      console.log(`[TradovateWS] GroupId changed from ${this.groupId} to ${groupId}, disconnecting first`);
      this.disconnect();
    }
    
    this.isConnecting = true;
    this.userId = userId;
    this.groupId = groupId || null;

    try {
      console.log(`[TradovateWS] Fetching token (userId: ${userId}, groupId: ${groupId})`);
      // If groupId is provided, get token for that group, otherwise use user_id
      const tokens = groupId 
        ? await getWebSocketTokenForGroup(groupId)
        : await getWebSocketToken(userId);
      if (!tokens?.access_token) {
        console.log(`[TradovateWS] No token received, aborting connection`);
        this.isConnecting = false;
        return;
      }
      console.log(`[TradovateWS] Token received, connecting WebSocket`);

      // Extract numeric user ID from JWT token for user/syncrequest
      // The JWT token contains the user ID in the 'sub' claim
      let numericUserId: string | null = null;
      try {
        const tokenParts = tokens.access_token.split('.');
        if (tokenParts.length >= 2) {
          // Decode the payload (second part of JWT)
          const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
          numericUserId = payload.sub || null;
          console.log(`[TradovateWS] Extracted numeric user ID from token: ${numericUserId}`);
        }
      } catch (e) {
        console.warn(`[TradovateWS] Could not extract user ID from token:`, e);
      }

      // Use account WebSocket endpoint for positions, orders, and accounts
      // Market data endpoint (wss://md.tradovateapi.com) is only for quotes
      // Account endpoints:
      //   - wss://live.tradovateapi.com/v1/websocket for live accounts
      //   - wss://demo.tradovateapi.com/v1/websocket for demo accounts
      const wsEndpoint = tokens.is_demo 
        ? "wss://demo.tradovateapi.com/v1/websocket"
        : "wss://live.tradovateapi.com/v1/websocket";
      console.log(`[TradovateWS] Connecting to ${tokens.is_demo ? 'demo' : 'live'} WebSocket endpoint: ${wsEndpoint}`);
      const ws = new WebSocket(wsEndpoint);
      this.ws = ws;

      ws.onopen = () => {
        try {
          const authMsg = `authorize\n1\n\n${tokens.access_token}`;
          ws.send(authMsg);
          this.scheduleHeartbeat();
          // Wait a bit for auth to complete, then subscribe
          setTimeout(() => {
            // Store numeric user ID for subscriptions
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
        console.error(`[TradovateWS] WebSocket error:`, error);
        // Only reconnect if not already connecting/reconnecting
        if (!this.isConnecting && !this.reconnectTimer) {
          this.reconnect();
        }
      };
      ws.onclose = (event) => {
        console.log(`[TradovateWS] WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
        // Only reconnect if not already connecting/reconnecting and not a normal closure
        if (event.code !== 1000 && !this.isConnecting && !this.reconnectTimer) {
          this.reconnect();
        }
      };
    } catch (error) {
      console.error(`[TradovateWS] Connection error:`, error);
      // Only reconnect if not already connecting/reconnecting
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
    this.groupId = null;
    this.numericUserId = null; // Clear numeric user ID on disconnect
    // Clear state on disconnect
    this.currentPositions = [];
    this.currentOrders = [];
    this.currentAccounts = [];
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

  subscribePositions() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    // Get numeric user ID from token (stored during connect)
    if (!this.numericUserId) {
      console.error(`[TradovateWS] Cannot subscribe to positions: numeric user ID not available`);
      return;
    }
    
    try {
      const id = this.messageIdCounter++;
      // Use user/syncrequest to subscribe to user data updates (positions, orders, accounts)
      // The userId should be the numeric user ID from the JWT token's 'sub' claim
      // Format: user/syncrequest\n{id}\n\n{"users": [userId]}
      const subscribeMsg = `user/syncrequest\n${id}\n\n{"users": [${this.numericUserId}]}`;
      console.log(`[TradovateWS] Subscribing to user data via user/syncrequest for numeric userId: ${this.numericUserId}`);
      this.ws.send(subscribeMsg);
    } catch (error) {
      console.error(`[TradovateWS] Error subscribing to positions:`, error);
      this.reconnect();
    }
  }

  subscribeOrders() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      // Orders are included in user/syncrequest, no separate subscription needed
      console.log(`[TradovateWS] Orders will be received via user/syncrequest`);
    } catch (error) {
      console.error(`[TradovateWS] Error subscribing to orders:`, error);
    }
  }

  subscribeAccounts() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      // Accounts are included in user/syncrequest, no separate subscription needed
      console.log(`[TradovateWS] Accounts will be received via user/syncrequest`);
    } catch (error) {
      console.error(`[TradovateWS] Error subscribing to accounts:`, error);
    }
  }

  private scheduleHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    this.heartbeatTimer = setTimeout(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      try { this.ws.send("[]"); } catch {}
      this.scheduleHeartbeat();
    }, 2500);
  }

  private reconnect() {
    if (this.reconnectTimer) {
      console.log("[TradovateWS] Reconnect already scheduled, skipping");
      return;
    }
    if (!this.userId) {
      console.log("[TradovateWS] No userId for reconnect, skipping");
      return;
    }
    console.log(`[TradovateWS] Scheduling reconnect in 1500ms (userId: ${this.userId}, groupId: ${this.groupId})`);
    this.disconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log(`[TradovateWS] Executing reconnect (userId: ${this.userId}, groupId: ${this.groupId})`);
      this.connect(this.userId!, this.groupId || undefined);
    }, 1500);
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
            // Authorization/command response (s=200 means success)
            if (item.s === 200 && item.i === 1) {
              // Auth successful, subscriptions will be sent in onopen
              console.log(`[TradovateWS] Authorization successful`);
            }
            return;
          }
          
          // Handle props events (entity updates from user/syncrequest)
          // Format: {"e":"props","d":{"entityType":"order","eventType":"Created","entity":{...}}}
          if (item.e === "props" && item.d) {
            const entityType = item.d.entityType;
            const eventType = item.d.eventType; // "Created", "Updated", "Deleted"
            const entity = item.d.entity;
            
            if (!entity) return;
            
            // Handle position updates
            if (entityType === "position") {
              this.handlePositionUpdate(entity, eventType);
            }
            // Handle order updates
            else if (entityType === "order") {
              this.handleOrderUpdate(entity, eventType);
            }
            // Handle account/cashBalance updates
            else if (entityType === "cashBalance" || entityType === "account") {
              this.handleAccountUpdate(entity, eventType, entityType);
            }
          }
          
          // Legacy format support (if we still receive these)
          // Positions updates (real-time and initial list)
          if (item.e === "position" && item.d) {
            const positions = Array.isArray(item.d) ? item.d : [item.d];
            console.log(`[TradovateWS] Received position update (legacy): ${positions.length} position(s)`);
            this.currentPositions = positions;
            this.positionListeners.forEach((cb) => cb(positions));
          }
          
          // Orders updates (real-time and initial list)
          if (item.e === "order" && item.d) {
            const orders = Array.isArray(item.d) ? item.d : [item.d];
            console.log(`[TradovateWS] Received order update (legacy): ${orders.length} order(s)`);
            this.currentOrders = orders;
            this.orderListeners.forEach((cb) => cb(orders));
          }
          
          // Accounts updates (real-time and initial list)
          if (item.e === "account" && item.d) {
            const accounts = Array.isArray(item.d) ? item.d : [item.d];
            console.log(`[TradovateWS] Received account update (legacy): ${accounts.length} account(s)`);
            this.currentAccounts = accounts;
            this.accountListeners.forEach((cb) => cb(accounts));
          }
        });
      } catch (error) {
        console.error(`[TradovateWS] Error parsing message:`, error);
      }
    } else if (frameType === "h") {
      // Heartbeat - respond with empty array
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("[]");
      }
    }
  }

  private handlePositionUpdate(entity: any, eventType: string) {
    if (eventType === "Created" || eventType === "Updated") {
      // Find existing position by id or accountId+contractId
      const existingIndex = this.currentPositions.findIndex(
        (p: any) => p.id === entity.id || 
        (p.accountId === entity.accountId && p.contractId === entity.contractId)
      );
      
      if (existingIndex >= 0) {
        // Update existing position
        this.currentPositions[existingIndex] = { ...this.currentPositions[existingIndex], ...entity };
      } else {
        // Add new position
        this.currentPositions.push(entity);
      }
      
      // Remove archived positions
      this.currentPositions = this.currentPositions.filter((p: any) => !p.archived);
      
      console.log(`[TradovateWS] Position ${eventType.toLowerCase()}: ${entity.id}, total positions: ${this.currentPositions.length}`);
      this.positionListeners.forEach((cb) => cb([...this.currentPositions]));
    } else if (eventType === "Deleted" || entity.archived) {
      // Remove position
      this.currentPositions = this.currentPositions.filter(
        (p: any) => p.id !== entity.id && 
        !(p.accountId === entity.accountId && p.contractId === entity.contractId)
      );
      console.log(`[TradovateWS] Position deleted/archived: ${entity.id}, total positions: ${this.currentPositions.length}`);
      this.positionListeners.forEach((cb) => cb([...this.currentPositions]));
    }
  }

  private handleOrderUpdate(entity: any, eventType: string) {
    if (eventType === "Created" || eventType === "Updated") {
      // Find existing order by id
      const existingIndex = this.currentOrders.findIndex((o: any) => o.id === entity.id);
      
      if (existingIndex >= 0) {
        // Update existing order
        this.currentOrders[existingIndex] = { ...this.currentOrders[existingIndex], ...entity };
      } else {
        // Add new order
        this.currentOrders.push(entity);
      }
      
      // Remove archived or filled orders that are no longer active
      // Keep orders that are still pending or working
      this.currentOrders = this.currentOrders.filter((o: any) => {
        if (o.archived) return false;
        // Keep orders that are not filled or cancelled
        const status = o.ordStatus || o.status;
        return status !== "Filled" && status !== "Cancelled" && status !== "Rejected";
      });
      
      console.log(`[TradovateWS] Order ${eventType.toLowerCase()}: ${entity.id}, status: ${entity.ordStatus || entity.status}, total orders: ${this.currentOrders.length}`);
      this.orderListeners.forEach((cb) => cb([...this.currentOrders]));
    } else if (eventType === "Deleted" || entity.archived) {
      // Remove order
      this.currentOrders = this.currentOrders.filter((o: any) => o.id !== entity.id);
      console.log(`[TradovateWS] Order deleted/archived: ${entity.id}, total orders: ${this.currentOrders.length}`);
      this.orderListeners.forEach((cb) => cb([...this.currentOrders]));
    }
  }

  private handleAccountUpdate(entity: any, eventType: string, entityType: string) {
    if (entityType === "cashBalance") {
      // cashBalance updates affect accounts - find account by accountId
      const accountId = entity.accountId;
      const existingIndex = this.currentAccounts.findIndex((a: any) => a.accountId === accountId);
      
      if (existingIndex >= 0) {
        // Update account with new cash balance
        this.currentAccounts[existingIndex] = {
          ...this.currentAccounts[existingIndex],
          amount: entity.amount,
          realizedPnL: entity.realizedPnL,
          weekRealizedPnL: entity.weekRealizedPnL,
        };
      } else {
        // Create new account entry from cashBalance
        this.currentAccounts.push({
          accountId: accountId,
          amount: entity.amount,
          realizedPnL: entity.realizedPnL,
          weekRealizedPnL: entity.weekRealizedPnL,
        });
      }
      
      console.log(`[TradovateWS] Account cashBalance updated: ${accountId}, amount: ${entity.amount}`);
      this.accountListeners.forEach((cb) => cb([...this.currentAccounts]));
    } else if (entityType === "account") {
      // Direct account updates
      const existingIndex = this.currentAccounts.findIndex((a: any) => a.accountId === entity.accountId || a.id === entity.id);
      
      if (existingIndex >= 0) {
        this.currentAccounts[existingIndex] = { ...this.currentAccounts[existingIndex], ...entity };
      } else {
        this.currentAccounts.push(entity);
      }
      
      console.log(`[TradovateWS] Account ${eventType.toLowerCase()}: ${entity.accountId || entity.id}`);
      this.accountListeners.forEach((cb) => cb([...this.currentAccounts]));
    }
  }
}

export const tradovateWSClient = new TradovateWSClient();



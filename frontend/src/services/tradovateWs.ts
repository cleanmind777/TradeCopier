import { getWebSocketToken, getWebSocketTokenForGroup } from "../api/brokerApi";

type QuoteUpdate = {
  symbol?: string;
  bid?: number;
  ask?: number;
  last?: number;
  timestamp?: string;
};

type QuoteListener = (quote: QuoteUpdate) => void;

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
  private quoteListeners = new Set<QuoteListener>();
  private positionListeners = new Set<PositionListener>();
  private orderListeners = new Set<OrderListener>();
  private accountListeners = new Set<AccountListener>();
  private messageIdCounter = 10; // Start from 10 to avoid conflicts

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

      const ws = new WebSocket("wss://md.tradovateapi.com/v1/websocket");
      this.ws = ws;

      ws.onopen = () => {
        try {
          const authMsg = `authorize\n1\n\n${tokens.access_token}`;
          ws.send(authMsg);
          this.scheduleHeartbeat();
          // Wait a bit for auth to complete, then subscribe
          setTimeout(() => {
            this.subscribePositions();
            this.subscribeOrders();
            this.subscribeAccounts();
            // Resubscribe to all previously subscribed symbols
            const symbolsToResubscribe = Array.from(this.subscribedSymbols);
            this.subscribedSymbols.clear(); // Clear first to allow resubscription
            symbolsToResubscribe.forEach(symbol => {
              this.subscribeQuotes(symbol);
            });
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
    // Don't clear subscribedSymbols on disconnect - we'll resubscribe on reconnect
  }

  onQuote(listener: QuoteListener) {
    this.quoteListeners.add(listener);
    return () => this.quoteListeners.delete(listener);
  }

  private subscribedSymbols = new Set<string>();

  subscribeQuotes(symbol: string): boolean {
    if (!this.ws) {
      // If WebSocket doesn't exist, try to connect first
      if (this.userId) {
        this.connect(this.userId, this.groupId || undefined);
      }
      return false;
    }
    
    if (this.ws.readyState !== WebSocket.OPEN) {
      // If WebSocket is connecting, caller should retry
      return false;
    }
    
    try {
      // Only subscribe if not already subscribed
      if (this.subscribedSymbols.has(symbol)) {
        return true; // Already subscribed
      }
      
      const id = this.messageIdCounter++;
      const subscribeMsg = `md/subscribeQuote\n${id}\n\n${JSON.stringify({ symbol })}`;
      this.ws.send(subscribeMsg);
      this.subscribedSymbols.add(symbol);
      console.log(`[TradovateWS] Subscribed to quotes for: ${symbol}`);
      return true;
    } catch (error) {
      console.error(`[TradovateWS] Error subscribing to ${symbol}:`, error);
      this.reconnect();
      return false;
    }
  }

  unsubscribeQuotes(symbol: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      if (!this.subscribedSymbols.has(symbol)) return;
      
      const id = this.messageIdCounter++;
      const unsubscribeMsg = `md/unsubscribeQuote\n${id}\n\n${JSON.stringify({ symbol })}`;
      this.ws.send(unsubscribeMsg);
      this.subscribedSymbols.delete(symbol);
    } catch {
      // Ignore errors
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

  subscribePositions() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const id = this.messageIdCounter++;
      const subscribeMsg = `position/list\n${id}\n\n{}`;
      this.ws.send(subscribeMsg);
    } catch {
      this.reconnect();
    }
  }

  subscribeOrders() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const id = this.messageIdCounter++;
      const subscribeMsg = `order/list\n${id}\n\n{}`;
      this.ws.send(subscribeMsg);
    } catch {
      this.reconnect();
    }
  }

  subscribeAccounts() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const id = this.messageIdCounter++;
      const subscribeMsg = `account/list\n${id}\n\n{}`;
      this.ws.send(subscribeMsg);
    } catch {
      this.reconnect();
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
            }
            return;
          }
          
          // Market data quotes
          if (item.e === "md" && item.d?.quotes) {
            const quote = item.d.quotes[0];
            const entries = quote.entries || {};
            const bidData = entries.Bid || {};
            const askData = entries.Offer || {};
            const tradeData = entries.Trade || {};

            const update: QuoteUpdate = {
              symbol: quote.symbol || item.d.symbol || item.d.contract?.symbol || undefined,
              bid: bidData.price ?? undefined,
              ask: askData.price ?? undefined,
              last: tradeData.price ?? undefined,
              timestamp: quote.timestamp ?? undefined,
            };
            // Only notify listeners if we have at least one price value
            if (update.bid !== undefined || update.ask !== undefined || update.last !== undefined) {
              this.quoteListeners.forEach((cb) => cb(update));
            }
          }
          
          // Positions updates (real-time and initial list)
          if (item.e === "position" && item.d) {
            const positions = Array.isArray(item.d) ? item.d : [item.d];
            console.log(`[TradovateWS] Received position update: ${positions.length} position(s)`);
            this.positionListeners.forEach((cb) => cb(positions));
          }
          
          // Orders updates (real-time and initial list)
          if (item.e === "order" && item.d) {
            const orders = Array.isArray(item.d) ? item.d : [item.d];
            console.log(`[TradovateWS] Received order update: ${orders.length} order(s)`);
            this.orderListeners.forEach((cb) => cb(orders));
          }
          
          // Accounts updates (real-time and initial list)
          if (item.e === "account" && item.d) {
            const accounts = Array.isArray(item.d) ? item.d : [item.d];
            console.log(`[TradovateWS] Received account update: ${accounts.length} account(s)`);
            this.accountListeners.forEach((cb) => cb(accounts));
          }
          
          // List responses (initial data from position/list, order/list, account/list)
          // These come without an event type, so we detect them by structure
          if (!item.e && item.d && typeof item.d === 'object') {
            // Check if it's a list response by looking for array data
            if (Array.isArray(item.d)) {
              // Could be positions, orders, or accounts list
              // We'll check the first item to determine type
              if (item.d.length > 0) {
                const first = item.d[0];
                if (first.accountId !== undefined && first.netPos !== undefined) {
                  // Positions list
                  console.log(`[TradovateWS] Received positions list: ${item.d.length} position(s)`);
                  this.positionListeners.forEach((cb) => cb(item.d));
                } else if (first.accountId !== undefined && first.ordStatus !== undefined) {
                  // Orders list
                  console.log(`[TradovateWS] Received orders list: ${item.d.length} order(s)`);
                  this.orderListeners.forEach((cb) => cb(item.d));
                } else if (first.accountId !== undefined && first.amount !== undefined) {
                  // Accounts list
                  console.log(`[TradovateWS] Received accounts list: ${item.d.length} account(s)`);
                  this.accountListeners.forEach((cb) => cb(item.d));
                }
              }
            }
          }
        });
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    } else if (frameType === "h") {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try { this.ws.send("[]"); } catch {}
      }
    }
  }
}

export const tradovateWSClient = new TradovateWSClient();



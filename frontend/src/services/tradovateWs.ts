import { getWebSocketToken } from "../api/brokerApi";

type QuoteUpdate = {
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
  private quoteListeners = new Set<QuoteListener>();
  private positionListeners = new Set<PositionListener>();
  private orderListeners = new Set<OrderListener>();
  private accountListeners = new Set<AccountListener>();
  private messageIdCounter = 10; // Start from 10 to avoid conflicts

  async connect(userId: string) {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.isConnecting = true;
    this.userId = userId;

    try {
      const tokens = await getWebSocketToken(userId);
      if (!tokens?.access_token) {
        this.isConnecting = false;
        return;
      }

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
          }, 500);
        } catch {
          this.reconnect();
        }
      };

      ws.onmessage = (evt) => this.handleMessage(evt);
      ws.onerror = () => this.reconnect();
      ws.onclose = () => this.reconnect();
    } catch {
      this.reconnect();
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
  }

  onQuote(listener: QuoteListener) {
    this.quoteListeners.add(listener);
    return () => this.quoteListeners.delete(listener);
  }

  subscribeQuotes(symbol: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const subscribeMsg = `md/subscribeQuote\n2\n\n${JSON.stringify({ symbol })}`;
      this.ws.send(subscribeMsg);
    } catch {
      this.reconnect();
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
    if (this.reconnectTimer) return;
    this.disconnect();
    if (!this.userId) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.userId!);
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
              bid: bidData.price ?? undefined,
              ask: askData.price ?? undefined,
              last: tradeData.price ?? undefined,
              timestamp: quote.timestamp ?? undefined,
            };
            this.quoteListeners.forEach((cb) => cb(update));
          }
          
          // Positions updates
          if (item.e === "position" && item.d) {
            const positions = Array.isArray(item.d) ? item.d : [item.d];
            this.positionListeners.forEach((cb) => cb(positions));
          }
          
          // Orders updates
          if (item.e === "order" && item.d) {
            const orders = Array.isArray(item.d) ? item.d : [item.d];
            this.orderListeners.forEach((cb) => cb(orders));
          }
          
          // Accounts updates
          if (item.e === "account" && item.d) {
            const accounts = Array.isArray(item.d) ? item.d : [item.d];
            this.accountListeners.forEach((cb) => cb(accounts));
          }
          
          // List responses (initial data)
          if (item.d && typeof item.d === 'object') {
            // Check if it's a list response by looking for array data
            if (Array.isArray(item.d)) {
              // Could be positions, orders, or accounts list
              // We'll check the first item to determine type
              if (item.d.length > 0) {
                const first = item.d[0];
                if (first.accountId !== undefined && first.netPos !== undefined) {
                  // Positions
                  this.positionListeners.forEach((cb) => cb(item.d));
                } else if (first.accountId !== undefined && first.ordStatus !== undefined) {
                  // Orders
                  this.orderListeners.forEach((cb) => cb(item.d));
                } else if (first.accountId !== undefined && first.amount !== undefined) {
                  // Accounts
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



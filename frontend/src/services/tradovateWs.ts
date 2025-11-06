import { getWebSocketToken } from "../api/brokerApi";

type QuoteUpdate = {
  bid?: number;
  ask?: number;
  last?: number;
  timestamp?: string;
};

type QuoteListener = (quote: QuoteUpdate) => void;

export class TradovateWSClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: any = null;
  private reconnectTimer: any = null;
  private isConnecting = false;
  private userId: string | null = null;
  private quoteListeners = new Set<QuoteListener>();

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
            // Authorization/command response
            return;
          }
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
        });
      } catch {
        // ignore parse errors
      }
    } else if (frameType === "h") {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try { this.ws.send("[]"); } catch {}
      }
    }
  }
}

export const tradovateWSClient = new TradovateWSClient();



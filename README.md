# TradeCopier

A web app for group trading and copying orders across sub-accounts, with real-time market data, PnL monitoring, and Tradovate integration.

## Features
- Group-based order routing (market/limit, optional SL/TP)
- Real-time quotes via Tradovate WebSocket and server-sent events (SSE)
- Live PnL stream and dashboard
- Account, order, and position syncing

## Getting Started

### Prerequisites
- Node.js 18+ and npm (or pnpm/yarn) for the frontend
- A running backend exposing the required endpoints
- A Tradovate account and API access configured on the backend

### Environment
Frontend uses the following env var:

```
VITE_BACKEND_URL=<http(s)://your-backend-host[:port]>
```

If omitted, it defaults to `http://localhost:8000` (or `http://localhost:8000/api/v1` where applicable in API modules).

Create `frontend/.env` (or `.env.local`) and set:

```
VITE_BACKEND_URL=http://localhost:8000
```

### Install & Run

From the repository root:

```
cd frontend
npm install
npm run dev
```

Backend: see `backend/` for its own setup and run instructions.

## Real-time Data

### Quotes (WebSocket)
We integrated a lightweight Tradovate WebSocket client used by `frontend/src/pages/TradingPage.tsx` to stream quote updates for the active symbol.

- Client implementation: `frontend/src/services/tradovateWs.ts`
- It fetches an access token via `getWebSocketToken` (frontend calls your backend), then connects to `wss://md.tradovateapi.com/v1/websocket` and authorizes.
- It maintains heartbeats and auto-reconnects and exposes:
  - `connect(userId)`
  - `subscribeQuotes(symbol)`
  - `onQuote(listener)`

`TradingPage.tsx` calls `tradovateWSClient.connect(user_id)` and subscribes to the current `symbol`, updating `currentPrice` on incoming quotes.

Reference: `tradovate/example-api-js – tutorial/WebSockets`
https://github.com/tradovate/example-api-js/tree/main/tutorial/WebSockets

### PnL and Price Snapshot (SSE)
The app also uses backend SSE endpoints for PnL and current-price streams as a complementary data source and fallback:

- `GET {VITE_BACKEND_URL}/databento/sse/pnl?user_id=<id>`
- `POST {VITE_BACKEND_URL}/databento/sse/current-price` then `GET` with EventSource
- `GET {VITE_BACKEND_URL}/databento/market-status` and `GET {VITE_BACKEND_URL}/databento/historical` for market-open checks and snapshots

Ensure your backend exposes these endpoints and is configured with necessary market data credentials.

## Required Backend Endpoints
Frontend expects the following (non-exhaustive):

- Broker/account data:
  - `GET /api/v1/broker/positions`
  - `GET /api/v1/broker/orders`
  - `GET /api/v1/broker/accounts`
- Order execution:
  - `POST /api/v1/broker/execute-order/market`
  - `POST /api/v1/broker/execute-order/limit`
  - `POST /api/v1/broker/execute-order/limitwithsltp`
- Tradovate tokens:
  - `GET /api/v1/broker/websockettoken`
- Market data (if using SSE/DataBento-like services):
  - `GET /databento/market-status`
  - `GET /databento/historical`
  - `POST /databento/sse/current-price`
  - `GET /databento/sse/pnl`

Adjust base paths if your backend differs.

## Troubleshooting
- No quotes updating:
  - Verify `VITE_BACKEND_URL` and that `GET /api/v1/broker/websockettoken` returns an access token.
  - Confirm your backend has valid Tradovate credentials and market data permissions.
- SSE not connecting:
  - Check CORS and cookies; frontend sets `axios.defaults.withCredentials = true`.
  - Ensure backend SSE endpoints are reachable and not blocked by a proxy.
- Symbols not found / market closed:
  - The UI falls back to a historical snapshot and marks the price stream idle if market is closed or API key is missing.

## License
Proprietary (update as appropriate).

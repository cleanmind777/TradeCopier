import React, { useState, useEffect } from "react";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { Card, CardContent, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../components/ui/Table";
import { Trash2, Activity, Package, CreditCard } from "lucide-react";
import {
  ExitPostion,
  TradovateAccountsResponse,
  TradovateOrderListResponse,
  TradovatePositionListResponse,
} from "../types/broker";
import {
  getPositions,
  getOrders,
  getAccounts,
  exitPostion,
  exitAllPostions,
} from "../api/brokerApi";

type SortDirection = "asc" | "desc";

interface SortConfig {
  key: string;
  direction: SortDirection;
}

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "positions" | "orders" | "accounts"
  >("positions");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [positions, setPositions] = useState<TradovatePositionListResponse[]>(
    []
  );

  const [orders, setOrders] = useState<TradovateOrderListResponse[]>([]);

  const [accounts, setAccounts] = useState<TradovateAccountsResponse[]>([]);

  const [positionsSort, setPositionsSort] = useState<SortConfig | null>(null);
  const [ordersSort, setOrdersSort] = useState<SortConfig | null>(null);
  const [accountsSort, setAccountsSort] = useState<SortConfig | null>(null);

  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  const fetchPositions = async () => {
    const positionData = await getPositions(user_id);
    if (positionData != null) {
      setPositions(positionData);
    }
  };

  const fetchOrders = async () => {
    const orderData = await getOrders(user_id);
    if (orderData != null) {
      setOrders(orderData);
    }
  };

  const fetchAccounts = async () => {
    const accountData = await getAccounts(user_id);
    if (accountData != null) {
      setAccounts(accountData);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [user_id]);

  useEffect(() => {
    fetchOrders();
  }, [user_id]);

  useEffect(() => {
    fetchAccounts();
  }, [user_id]);

  // General sorting utility for array of objects
  const sortData = <T,>(
    data: T[],
    key: string,
    direction: SortDirection
  ): T[] => {
    return [...data].sort((a: any, b: any) => {
      const aValue = a[key];
      const bValue = b[key];

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return direction === "asc"
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      const aStr = aValue.toString().toLowerCase();
      const bStr = bValue.toString().toLowerCase();

      if (aStr < bStr) return direction === "asc" ? -1 : 1;
      if (aStr > bStr) return direction === "asc" ? 1 : -1;
      return 0;
    });
  };

  // Handle sorting toggles for each tab
  const handleSortPositions = (key: string) => {
    let direction: SortDirection = "asc";
    if (
      positionsSort &&
      positionsSort.key === key &&
      positionsSort.direction === "asc"
    ) {
      direction = "desc";
    }
    setPositionsSort({ key, direction });
    setPositions((prev) => sortData(prev, key, direction));
  };

  const handleSortOrders = (key: string) => {
    let direction: SortDirection = "asc";
    if (
      ordersSort &&
      ordersSort.key === key &&
      ordersSort.direction === "asc"
    ) {
      direction = "desc";
    }
    setOrdersSort({ key, direction });
    setOrders((prev) => sortData(prev, key, direction));
  };

  const handleSortAccounts = (key: string) => {
    let direction: SortDirection = "asc";
    if (
      accountsSort &&
      accountsSort.key === key &&
      accountsSort.direction === "asc"
    ) {
      direction = "desc";
    }
    setAccountsSort({ key, direction });
    setAccounts((prev) => sortData(prev, key, direction));
  };

  const handleExitPosition = async (
    accountId: number,
    symbol: string,
    netPos: number
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      let action = "Buy";
      if (netPos > 0) {
        action = "Sell";
      }

      let exitPostionData = {
        accountId: accountId,
        action: action,
        symbol: symbol,
        orderQty: Math.abs(netPos),
        orderType: "Market",
        isAutomated: true,
      };
      await exitPostion(exitPostionData);
      await fetchPositions();
    } catch (err) {
      setError("Failed to exit position");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlattenAll = async () => {
    try {
      setIsLoading(true);
      setError(null);
      let exitPostions: ExitPostion[] = [];

      positions.forEach((position) => {
        let action = "Buy";
        if (position.netPos > 0) action = "Sell";
        const exitPostion = {
          accountId: position.accountId,
          action: action,
          symbol: position.symbol,
          orderQty: Math.abs(position.netPos),
          orderType: "Market",
          isAutomated: true,
        };
        exitPostions.push(exitPostion);
      });
      await exitAllPostions(exitPostions);
      await fetchPositions();
    } catch (err) {
      setError("Failed to flatten all positions and orders");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for rendering sort arrows
  const renderSortArrow = (sortConfig: SortConfig | null, key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === "asc" ? (
      <span aria-label="sorted ascending"> ▲</span>
    ) : (
      <span aria-label="sorted descending"> ▼</span>
    );
  };

  return (
    <div className="flex bg-gradient-to-b from-slate-50 to-slate-100 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-8 space-y-8">
          {/* Global Action Button */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={handleFlattenAll}
              disabled={isLoading}
              className="flex items-center space-x-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Trash2 className="h-4 w-4" />
              <span>Flatten All / Exit All & Cancel All</span>
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative shadow-sm">
              <span className="block sm:inline">{error}</span>
              <button
                onClick={() => setError(null)}
                className="absolute top-0 right-0 px-4 py-3 hover:text-red-900 transition-colors"
                aria-label="Close error message"
              >
                &times;
              </button>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex border-b border-slate-200 bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab("positions")}
              className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-md transition-all ${
                activeTab === "positions"
                  ? "bg-blue-50 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Activity className="mr-2 h-4 w-4" />
              Positions
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-md transition-all ${
                activeTab === "orders"
                  ? "bg-blue-50 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Package className="mr-2 h-4 w-4" />
              Orders
            </button>
            <button
              onClick={() => setActiveTab("accounts")}
              className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-md transition-all ${
                activeTab === "accounts"
                  ? "bg-blue-50 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Accounts
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}

          {/* Positions Tab */}
          {!isLoading && activeTab === "positions" && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">
                  Open Positions
                </h3>
                <p className="text-sm text-slate-500">
                  All active positions across accounts
                </p>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No open positions
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortPositions("accountNickname")}
                          >
                            Account{renderSortArrow(positionsSort, "accountNickname")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortPositions("accountDisplayName")}
                          >
                            Display Name{renderSortArrow(positionsSort, "accountDisplayName")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortPositions("symbol")}
                          >
                            Symbol{renderSortArrow(positionsSort, "symbol")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortPositions("netPos")}
                          >
                            Net Position{renderSortArrow(positionsSort, "netPos")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortPositions("netPrice")}
                          >
                            Net Price{renderSortArrow(positionsSort, "netPrice")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortPositions("bought")}
                          >
                            Bought{renderSortArrow(positionsSort, "bought")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortPositions("sold")}
                          >
                            Sold{renderSortArrow(positionsSort, "sold")}
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((position) => (
                          <TableRow
                            key={position.id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {position.accountNickname}
                            </TableCell>
                            <TableCell className="font-medium">
                              {position.accountDisplayName}
                            </TableCell>
                            <TableCell>{position.symbol}</TableCell>
                            <TableCell className="text-right">{position.netPos}</TableCell>
                            <TableCell className="text-right">
                              ${position.netPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">{position.bought}</TableCell>
                            <TableCell className="text-right">{position.sold}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleExitPosition(
                                    position.accountId,
                                    position.symbol,
                                    position.netPos
                                  )
                                }
                                disabled={isLoading}
                                className="hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                Exit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Orders Tab */}
          {!isLoading && activeTab === "orders" && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">Orders</h3>
                <p className="text-sm text-slate-500">
                  Working orders and execution history
                </p>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No orders found
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("accountNickname")}
                          >
                            Account{renderSortArrow(ordersSort, "accountNickname")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("accountDisplayName")}
                          >
                            Display Name{renderSortArrow(ordersSort, "accountDisplayName")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("symbol")}
                          >
                            Symbol{renderSortArrow(ordersSort, "symbol")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("action")}
                          >
                            Action{renderSortArrow(ordersSort, "action")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("ordStatus")}
                          >
                            Status{renderSortArrow(ordersSort, "ordStatus")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("timestamp")}
                          >
                            Timestamp{renderSortArrow(ordersSort, "timestamp")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortOrders("price")}
                          >
                            Price{renderSortArrow(ordersSort, "price")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow
                            key={order.id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {order.accountNickname}
                            </TableCell>
                            <TableCell className="font-medium">
                              {order.accountDisplayName}
                            </TableCell>
                            <TableCell>{order.symbol}</TableCell>
                            <TableCell>{order.action}</TableCell>
                            <TableCell>
                              <span
                                className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                  order.ordStatus === "Filled"
                                    ? "bg-green-100 text-green-800"
                                    : order.ordStatus === "Working"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {order.ordStatus}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(order.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell>{order.price}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Accounts Tab */}
          {!isLoading && activeTab === "accounts" && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">Accounts</h3>
                <p className="text-sm text-slate-500">
                  Performance and account management
                </p>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No accounts found
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortAccounts("accountNickname")}
                          >
                            Account{renderSortArrow(accountsSort, "accountNickname")}
                          </TableHead>
                          <TableHead
                            className="font-semibold cursor-pointer"
                            onClick={() => handleSortAccounts("accountDisplayName")}
                          >
                            Display Name{renderSortArrow(accountsSort, "accountDisplayName")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortAccounts("amount")}
                          >
                            Amount{renderSortArrow(accountsSort, "amount")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortAccounts("realizedPnL")}
                          >
                            Realized P&L{renderSortArrow(accountsSort, "realizedPnL")}
                          </TableHead>
                          <TableHead
                            className="font-semibold text-right cursor-pointer"
                            onClick={() => handleSortAccounts("weekRealizedPnL")}
                          >
                            Week P&L{renderSortArrow(accountsSort, "weekRealizedPnL")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account) => (
                          <TableRow
                            key={account.id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <TableCell className="font-medium">
                              {account.accountNickname}
                            </TableCell>
                            <TableCell className="font-medium">
                              {account.accountDisplayName}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                account.amount >= 0 ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              ${account.amount.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                account.realizedPnL >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              ${account.realizedPnL.toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                account.weekRealizedPnL >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              ${account.weekRealizedPnL.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default DashboardPage;

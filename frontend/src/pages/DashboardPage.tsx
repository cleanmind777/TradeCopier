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
} from "../api/brokerApi";

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "positions" | "orders" | "accounts"
  >("positions");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data - replace with real API calls
  const [positions, setPositions] = useState<TradovatePositionListResponse[]>(
    []
  );

  const [orders, setOrders] = useState<TradovateOrderListResponse[]>([]);

  const [accounts, setAccounts] = useState<TradovateAccountsResponse[]>([]);
  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;
  const fetchPositions = async () => {
      const positionData = await getPositions(user_id);
      if (positionData != null) {
        setPositions(positionData);
      }
    };
  useEffect(() => {
    
    fetchPositions();
  }, [user_id]);

  useEffect(() => {
    const fetchOrders = async () => {
      const orderData = await getOrders(user_id);
      if (orderData != null) {
        setOrders(orderData);
      }
    };
    fetchOrders();
  }, [user_id]);

  useEffect(() => {
    const fetchAccounts = async () => {
      const accountData = await getAccounts(user_id);
      if (accountData != null) {
        setAccounts(accountData);
      }
    };
    fetchAccounts();
  }, [user_id]);

  const handleExitPosition = async (
    accountId: number,
    symbol: string,
    netPos: number
  ) => {
    try {
      let action = "Buy";
      if (netPos > 0) {
        action = "Sell";
      }

      let exitPostionData = {
        accountId: accountId,
        action: action,
        symbol: symbol,
        orderQty: Math.abs(netPos), // absolute value of netPos
        orderType: "Market",
        isAutomated: true,
      };
      exitPostion(exitPostionData);
      fetchPositions();
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      
    } catch (err) {
      setError("Failed to exit position");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlattenAccount = async (accountId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      console.log("Flattening account:", accountId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPositions((prev) => prev.filter((p) => p.accountId !== accountId));
    } catch (err) {
      setError("Failed to flatten account");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitAll = async (accountId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      console.log("Exiting all positions for account:", accountId);
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPositions((prev) => prev.filter((p) => p.accountId !== accountId));
    } catch (err) {
      setError("Failed to exit all positions");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlattenAll = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      console.log("Flattening all positions and canceling all orders");
      await new Promise((resolve) => setTimeout(resolve, 500));
      setPositions([]);
      setOrders((prev) =>
        prev.map((order) => ({ ...order, ordStatus: "Cancelled" }))
      );
    } catch (err) {
      setError("Failed to flatten all positions and orders");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
                          <TableHead className="font-semibold">
                            Account
                          </TableHead>
                          <TableHead className="font-semibold">
                            Symbol
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Net Position
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Net Price
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Bought
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Sold
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
                            <TableCell>{position.symbol}</TableCell>
                            <TableCell className="text-right">
                              {position.netPos}
                            </TableCell>
                            <TableCell className="text-right">
                              ${position.netPrice.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {position.bought}
                            </TableCell>
                            <TableCell className="text-right">
                              {position.sold}
                            </TableCell>
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
                          <TableHead className="font-semibold">
                            Account
                          </TableHead>
                          <TableHead className="font-semibold">
                            Symbol
                          </TableHead>
                          <TableHead className="font-semibold">
                            Action
                          </TableHead>
                          <TableHead className="font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="font-semibold">
                            Timestamp
                          </TableHead>
                          <TableHead className="font-semibold">
                            External
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
                              {order.timestamp.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {order.external ? "Yes" : "No"}
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

          {/* Accounts Tab */}
          {!isLoading && activeTab === "accounts" && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">
                  Accounts
                </h3>
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
                          <TableHead className="font-semibold">
                            Account
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Amount
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Realized P&L
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Week P&L
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Actions
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
                            <TableCell
                              className={`text-right font-medium ${
                                account.amount >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
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
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleFlattenAccount(account.id)
                                  }
                                  disabled={isLoading}
                                  className="hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                >
                                  Flatten
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                  onClick={() => handleExitAll(account.id)}
                                  disabled={isLoading}
                                >
                                  Exit All
                                </Button>
                              </div>
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

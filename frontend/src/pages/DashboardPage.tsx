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
import { Trash2, Activity, Package, CreditCard, ArrowUpDown } from "lucide-react";
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
  exitAllPostions
} from "../api/brokerApi";

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "positions" | "orders" | "accounts"
  >("positions");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<TradovatePositionListResponse[]>([]);
  const [orders, setOrders] = useState<TradovateOrderListResponse[]>([]);
  const [accounts, setAccounts] = useState<TradovateAccountsResponse[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: '',
    direction: 'asc',
  });

  const user = localStorage.getItem("user");
  const user_id = user ? JSON.parse(user).id : null;

  const sortData = (data: any[], key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });

    return [...data].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

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
      exitPostion(exitPostionData);
      fetchPositions();
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
      let exitPostions: ExitPostion[] = []
      
      positions.forEach((position) => {
        let action = "Buy"
        if (position.netPos > 0) action = "Sell";
        const exitPostion = {
          accountId: position.accountId,
          action: action,
          symbol: position.symbol,
          orderQty: Math.abs(position.netPos),
          orderType: "Market",
          isAutomated: true
        }
        exitPostions.push(exitPostion)
      });
      exitAllPostions(exitPostions)
      fetchPositions()
      
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

          {isLoading && (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}

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
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(positions, 'accountNickname')}>
                            <div className="flex items-center">
                              Account
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(positions, 'accountDisplayName')}>
                            <div className="flex items-center">
                              Display Name
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(positions, 'symbol')}>
                            <div className="flex items-center">
                              Symbol
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(positions, 'netPos')}>
                            <div className="flex items-center justify-end">
                              Net Position
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(positions, 'netPrice')}>
                            <div className="flex items-center justify-end">
                              Net Price
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(positions, 'bought')}>
                            <div className="flex items-center justify-end">
                              Bought
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(positions, 'sold')}>
                            <div className="flex items-center justify-end">
                              Sold
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortData(positions, sortConfig.key).map((position) => (
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
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'accountNickname')}>
                            <div className="flex items-center">
                              Account
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'accountDisplayName')}>
                            <div className="flex items-center">
                              Display Name
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'symbol')}>
                            <div className="flex items-center">
                              Symbol
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'action')}>
                            <div className="flex items-center">
                              Action
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'ordStatus')}>
                            <div className="flex items-center">
                              Status
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'timestamp')}>
                            <div className="flex items-center">
                              Timestamp
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(orders, 'price')}>
                            <div className="flex items-center">
                              Price
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortData(orders, sortConfig.key).map((order) => (
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
                              {order.timestamp.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {order.price}
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
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(accounts, 'accountNickname')}>
                            <div className="flex items-center">
                              Account
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold cursor-pointer" onClick={() => sortData(accounts, 'accountDisplayName')}>
                            <div className="flex items-center">
                              Display Name
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(accounts, 'amount')}>
                            <div className="flex items-center justify-end">
                              Amount
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(accounts, 'realizedPnL')}>
                            <div className="flex items-center justify-end">
                              Realized P&L
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-right cursor-pointer" onClick={() => sortData(accounts, 'weekRealizedPnL')}>
                            <div className="flex items-center justify-end">
                              Week P&L
                              <ArrowUpDown className="ml-1 h-4 w-4" />
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortData(accounts, sortConfig.key).map((account) => (
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
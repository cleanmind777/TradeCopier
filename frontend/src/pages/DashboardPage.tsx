import React, { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import  Button  from '../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { Trash2, Activity, Package, CreditCard } from 'lucide-react';

type Position = {
  id: number;
  account: string;
  symbol: string;
  quantity: number;
  price: number;
  pnl: number;
};

type Order = {
  id: number;
  account: string;
  symbol: string;
  type: string;
  quantity: number;
  price: number;
  status: 'Working' | 'Filled' | 'Cancelled';
};

type Account = {
  id: number;
  account: string;
  realizedPnl: number;
  unrealizedPnl: number;
};

const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'accounts'>('positions');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock data - replace with real API calls
  const [positions, setPositions] = useState<Position[]>([
    { id: 1, account: 'Account #123', symbol: 'AAPL', quantity: 100, price: 150.25, pnl: 1200.50 },
    { id: 2, account: 'Account #456', symbol: 'TSLA', quantity: 50, price: 700.00, pnl: -500.75 },
  ]);

  const [orders, setOrders] = useState<Order[]>([
    { id: 1, account: 'Account #123', symbol: 'GOOGL', type: 'Limit Buy', quantity: 10, price: 2800.00, status: 'Working' },
    { id: 2, account: 'Account #456', symbol: 'AMZN', type: 'Market Sell', quantity: 5, price: 3200.00, status: 'Filled' },
  ]);

  const [accounts, setAccounts] = useState<Account[]>([
    { id: 1, account: 'Account #123', realizedPnl: 2500.00, unrealizedPnl: 1200.50 },
    { id: 2, account: 'Account #456', realizedPnl: -800.00, unrealizedPnl: -500.75 },
  ]);

  const handleExitPosition = async (positionId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      // TODO: Replace with actual API call
      console.log('Exiting position:', positionId);
      await new Promise(resolve => setTimeout(resolve, 500));
      setPositions(prev => prev.filter(p => p.id !== positionId));
    } catch (err) {
      setError('Failed to exit position');
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
      console.log('Flattening account:', accountId);
      await new Promise(resolve => setTimeout(resolve, 500));
      setPositions(prev => prev.filter(p => !p.account.includes(accountId.toString())));
    } catch (err) {
      setError('Failed to flatten account');
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
      console.log('Exiting all positions for account:', accountId);
      await new Promise(resolve => setTimeout(resolve, 500));
      setPositions(prev => prev.filter(p => !p.account.includes(accountId.toString())));
    } catch (err) {
      setError('Failed to exit all positions');
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
      console.log('Flattening all positions and canceling all orders');
      await new Promise(resolve => setTimeout(resolve, 500));
      setPositions([]);
      setOrders(prev => prev.map(order => ({ ...order, status: 'Cancelled' })));
    } catch (err) {
      setError('Failed to flatten all positions and orders');
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
              className="flex items-center space-x-2 shadow-lg hover:shadow-xl transition-shadow bg-red-600 hover:bg-red-700"
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
              onClick={() => setActiveTab('positions')}
              className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-md transition-all ${
                activeTab === 'positions'
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Activity className="mr-2 h-4 w-4" />
              Positions
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-md transition-all ${
                activeTab === 'orders'
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Package className="mr-2 h-4 w-4" />
              Orders
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`flex items-center px-4 py-2.5 font-medium text-sm rounded-md transition-all ${
                activeTab === 'accounts'
                  ? 'bg-blue-50 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
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
          {!isLoading && activeTab === 'positions' && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">Open Positions</h3>
                <p className="text-sm text-slate-500">All active positions across accounts</p>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No open positions</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-semibold">Account</TableHead>
                          <TableHead className="font-semibold">Symbol</TableHead>
                          <TableHead className="font-semibold text-right">Quantity</TableHead>
                          <TableHead className="font-semibold text-right">Price</TableHead>
                          <TableHead className="font-semibold text-right">P&L</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((position) => (
                          <TableRow key={position.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium">{position.account}</TableCell>
                            <TableCell>{position.symbol}</TableCell>
                            <TableCell className="text-right">{position.quantity}</TableCell>
                            <TableCell className="text-right">${position.price.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-medium ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${position.pnl.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExitPosition(position.id)}
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
          {!isLoading && activeTab === 'orders' && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">Orders</h3>
                <p className="text-sm text-slate-500">Working orders and execution history</p>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No orders found</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-semibold">Account</TableHead>
                          <TableHead className="font-semibold">Symbol</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold text-right">Quantity</TableHead>
                          <TableHead className="font-semibold text-right">Price</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium">{order.account}</TableCell>
                            <TableCell>{order.symbol}</TableCell>
                            <TableCell>{order.type}</TableCell>
                            <TableCell className="text-right">{order.quantity}</TableCell>
                            <TableCell className="text-right">${order.price.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                order.status === 'Filled' ? 'bg-green-100 text-green-800' :
                                order.status === 'Working' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {order.status}
                              </span>
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
          {!isLoading && activeTab === 'accounts' && (
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <h3 className="text-xl font-semibold text-slate-900">Accounts</h3>
                <p className="text-sm text-slate-500">Performance and account management</p>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No accounts found</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-semibold">Account</TableHead>
                          <TableHead className="font-semibold text-right">Realized P&L</TableHead>
                          <TableHead className="font-semibold text-right">Unrealized P&L</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account) => (
                          <TableRow key={account.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-medium">{account.account}</TableCell>
                            <TableCell className={`text-right font-medium ${account.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${account.realizedPnl.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${account.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${account.unrealizedPnl.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFlattenAccount(account.id)}
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
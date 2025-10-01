import React, { useState } from 'react';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import  Button  from '../components/ui/Button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../components/ui/Table';
import { Trash2 } from 'lucide-react';

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
    <div className="flex bg-slate-50 min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 space-y-6">
          {/* Global Action Button */}
          <div className="flex justify-end">
<Button
  variant="secondary"
  onClick={handleFlattenAll}
  disabled={isLoading}
  className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white"
>
              <Trash2 className="h-4 w-4" />
              <span>Flatten All / Exit All & Cancel All</span>
            </Button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
              <button 
                onClick={() => setError(null)} 
                className="absolute top-0 right-0 px-4 py-3"
                aria-label="Close error message"
              >
                &times;
              </button>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-4 py-3 font-medium text-sm ${
                activeTab === 'positions'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              Positions
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-3 font-medium text-sm ${
                activeTab === 'orders'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-4 py-3 font-medium text-sm ${
                activeTab === 'accounts'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              Accounts
            </button>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center items-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}

          {/* Positions Tab */}
          {!isLoading && activeTab === 'positions' && (
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-slate-900">Open Positions</h3>
                <p className="text-sm text-slate-500">All active positions across accounts</p>
              </CardHeader>
              <CardContent>
                {positions.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No open positions</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {positions.map((position) => (
                          <TableRow key={position.id}>
                            <TableCell className="font-medium">{position.account}</TableCell>
                            <TableCell>{position.symbol}</TableCell>
                            <TableCell className="text-right">{position.quantity}</TableCell>
                            <TableCell className="text-right">${position.price.toFixed(2)}</TableCell>
                            <TableCell className={`text-right ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${position.pnl.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExitPosition(position.id)}
                                disabled={isLoading}
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
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-slate-900">Orders</h3>
                <p className="text-sm text-slate-500">Working orders and execution history</p>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No orders found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Symbol</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.account}</TableCell>
                            <TableCell>{order.symbol}</TableCell>
                            <TableCell>{order.type}</TableCell>
                            <TableCell className="text-right">{order.quantity}</TableCell>
                            <TableCell className="text-right">${order.price.toFixed(2)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 text-xs rounded-full ${
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
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-slate-900">Accounts</h3>
                <p className="text-sm text-slate-500">Performance and account management</p>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">No accounts found</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Realized P&L</TableHead>
                          <TableHead className="text-right">Unrealized P&L</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map((account) => (
                          <TableRow key={account.id}>
                            <TableCell className="font-medium">{account.account}</TableCell>
                            <TableCell className={`text-right ${account.realizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${account.realizedPnl.toFixed(2)}
                            </TableCell>
                            <TableCell className={`text-right ${account.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${account.unrealizedPnl.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFlattenAccount(account.id)}
                                  disabled={isLoading}
                                >
                                  Flatten
                                </Button>
<Button
  variant="outline"
  size="sm"
  className="text-red-600 hover:bg-red-50 hover:text-red-700"
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
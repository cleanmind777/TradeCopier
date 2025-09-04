import React, { useState } from 'react';
import { PlusCircle, Wallet, Activity, BarChart2, Settings, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Label from '../components/ui/Label';

const BrokerPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [newBrokerData, setNewBrokerData] = useState({
        name: '',
        broker: '',
        apiKey: '',
        secretKey: '',
    });

    const [brokerAccounts, setBrokerAccounts] = useState([
        {
            id: 1,
            name: 'Main Trading Account',
            broker: 'Interactive Brokers',
            balance: '$125,430',
            profitLoss: '+$8,450',
            status: 'active',
            lastUpdated: '2 hours ago'
        },
        {
            id: 2,
            name: 'Long-Term Portfolio',
            broker: 'TD Ameritrade',
            balance: '$78,900',
            profitLoss: '-$1,200',
            status: 'inactive',
            lastUpdated: '1 day ago'
        }
    ]);

    /** Handle form submission */
    const handleAddBroker = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Adding new broker:", newBrokerData);
        // TODO: API call to add broker
        setIsModalOpen(false);
        setNewBrokerData({
            name: '',
            broker: '',
            apiKey: '',
            secretKey: '',
        });
    };

    /** Handle input changes */
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewBrokerData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    /** Toggle account status */
    const toggleAccountStatus = (id: number) => {
        setBrokerAccounts(prevAccounts =>
            prevAccounts.map(account =>
                account.id === id
                    ? { ...account, status: account.status === 'active' ? 'inactive' : 'active' }
                    : account
            )
        );
    };

    /** Handle delete account */
    const handleDeleteAccount = (id: number) => {
        setBrokerAccounts(prevAccounts => prevAccounts.filter(account => account.id !== id));
        setIsDeleteModalOpen(false);
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-6 space-y-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-slate-900">Broker Accounts</h1>
                        <Button onClick={() => setIsModalOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Broker Account
                        </Button>
                    </div>

                    {/* Accounts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {brokerAccounts.map((account) => (
                            <Card key={account.id} className="hover:shadow-lg transition-shadow duration-200">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">{account.name}</h3>
                                            <p className="text-sm text-slate-500">{account.broker}</p>
                                        </div>
                                        <Wallet className="h-6 w-6 text-blue-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600">Balance</span>
                                            <span className="text-sm font-medium text-slate-900">{account.balance}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600">Profit/Loss</span>
                                            <span className={`text-sm font-medium ${account.profitLoss.startsWith('+') ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {account.profitLoss}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600">Status</span>
                                            <button
                                                onClick={() => toggleAccountStatus(account.id)}
                                                className="flex items-center space-x-2"
                                            >
                                                {account.status === 'active' ? (
                                                    <ToggleRight className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <ToggleLeft className="h-5 w-5 text-slate-400" />
                                                )}
                                                <span className={`text-sm font-medium ${account.status === 'active' ? 'text-green-600' : 'text-slate-600'
                                                    }`}>
                                                    {account.status}
                                                </span>
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-slate-600">Last Updated</span>
                                            <span className="text-sm text-slate-500">{account.lastUpdated}</span>
                                        </div>
                                        <div className="flex space-x-2 mt-4">
                                            <Button variant="outline" size="sm" className="w-full">
                                                <Eye className="mr-2 h-4 w-4" />
                                                View
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full text-red-600 hover:bg-red-50"
                                                onClick={() => {
                                                    setSelectedAccountId(account.id);
                                                    setIsDeleteModalOpen(true);
                                                }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Statistics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <h3 className="text-lg font-semibold text-slate-900">Portfolio Performance</h3>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg flex items-center justify-center">
                                    <BarChart2 className="h-12 w-12 text-blue-500" />
                                    <p className="ml-2 text-slate-500">Performance chart will be displayed here</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <Button variant="outline" className="w-full">
                                        <PlusCircle className="mr-2 h-4 w-4" />
                                        Add New Account
                                    </Button>
                                    <Button variant="outline" className="w-full">
                                        <Activity className="mr-2 h-4 w-4" />
                                        View All Activity
                                    </Button>
                                    <Button variant="outline" className="w-full">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Account Settings
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Modal for adding a new broker */}
                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title="Add New Broker Account"
                    >
                        <form onSubmit={handleAddBroker}>
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Account Name</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        value={newBrokerData.name}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Trading Account #1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="broker">Broker</Label>
                                    <Input
                                        id="broker"
                                        name="broker"
                                        value={newBrokerData.broker}
                                        onChange={handleInputChange}
                                        placeholder="e.g., Interactive Brokers"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="apiKey">API Key</Label>
                                    <Input
                                        id="apiKey"
                                        name="apiKey"
                                        value={newBrokerData.apiKey}
                                        onChange={handleInputChange}
                                        placeholder="Enter broker API key"
                                        type="password"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="secretKey">Secret Key</Label>
                                    <Input
                                        id="secretKey"
                                        name="secretKey"
                                        value={newBrokerData.secretKey}
                                        onChange={handleInputChange}
                                        placeholder="Enter broker secret key"
                                        type="password"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end space-x-2 mt-6">
                                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">
                                    Add Account
                                </Button>
                            </div>
                        </form>
                    </Modal>

                    {/* Confirm Delete Modal */}
                    <Modal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        title="Delete Account"
                    >
                        <div className="space-y-4">
                            <p className="text-slate-600">
                                Are you sure you want to delete this account? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-2 mt-6">
                                <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        if (selectedAccountId) {
                                            handleDeleteAccount(selectedAccountId);
                                        }
                                    }}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </main>
            </div>
        </div>
    );
};

export default BrokerPage;
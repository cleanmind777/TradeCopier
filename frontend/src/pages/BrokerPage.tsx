import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Wallet, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Footer from '../components/layout/Footer';
import Sidebar from '../components/layout/Sidebar';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { BrokerFilter, BrokerInfo } from '../types/broker';
import { getBrokers, delBroker } from '../api/brokerApi';

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

const BrokerPage: React.FC = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [brokerAccounts, setBrokerAccounts] = useState<BrokerInfo[] | null>(null);
    const [newBrokerData, setNewBrokerData] = useState({
        name: '',
        broker: '',
        apiKey: '',
        secretKey: '',
    });

    const user = localStorage.getItem('user');
    const user_id = user ? JSON.parse(user).id : null;

    const getBrokerAccounts = async () => {
        const brokerFilter: BrokerFilter = {
            "user_id": user_id
        }
        const brokers = await getBrokers(brokerFilter);
        setBrokerAccounts(brokers);
    }

    const handleAddBroker = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("Adding new broker:", newBrokerData);
        setIsModalOpen(false);
        setNewBrokerData({
            name: '',
            broker: '',
            apiKey: '',
            secretKey: '',
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewBrokerData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const toggleAccountStatus = (id: string) => {
        if (brokerAccounts != null) {
            setBrokerAccounts(prevAccounts => (
                prevAccounts && (
                    prevAccounts.map(account =>
                        account.id === id
                            ? { ...account, status: account.status === true ? false : true }
                            : account
                    )
                )
            ));
        }
    };

    const delBrokerAccounts = async (id: string) => {
        await delBroker(id);
    }
    const handleDeleteAccount = async () => {
        if (selectedAccountId) {
            console.log("Deleting account:", selectedAccountId);
            delBrokerAccounts(selectedAccountId);
            // Add your delete API call here
            setIsDeleteModalOpen(false);
            setSelectedAccountId(null);
            await getBrokerAccounts(); // Refresh the list after deletion
        }
    };

    useEffect(() => {
        getBrokerAccounts();
    }, [])

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
                        {brokerAccounts && (
                            brokerAccounts.map((account) => (
                                <Card key={account.id} className="hover:shadow-lg transition-shadow duration-200">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900">{account.nickname}</h3>
                                                <p className="text-sm text-slate-500">{account.type}</p>
                                            </div>
                                            <Wallet className="h-6 w-6 text-blue-500" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Status</span>
                                                <button
                                                    onClick={() => toggleAccountStatus(account.id)}
                                                    className="flex items-center space-x-2"
                                                >
                                                    {account.status === true ? (
                                                        <ToggleRight className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <ToggleLeft className="h-5 w-5 text-slate-400" />
                                                    )}
                                                    <span className={`text-sm font-medium ${account.status === true ? 'text-green-600' : 'text-slate-600'}`}>
                                                        {account.status ? 'Active' : 'Inactive'}
                                                    </span>
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Last Updated</span>
                                                <span className="text-sm text-slate-500">{String(account.last_sync)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Live</span>
                                                <span className="text-sm text-slate-500">{String(account.live)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Paper</span>
                                                <span className="text-sm text-slate-500">{String(account.paper)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Enabled</span>
                                                <span className="text-sm text-slate-500">{String(account.enable)}</span>
                                            </div>
                                            <div className="flex space-x-2 mt-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => navigate(`/broker/${account.user_broker_id}`)}
                                                >
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
                                                        console.log("11111111111111111111111111111111111111111111111")
                                                    }}
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    {/* Modal for adding a new broker */}
                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title="Add New Broker Account"
                    >
                        <div className="space-y-6">
                            <div className="flex flex-col gap-4">
                                <div
                                    className="w-full p-6 rounded-lg cursor-pointer hover:shadow-md transition-all relative"
                                    style={{ height: '150px' }}
                                    onClick={() => { window.location.href = `${API_BASE}/tradovate/auth?user_id=${user_id}` }}
                                >
                                    <div
                                        className="absolute inset-0 bg-contain bg-no-repeat bg-center rounded-lg"
                                        style={{
                                            backgroundImage: "url('/Tradovate-whitebg.png')",
                                            backgroundSize: '80%',
                                            opacity: 1
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="text-center text-slate-500 text-sm">
                                Don't see your broker? <a href="/brokers/other" className="text-blue-500 hover:underline">Add manually</a>
                            </div>
                        </div>
                    </Modal>

                    {/* Delete Confirmation Modal */}
                    <Modal
                        isOpen={isDeleteModalOpen}
                        onClose={() => setIsDeleteModalOpen(false)}
                        title="Delete Broker Account"
                    >
                        <div className="space-y-6">
                            <p className="text-slate-600">
                                Are you sure you want to delete this broker account? This action cannot be undone.
                            </p>
                            <div className="flex justify-end space-x-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="outline"
                                    className="bg-red-600 text-white hover:bg-red-700"
                                    onClick={handleDeleteAccount}
                                >
                                    Delete Account
                                </Button>
                            </div>
                        </div>
                    </Modal>
                </main>
                <Footer />
            </div>
        </div>
    );
};

export default BrokerPage;
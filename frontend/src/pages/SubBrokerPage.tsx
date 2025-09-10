import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { PlusCircle, Wallet, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { SubBrokerFilter, SubBrokerInfo } from '../types/broker';
import { getSubBrokers } from '../api/brokerApi';

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api/v1";

const SubBrokerPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [brokerAccounts, setBrokerAccounts] = useState<SubBrokerInfo[] | null>(null);

    const user = localStorage.getItem('user');
    const user_id = user ? JSON.parse(user).id : null;

    const getBrokerAccounts = async () => {
        const subBrokerFilter: SubBrokerFilter = {
            "user_id": user_id,
            "user_broker_id": id
        }
        const brokers = await getSubBrokers(subBrokerFilter);
        if (brokers) {
            setBrokerAccounts(brokers);
        }
    }

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

    useEffect(() => {
        getBrokerAccounts();
    }, [])

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-6 space-y-6">

                    {/* Accounts Grid */}
                    <div className="grid grid-cols-1 gap-6">
                        {brokerAccounts && (
                            brokerAccounts.map((account) => (
                                <Card key={account.id} className="hover:shadow-lg transition-shadow duration-200">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-900">{account.nickname}</h3>
                                                <p className="text-sm text-slate-500">{account.sub_account_name}</p>
                                            </div>
                                            <Wallet className="h-6 w-6 text-blue-500" />
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Account Type</span>
                                                <span className="text-sm text-slate-500">{account.account_type}</span>
                                            </div>
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
                                                <span className="text-sm text-slate-600">Demo Account</span>
                                                <span className="text-sm text-slate-500">
                                                    {account.is_demo ? 'Yes' : 'No'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Balance</span>
                                                <span className="text-sm text-slate-500">
                                                    {account.balance ? `$${account.balance.toFixed(2)}` : 'N/A'}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-slate-600">Last Updated</span>
                                                <span className="text-sm text-slate-500">
                                                    {new Date(account.last_sync).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex space-x-2 mt-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => navigate(`/sub-brokers/${account.id}`)}
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
                        title="Add New Sub Broker Account"
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
                </main>
            </div>
        </div>
    );
};

export default SubBrokerPage;
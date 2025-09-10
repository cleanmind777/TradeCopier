import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Wallet, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { SubBrokerFilter, SubBrokerInfo } from '../types/broker';
import { getSubBrokers } from '../api/brokerApi';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';

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
            user_id,
            user_broker_id: id,
        };
        const brokers = await getSubBrokers(subBrokerFilter);
        if (brokers) {
            setBrokerAccounts(brokers);
        }
    };

    const toggleAccountStatus = (accountId: string) => {
        if (brokerAccounts) {
            setBrokerAccounts(prevAccounts =>
                prevAccounts?.map(account =>
                    account.id === accountId ? { ...account, status: !account.status } : account
                ) || null
            );
        }
    };

    useEffect(() => {
        getBrokerAccounts();
    }, []);

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-6 space-y-6">
                    {/* Connection name */}
                    <div className="bg-white p-4 rounded shadow">
                        <h1 className="text-xl font-semibold mb-4">Tradovate 7</h1>

                        {/* Connected Accounts */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-slate-900">CONNECTED ACCOUNTS</h2>
                                <button
                                    onClick={getBrokerAccounts}
                                    className="px-3 py-1 border rounded text-sm hover:bg-slate-100"
                                >
                                    Refresh Accounts
                                </button>
                            </div>

                            {/* Table Header */}
                            <div className="grid grid-cols-[48px_2fr_3fr_2fr_1fr_1fr_2fr_3fr] gap-2 text-sm font-semibold text-slate-600 border-b border-slate-200 pb-2 select-none">
                                <div>Status</div>
                                <div>Name</div>
                                <div>ID</div>
                                <div>Type</div>
                                <div>Mode</div>
                                <div>Subscriptions</div>
                                <div>Balance</div>
                                <div className="text-center">Actions</div>
                            </div>

                            {/* Table Rows */}
                            {brokerAccounts?.map(account => (
                                <div
                                    key={account.id}
                                    className="grid grid-cols-[48px_2fr_3fr_2fr_1fr_1fr_2fr_3fr] gap-2 items-center border-b border-slate-100 py-3"
                                >
                                    {/* Status toggle */}
                                    <div className="flex justify-center">
                                        <button onClick={() => toggleAccountStatus(account.id)} aria-label="Toggle status">
                                            {account.status ? (
                                                <ToggleRight className="h-6 w-6 text-green-500" />
                                            ) : (
                                                <ToggleLeft className="h-6 w-6 text-slate-400" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Nickname editable input */}
                                    <div>
                                        <input
                                            type="text"
                                            value={account.nickname}
                                            readOnly
                                            className="w-full bg-transparent border border-transparent focus:border-blue-500 rounded px-2 py-1 text-sm text-slate-900"
                                        // Add onChange handler if editing supported
                                        />
                                    </div>

                                    {/* ID + sub account name */}
                                    <div>
                                        <div className="truncate">{account.sub_account_name}</div>
                                        <div className="text-xs text-slate-500 truncate">{account.id}</div>
                                    </div>

                                    {/* Account type */}
                                    <div>{account.account_type}</div>

                                    {/* Mode (demo/live) */}
                                    <div>
                                        <span
                                            className={`text-xs font-medium rounded px-2 py-0.5 ${account.is_demo ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                }`}
                                        >
                                            {account.is_demo ? 'Paper' : 'Live'}
                                        </span>
                                    </div>

                                    {/* Subscriptions count */}
                                    <div className="text-center">{0}</div>

                                    {/* Balance */}
                                    <div>${account.balance?.toFixed(2) ?? 'N/A'}</div>

                                    {/* Actions */}
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            size="sm"
                                            onClick={() => navigate(`/sub-brokers/dashboard/${account.id}`)}
                                            title="Dashboard"
                                        >
                                            Dashboard
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => navigate(`/sub-brokers/trades/${account.id}`)}
                                            title="Trades"
                                        >
                                            Trades
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(`/sub-brokers/${account.id}`)}
                                            title="View"
                                        >
                                            <Eye className="mr-1 h-4 w-4" />
                                            View
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:bg-red-50"
                                            onClick={() => {
                                                setSelectedAccountId(account.id);
                                                setIsDeleteModalOpen(true);
                                            }}
                                            title="Edit"
                                        >
                                            <Trash2 className="mr-1 h-4 w-4" />
                                            Edit
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Connection Status */}
                        <div className="p-4 bg-green-50 rounded text-green-700 text-sm font-semibold select-none">
                            <span>Connection successful</span>
                        </div>
                    </div>

                    {/* Modal for adding a new sub broker */}
                    <Modal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title="Add New Sub Broker Account"
                    >
                        <div className="space-y-6">
                            <div
                                className="w-full p-6 rounded-lg cursor-pointer hover:shadow-md transition-all relative"
                                style={{ height: '150px' }}
                                onClick={() => {
                                    window.location.href = `${API_BASE}/tradovate/auth?user_id=${user_id}`;
                                }}
                            >
                                <div
                                    className="absolute inset-0 bg-contain bg-no-repeat bg-center rounded-lg"
                                    style={{
                                        backgroundImage: "url('/Tradovate-whitebg.png')",
                                        backgroundSize: '80%',
                                        opacity: 1,
                                    }}
                                />
                            </div>
                            <div className="text-center text-slate-500 text-sm">
                                Don't see your broker?{' '}
                                <a href="/brokers/other" className="text-blue-500 hover:underline">
                                    Add manually
                                </a>
                            </div>
                        </div>
                    </Modal>
                </main>
            </div>
        </div>
    );
};

export default SubBrokerPage;

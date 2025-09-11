import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Wallet, Edit, Trash2, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { SubBrokerFilter, SubBrokerInfo, BrokerInfo, BrokerFilter, SubBrokerChange } from '../types/broker';
import { getSubBrokers, getBrokers, changeBrokerAccount, changeSubBrokerAccount } from '../api/brokerApi';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000/api/v1';

const SubBrokerPage: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [subBrokerAccounts, setSubBrokerAccounts] = useState<SubBrokerInfo[] | null>(null);
    const [brokerAccount, setBrokerAccount] = useState<BrokerInfo | null>(null);

    // Editing states for main broker nickname
    const [isEditingBrokerNickname, setIsEditingBrokerNickname] = useState(false);
    const [editedBrokerNickname, setEditedBrokerNickname] = useState('');

    // Editing states for sub-broker nicknames
    const [editingNicknameIds, setEditingNicknameIds] = useState<string[]>([]);
    const [editedNicknames, setEditedNicknames] = useState<Record<string, string>>({});

    const user = localStorage.getItem('user');
    const user_id = user ? JSON.parse(user).id : null;

    const getSubBrokerAccounts = async () => {
        const subBrokerFilter: SubBrokerFilter = {
            user_id,
            user_broker_id: id,
        };
        const brokers = await getSubBrokers(subBrokerFilter);
        if (brokers) {
            setSubBrokerAccounts(brokers);
        }
    };

    const getBrokerAccount = async () => {
        const brokerFilter: BrokerFilter = {
            user_broker_id: id
        };
        const brokers = await getBrokers(brokerFilter);
        if (brokers != null) {
            setBrokerAccount(brokers[0]);
            setEditedBrokerNickname(brokers[0].nickname || '');
        }
    };

    const toggleAccountStatus = async (accountId: string) => {
        const subBrokerChange: SubBrokerChange = {
            id: accountId
        };
        const subBrokers = await changeSubBrokerAccount(subBrokerChange);
        setSubBrokerAccounts(subBrokers);
    };

    // Start editing a sub-broker nickname
    const startEditingNickname = (accountId: string, currentNickname: string) => {
        setEditingNicknameIds(prev => [...prev, accountId]);
        setEditedNicknames(prev => ({ ...prev, [accountId]: currentNickname }));
    };

    // Cancel editing a sub-broker nickname
    const cancelEditingNickname = (accountId: string) => {
        setEditingNicknameIds(prev => prev.filter(id => id !== accountId));
        setEditedNicknames(prev => {
            const copy = { ...prev };
            delete copy[accountId];
            return copy;
        });
    };

    // Handle input change for a sub-broker nickname edit
    const onNicknameChange = (accountId: string, newNickname: string) => {
        setEditedNicknames(prev => ({ ...prev, [accountId]: newNickname }));
    };

    // Save the updated sub-broker nickname
    const saveNickname = async (accountId: string) => {
        try {
            const newNickname = editedNicknames[accountId];
            if (!newNickname) {
                alert("Nickname cannot be empty");
                return;
            }
            await changeSubBrokerAccount({ id: accountId, nickname: newNickname });
            await getSubBrokerAccounts();
            cancelEditingNickname(accountId);
        } catch (error) {
            console.error('Error saving nickname', error);
            alert("Failed to save nickname");
        }
    };

    // Save main broker nickname update
    const saveBrokerNickname = async () => {
        try {
            if (!editedBrokerNickname) {
                alert("Nickname cannot be empty");
                return;
            }
            if (brokerAccount) {
                await changeBrokerAccount({ id: brokerAccount.id, nickname: editedBrokerNickname });
                await getBrokerAccount();
                setIsEditingBrokerNickname(false);
            }
        } catch (error) {
            console.error('Failed to update broker nickname', error);
            alert("Failed to update broker nickname");
        }
    };

    // Reload data on mount
    useEffect(() => {
        getBrokerAccount();
        getSubBrokerAccounts();
    }, []);

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                <Header />
                <main className="flex-1 p-6 space-y-6">
                    {/* Connection name and editing */}
                    <div className="bg-white p-4 rounded-lg shadow-sm flex items-center space-x-4">
                        {isEditingBrokerNickname ? (
                            <>
                                <input
                                    type="text"
                                    value={editedBrokerNickname}
                                    onChange={e => setEditedBrokerNickname(e.target.value)}
                                    className="border px-3 py-1.5 rounded-lg flex-grow text-xl font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                />
                                <Button
                                    size="sm"
                                    onClick={saveBrokerNickname}
                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setIsEditingBrokerNickname(false)}
                                    className="border-slate-300 hover:bg-slate-100"
                                >
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                <h1 className="text-xl font-semibold mb-0 flex-grow text-slate-900">{brokerAccount?.nickname}</h1>
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        setEditedBrokerNickname(brokerAccount?.nickname || '');
                                        setIsEditingBrokerNickname(true);
                                    }}
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                    Edit
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Connected Accounts */}
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-slate-900">CONNECTED ACCOUNTS</h2>
                                <button
                                    onClick={getSubBrokerAccounts}
                                    className="px-3 py-1.5 border rounded-lg text-sm hover:bg-slate-100 transition-colors"
                                >
                                    Refresh
                                </button>
                            </div>

                            {/* Table Header */}
                            <div className="grid grid-cols-[1fr_1fr_2fr_2fr_1fr_1fr_1fr_2fr_2fr_2fr_1fr_1fr] gap-3 text-sm font-semibold text-slate-700 border-b border-slate-200 pb-3 select-none overflow-x-auto">
                                <div className="flex justify-center">
                                    <button onClick={() => { }} aria-label="Toggle status">
                                        {/* Optional toggleAll here */}
                                    </button>
                                </div>
                                <div className="flex items-center">
                                    <span>Status</span>
                                </div>
                                <div className="flex items-center">
                                    <span>Name</span>
                                </div>
                                <div className="flex items-center">
                                    <span>ID</span>
                                </div>
                                <div className="flex items-center">
                                    <span>Type</span>
                                </div>
                                <div className="flex items-center">
                                    <span>Mode</span>
                                </div>
                                <div className="flex items-center">
                                    <span>Subs</span>
                                </div>
                                <div className="flex items-center">
                                    <span>Balance</span>
                                </div>
                                <div className="text-center">
                                    <span>Actions</span>
                                </div>
                            </div>

                            {/* Table Rows */}
                            {subBrokerAccounts?.map(account => (
                                <div
                                    key={account.id}
                                    className="grid grid-cols-[1fr_1fr_2fr_2fr_1fr_1fr_1fr_2fr_2fr_2fr_1fr_1fr] gap-3 items-center border-b border-slate-100 py-3 text-sm overflow-x-auto hover:bg-slate-50 transition-colors"
                                >
                                    {/* Is_active */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => toggleAccountStatus(account.id)}
                                            aria-label="Toggle status"
                                            className="p-1 rounded-full hover:bg-slate-100 transition-colors"
                                        >
                                            {account.is_active ? (
                                                <ToggleRight className="h-6 w-6 text-green-500" />
                                            ) : (
                                                <ToggleLeft className="h-6 w-6 text-slate-400" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Status indicator */}
                                    <div className="flex justify-center">
                                        <div className={`w-5 h-5 rounded-full ${account.status ? 'bg-green-500' : 'bg-red-500'} shadow-sm`} />
                                    </div>

                                    {/* Editable Nickname Input */}
                                    <div>
                                        {editingNicknameIds.includes(account.id) ? (
                                            <input
                                                type="text"
                                                value={editedNicknames[account.id] || ''}
                                                onChange={e => onNicknameChange(account.id, e.target.value)}
                                                className="w-full px-3 py-1.5 border rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                            />
                                        ) : (
                                            <div className="px-3 py-1.5 text-slate-900">
                                                {account.nickname}
                                            </div>
                                        )}
                                    </div>

                                    {/* ID + sub account name */}
                                    <div className="space-y-1">
                                        <div className="font-medium text-slate-900">{account.sub_account_name}</div>
                                        <div className="text-xs text-slate-500">{account.id}</div>
                                    </div>

                                    {/* Account type */}
                                    <div className="text-slate-700">
                                        {account.account_type}
                                    </div>

                                    {/* Mode (demo/live) */}
                                    <div>
                                        <span
                                            className={`inline-block text-xs font-medium rounded-full px-3 py-1 ${account.is_demo ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}
                                        >
                                            {account.is_demo ? 'Paper' : 'Live'}
                                        </span>
                                    </div>

                                    {/* Subscriptions count */}
                                    <div className="text-center text-slate-700">
                                        {0}
                                    </div>

                                    {/* Balance */}
                                    <div className="font-medium text-slate-900">
                                        ${account.balance?.toFixed(2) ?? 'N/A'}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-center space-x-2">
                                        {editingNicknameIds.includes(account.id) ? (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => saveNickname(account.id)}
                                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => cancelEditingNickname(account.id)}
                                                    className="border-slate-300 hover:bg-slate-100"
                                                >
                                                    Cancel
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                {account.is_active && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            title="Dashboard"
                                                            className="bg-indigo-500 hover:bg-indigo-600 text-white"
                                                        >
                                                            Dash
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            title="Trades"
                                                            className="bg-purple-500 hover:bg-purple-600 text-white"
                                                        >
                                                            Trades
                                                        </Button>
                                                    </>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => navigate(`/sub-brokers/${account.id}`)}
                                                    title="View"
                                                    className="border-slate-300 hover:bg-slate-100"
                                                >
                                                    <Eye className="h-4 w-4 text-slate-700" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600 hover:bg-red-50 border-red-200"
                                                    onClick={() => {
                                                        setSelectedAccountId(account.id);
                                                        setIsDeleteModalOpen(true);
                                                    }}
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => startEditingNickname(account.id, account.nickname)}
                                                    title="Edit Nickname"
                                                    className="bg-green-500 hover:bg-green-600 text-white"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Connection Status */}
                        <div className="p-4 bg-green-50 rounded-lg text-green-700 text-sm font-semibold select-none">
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
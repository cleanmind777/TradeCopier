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
            // Assuming changeSubBrokerAccount supports updating nickname property
            await changeSubBrokerAccount({ id: accountId, nickname: newNickname });

            // Refresh list or update local state after saving
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
                    <div className="bg-white p-4 rounded shadow flex items-center space-x-4">
                        {isEditingBrokerNickname ? (
                            <>
                                <input
                                    type="text"
                                    value={editedBrokerNickname}
                                    onChange={e => setEditedBrokerNickname(e.target.value)}
                                    className="border px-2 py-1 rounded flex-grow text-xl font-semibold"
                                />
                                <Button size="sm" onClick={saveBrokerNickname}>Save</Button>
                                <Button size="sm" variant="outline" onClick={() => setIsEditingBrokerNickname(false)}>Cancel</Button>
                            </>
                        ) : (
                            <>
                                <h1 className="text-xl font-semibold mb-0 flex-grow">{brokerAccount?.nickname}</h1>
                                <Button size="sm" onClick={() => {
                                    setEditedBrokerNickname(brokerAccount?.nickname || '');
                                    setIsEditingBrokerNickname(true);
                                }}>
                                    Edit
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Connected Accounts */}
                    <div className="bg-white p-4 rounded shadow">
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-slate-900">CONNECTED ACCOUNTS</h2>
                                <button
                                    onClick={getSubBrokerAccounts}
                                    className="px-3 py-1 border rounded text-sm hover:bg-slate-100"
                                >
                                    Refresh Accounts
                                </button>
                            </div>

                            {/* Table Header */}
                            <div className="grid grid-cols-[48px_2fr_3fr_2fr_1fr_1fr_2fr_3fr] gap-2 text-sm font-semibold text-slate-600 border-b border-slate-200 pb-2 select-none">
                                <div className="flex justify-center">
                                    <button onClick={() => { }} aria-label="Toggle status">
                                        {/* Optional toggleAll here */}
                                    </button>
                                </div>
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
                            {subBrokerAccounts?.map(account => (
                                <div
                                    key={account.id}
                                    className="grid grid-cols-[48px_2fr_3fr_2fr_1fr_1fr_2fr_3fr] gap-2 items-center border-b border-slate-100 py-3"
                                >
                                    {/* Is_active */}
                                    <div className="flex justify-center">
                                        <button onClick={() => toggleAccountStatus(account.id)} aria-label="Toggle status">
                                            {account.is_active ? (
                                                <ToggleRight className="h-6 w-6 text-green-500" />
                                            ) : (
                                                <ToggleLeft className="h-6 w-6 text-slate-400" />
                                            )}
                                        </button>
                                    </div>

                                    {/* Status indicator */}
                                    <div className="flex justify-center">
                                        {account.status ? (
                                            <span className="block w-5 h-5 rounded-full bg-green-500" aria-label="Active status" />
                                        ) : (
                                            <span className="block w-5 h-5 rounded-full bg-red-500" aria-label="Inactive status" />
                                        )}
                                    </div>

                                    {/* Editable Nickname Input */}
                                    <div>
                                        {editingNicknameIds.includes(account.id) ? (
                                            <input
                                                type="text"
                                                value={editedNicknames[account.id] || ''}
                                                onChange={e => onNicknameChange(account.id, e.target.value)}
                                                className="w-full px-2 py-1 border rounded text-sm text-slate-900"
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={account.nickname}
                                                readOnly
                                                className="w-full bg-transparent border border-transparent text-sm text-slate-900"
                                            />
                                        )}
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
                                        {/* Edit/Save/Cancel Buttons for nickname editing */}
                                        {editingNicknameIds.includes(account.id) ? (
                                            <>
                                                <Button size="sm" onClick={() => saveNickname(account.id)}>Save</Button>
                                                <Button size="sm" variant="outline" onClick={() => cancelEditingNickname(account.id)}>Cancel</Button>
                                            </>
                                        ) : (
                                            <>
                                                {account.is_active && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            title="Dashboard"
                                                        // onClick={() => navigate(`/sub-brokers/dashboard/${account.id}`)}
                                                        >
                                                            Dashboard
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            title="Trades"
                                                        // onClick={() => navigate(`/sub-brokers/trades/${account.id}`)}
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
                                                    title="Delete"
                                                >
                                                    <Trash2 className="mr-1 h-4 w-4" />
                                                    Delete
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => startEditingNickname(account.id, account.nickname)}
                                                    title="Edit Nickname"
                                                >
                                                    <Edit className="mr-1 h-4 w-4" />
                                                    Edit
                                                </Button>
                                            </>
                                        )}
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

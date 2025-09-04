import React, { useEffect, useState } from 'react';
import { Users, UserCheck, UserX, UserCog, Search, Filter } from 'lucide-react';
import Header from '../../components/layout/Header';
import AdminSidebar from '../../components/layout/AdminSidebar';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import UserTable from '../../components/admin/UserTable';
import { getUsers, acceptUser } from "../../api/adminApi"
import { User, UserFilter } from "../../types/user"

const AdminUsersPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [users, setUsers] = useState<User[] | null>(null)
    const [pendingUsers, setPendingUsers] = useState<User[] | null>(null)
    const [activeUsers, setActiveUsers] = useState<User[] | null>(null)
    // Sample data - replace with real data from your API
    // const pendingUsers = [
    //     { id: 1, name: 'John Doe', email: 'john@example.com', status: 'Pending', date: '2023-10-01' },
    //     { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Pending', date: '2023-10-02' },
    // ];

    // const activeUsers = [
    //     { id: 3, name: 'Mike Johnson', email: 'mike@example.com', status: 'Active', date: '2023-09-15' },
    //     { id: 4, name: 'Sarah Wilson', email: 'sarah@example.com', status: 'Active', date: '2023-09-20' },
    // ];

    // const allUsers = [...pendingUsers, ...activeUsers];
    const getAllUsers = async () => {
        const response = await getUsers({});
        setUsers(response);
    }
    useEffect(() => {
        getAllUsers();
    }, [])
    useEffect(() => {
        if (users) {
            let x = []
            let y = []
            let i = 0;
            for (i = 0; i < users.length; i++) {
                if (users[i].is_accepted) {
                    x.push(users[i])
                }
                else {
                    y.push(users[i])
                }
            }
            setPendingUsers(y)
            setActiveUsers(x)
        }
    }, [users])
    const handleAcceptUser = async (id: string) => {
        const response = await acceptUser(id);
        setUsers(response)
    }
    const renderTabContent = () => {
        switch (activeTab) {
            case 'all':
                return <UserTable users={users} onAccept={handleAcceptUser} />;
            case 'pending':
                return <UserTable users={pendingUsers} onAccept={handleAcceptUser} />;
            case 'active':
                return <UserTable users={activeUsers} onAccept={handleAcceptUser} />;
            case 'info':
                return (
                    <div className="space-y-4">
                        <p className="text-slate-600">
                            Detailed user information and statistics will be displayed here.
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <AdminSidebar />

            <div className="flex-1 flex flex-col">
                <Header />

                <main className="flex-1 p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold text-slate-900">Users Management</h1>
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <Input
                                    className="pl-10"
                                    placeholder="Search users..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button variant="outline">
                                <Filter className="mr-2 h-4 w-4" />
                                Filters
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex space-x-4 border-b">
                            <button
                                className={`px-4 py-2 -mb-px font-medium ${activeTab === 'all'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                onClick={() => setActiveTab('all')}
                            >
                                <Users className="inline-block mr-2 h-4 w-4" />
                                All Users
                            </button>
                            <button
                                className={`px-4 py-2 -mb-px font-medium ${activeTab === 'pending'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                onClick={() => setActiveTab('pending')}
                            >
                                <UserX className="inline-block mr-2 h-4 w-4" />
                                Pending
                            </button>
                            <button
                                className={`px-4 py-2 -mb-px font-medium ${activeTab === 'active'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                onClick={() => setActiveTab('active')}
                            >
                                <UserCheck className="inline-block mr-2 h-4 w-4" />
                                Active
                            </button>
                            <button
                                className={`px-4 py-2 -mb-px font-medium ${activeTab === 'info'
                                    ? 'border-b-2 border-blue-500 text-blue-600'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                onClick={() => setActiveTab('info')}
                            >
                                <UserCog className="inline-block mr-2 h-4 w-4" />
                                User Info
                            </button>
                        </div>

                        <Card>
                            <CardHeader>
                                <h2 className="text-xl font-semibold text-slate-900">
                                    {activeTab === 'all' && 'All Users'}
                                    {activeTab === 'pending' && 'Pending Users'}
                                    {activeTab === 'active' && 'Active Users'}
                                    {activeTab === 'info' && 'User Information'}
                                </h2>
                            </CardHeader>
                            <CardContent>
                                {renderTabContent()}
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminUsersPage;
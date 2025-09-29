import React from 'react';
import { Users, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import AdminSidebar from '../../components/layout/AdminSidebar';
import StatsCard from '../../components/dashboard/StatsCard';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';

const AdminPage: React.FC = () => {
    const stats = [
        {
            title: 'Total Users',
            value: '12,543',
            change: '+12% from last month',
            changeType: 'positive' as const,
            icon: Users,
        },
        {
            title: 'Revenue',
            value: '$89,243',
            change: '+8% from last month',
            changeType: 'positive' as const,
            icon: DollarSign,
        },
        {
            title: 'Orders',
            value: '2,345',
            change: '-3% from last month',
            changeType: 'negative' as const,
            icon: ShoppingCart,
        },
        {
            title: 'Growth',
            value: '15.8%',
            change: '+2.1% from last month',
            changeType: 'positive' as const,
            icon: TrendingUp,
        },
    ];

    const recentActivity = [
        { id: 1, user: 'John Doe', action: 'Created new account', time: '2 minutes ago' },
        { id: 2, user: 'Jane Smith', action: 'Made a purchase', time: '5 minutes ago' },
        { id: 3, user: 'Mike Johnson', action: 'Updated profile', time: '10 minutes ago' },
        { id: 4, user: 'Sarah Wilson', action: 'Left a review', time: '15 minutes ago' },
    ];

    return (
        <div className="flex bg-slate-50 min-h-screen">
            <AdminSidebar />

            <div className="flex-1 flex flex-col">
                <Header />

                <main className="flex-1 p-6 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((stat, index) => (
                            <StatsCard key={index} {...stat} />
                        ))}
                    </div>

                    {/* Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart Placeholder */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <h3 className="text-lg font-semibold text-slate-900">User Status</h3>
                            </CardHeader>
                            <CardContent>
                                <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
                                    <p className="text-slate-500">Chart visualization would go here</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Activity */}
                        <Card>
                            <CardHeader>
                                <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-start space-x-3">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900">{activity.user}</p>
                                                <p className="text-sm text-slate-600">{activity.action}</p>
                                                <p className="text-xs text-slate-400">{activity.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Additional Content */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <h3 className="text-lg font-semibold text-slate-900">Quick Actions</h3>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-3">
                                    <button className="p-4 bg-blue-50 rounded-lg text-center hover:bg-blue-100 transition-colors duration-200">
                                        <Users className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                                        <span className="text-sm font-medium text-blue-900">Add User</span>
                                    </button>
                                    <button className="p-4 bg-green-50 rounded-lg text-center hover:bg-green-100 transition-colors duration-200">
                                        <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                                        <span className="text-sm font-medium text-green-900">New Sale</span>
                                    </button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <h3 className="text-lg font-semibold text-slate-900">System Status</h3>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Server Status</span>
                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Online</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">Database</span>
                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Connected</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-600">API Status</span>
                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Healthy</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>

                <Footer />
            </div>
        </div>
    );
};

export default AdminPage;
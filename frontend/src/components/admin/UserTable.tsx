import React from 'react';

interface User {
    id: number;
    name: string;
    email: string;
    status: string;
    date: string;
}

interface UserTableProps {
    users: User[];
}

const UserTable: React.FC<UserTableProps> = ({ users }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-slate-100">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-slate-50">
                            <td className="px-4 py-3">{user.name}</td>
                            <td className="px-4 py-3">{user.email}</td>
                            <td className="px-4 py-3">
                                <span
                                    className={`px-2 py-1 text-xs rounded-full ${user.status === 'Active'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                        }`}
                                >
                                    {user.status}
                                </span>
                            </td>
                            <td className="px-4 py-3">{user.date}</td>
                            <td className="px-4 py-3 space-x-2">
                                <button className="text-blue-600 hover:text-blue-800">Edit</button>
                                <button className="text-red-600 hover:text-red-800">Delete</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default UserTable;
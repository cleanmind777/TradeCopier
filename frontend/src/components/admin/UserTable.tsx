import React from 'react';
import { User } from "../../types/user"

interface UserTableProps {
    users: User[] | null;
    onAccept: (userId: string) => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, onAccept }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="bg-slate-100">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Name</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Admin</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-600">Actions</th>
                    </tr>
                </thead>
                {users && (
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="border-b hover:bg-slate-50">
                                <td className="px-4 py-3">{user.name}</td>
                                <td className="px-4 py-3">{user.email}</td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`px-2 py-1 text-xs rounded-full ${user.is_accepted === true
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                    >
                                        {user.is_accepted ? (
                                            "Active"
                                        ) : "Peding"}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span
                                        className={`px-2 py-1 text-xs rounded-full ${user.admin_role === true
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                            }`}
                                    >
                                        {user.admin_role ? (
                                            "Yes"
                                        ) : "No"}
                                    </span>
                                </td>
                                <td className="px-4 py-3">{String(user.created_at)}</td>
                                <td className="px-4 py-3 space-x-2">
                                    {user.is_accepted ? (
                                        <button disabled className="text-gray-600 hover:text-gray-800">Accept</button>
                                    ) : (<button onClick={() => onAccept(user.id)} className="text-blue-600 hover:text-blue-800">Accept</button>)}
                                    {/* <button className="text-green-600 hover:text-green-800">View</button>
                                    <button className="text-red-600 hover:text-red-800">Delete</button> */}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                )}
            </table>
        </div>
    );
};

export default UserTable;
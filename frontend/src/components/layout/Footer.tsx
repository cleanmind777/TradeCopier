import React from 'react';
import { useAuth } from '../../context/AuthContext';
const APP_VERSION = import.meta.env.VITE_TRADECOPIER_VERSION || "DEV 1.0.0";

const Footer: React.FC = () => {
    const { user } = useAuth();

    return (
        <footer className="bg-white border-t border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-semibold text-slate-900">Welcome back, {user?.name}</h2>
                </div>
                <div className="text-sm text-slate-500">
                    Version: {APP_VERSION}
                </div>
            </div>
        </footer>
    );
};

export default Footer;
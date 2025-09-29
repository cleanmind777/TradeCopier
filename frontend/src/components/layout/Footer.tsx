import React from 'react';
import { useAuth } from '../../context/AuthContext';
const APP_VERSION = import.meta.env.VITE_TRADECOPIER_VERSION || "DEV 1.0.0";

const Footer: React.FC = () => {
    const { user } = useAuth();

    return (
        <footer className="bg-white border-t border-slate-200">
            <div className="container mx-auto px-6 py-4 text-center">
                <p className="text-sm text-slate-500">
                    Version: {APP_VERSION}
                </p>
            </div>
        </footer>
    );
};

export default Footer;
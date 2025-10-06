import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
};

const Modal = ({ isOpen, onClose, title, children, className }: ModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={clsx(
                "bg-white rounded-lg shadow-xl w-full max-w-screen-lg mx-4",
                className
            )}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                    <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
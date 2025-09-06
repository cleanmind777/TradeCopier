import React from 'react';
import clsx from 'clsx'; // Add this import

type LabelProps = {
    htmlFor: string;
    children: React.ReactNode;
    className?: string;
};

const Label = ({ htmlFor, children, className }: LabelProps) => {
    return (
        <label
            htmlFor={htmlFor}
            className={clsx(
                "block text-sm font-medium text-slate-700 mb-1",
                className
            )}
        >
            {children}
        </label>
    );
};

export default Label;
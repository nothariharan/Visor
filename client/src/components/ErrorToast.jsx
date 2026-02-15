import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import useStore from '../store';

export default function ErrorToast() {
    const { error, set } = useStore();
    const [visible, setVisible] = useState(false);
    const [currentError, setCurrentError] = useState(null);

    useEffect(() => {
        if (error) {
            setCurrentError(error);
            setVisible(true);
            const timer = setTimeout(() => {
                setVisible(false);
                setTimeout(() => {
                    set({ error: null });
                    setCurrentError(null);
                }, 300);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, set]);

    if (!visible || !currentError) return null;

    return (
        <div className="fixed top-16 right-4 z-[300] animate-in slide-in-from-top-2 fade-in font-mono">
            <div className="bg-base border-2 border-red shadow-hard-red rounded p-4 max-w-md">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-red flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h4 className="text-red font-bold text-sm uppercase">Error</h4>
                        <p className="text-subtext0 text-xs mt-1 break-words">{currentError}</p>
                    </div>
                    <button
                        onClick={() => {
                            setVisible(false);
                            setTimeout(() => set({ error: null }), 300);
                        }}
                        className="text-overlay0 hover:text-red transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

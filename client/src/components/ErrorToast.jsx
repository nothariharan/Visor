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
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in">
            <div className="bg-red-900/90 backdrop-blur-md border border-red-700 rounded-lg shadow-xl p-4 max-w-md">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h4 className="text-red-200 font-semibold text-sm">Error</h4>
                        <p className="text-red-300/80 text-xs mt-1">{currentError}</p>
                    </div>
                    <button 
                        onClick={() => {
                            setVisible(false);
                            setTimeout(() => set({ error: null }), 300);
                        }}
                        className="text-red-400 hover:text-red-200 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { Terminal } from 'lucide-react';
import useStore from '../store';

export default function SearchBar() {
    const [localQuery, setLocalQuery] = useState('');
    const [focused, setFocused] = useState(false);
    const { setSearchQuery } = useStore();

    // Sync local query with global store with a debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(localQuery);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [localQuery, setSearchQuery]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const command = localQuery.trim().toLowerCase();

            if (command === 'visor .') {
                window.open('http://localhost:3000', '_blank');
                setLocalQuery('');
            }
        }
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[500px]">
            <div className={`
        relative border-2 
        ${focused ? 'border-blue shadow-hard-hover' : 'border-surface1 shadow-hard'}
        bg-surface0 transition-all
      `}>
                {/* Input */}
                <div className="flex items-center px-3 py-2">
                    <Terminal size={14} className="text-blue mr-2" />
                    <input
                        type="text"
                        value={localQuery}
                        onChange={(e) => setLocalQuery(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setTimeout(() => setFocused(false), 200)}
                        onKeyDown={handleKeyDown}
                        placeholder="search files or run command..."
                        className="
              flex-1 bg-transparent text-text text-sm
              outline-none placeholder:text-subtext0
              font-mono
            "
                    />
                    {localQuery && (
                        <button
                            onClick={() => setLocalQuery('')}
                            className="text-subtext0 hover:text-red"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Autocomplete Results - Placeholder */}
                {focused && localQuery && (
                    <div className="border-t-2 border-surface1 bg-mantle max-h-64 overflow-auto p-2">
                        <div className="text-xs text-subtext0 italic">Computing...</div>
                    </div>
                )}
            </div>
        </div>
    );
}

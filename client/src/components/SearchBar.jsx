import React, { useState } from 'react';
import { Terminal } from 'lucide-react';

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);

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
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setTimeout(() => setFocused(false), 200)}
                        placeholder="search files or run command..."
                        className="
              flex-1 bg-transparent text-text text-sm
              outline-none placeholder:text-subtext0
              font-mono
            "
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            className="text-subtext0 hover:text-red"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Autocomplete Results - Placeholder */}
                {focused && query && (
                    <div className="border-t-2 border-surface1 bg-mantle max-h-64 overflow-auto p-2">
                        <div className="text-xs text-subtext0 italic">Computing...</div>
                    </div>
                )}
            </div>
        </div>
    );
}

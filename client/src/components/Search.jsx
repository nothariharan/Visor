import React, { useState } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import useStore from '../store';

const Search = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const { fetchGraph } = useStore();

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });
            const data = await res.json();

            if (data.expandedFolders) {
                // Update store with new expanded folders? 
                // Actually store needs to MERGE these.
                // We should expose an action for "expandPaths" in store.
                // For now, let's just use the toggle logic or direct set.
                // But store.js doesn't have setExpandedFolders exposed directly as action?
                // I need to update store.js to allow batch expansion.

                // Assuming I'll update store.js next:
                useStore.getState().expandPaths(data.expandedFolders);
            }
            setResults(`${data.matchCount} matches found`);
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col items-end">
            <form onSubmit={handleSearch} className="flex items-center bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-xl px-2 py-1.5 shadow-2xl">
                <SearchIcon size={18} className="text-slate-400 ml-1" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search files..."
                    className="bg-transparent border-none text-slate-200 text-sm px-3 py-1.5 focus:outline-none w-56"
                />
                {query && (
                    <button type="button" onClick={() => setQuery('')} className="p-1.5 text-slate-500 hover:text-white">
                        <X size={16} />
                    </button>
                )}
            </form>
            {results && <div className="text-sm text-slate-400 mt-1.5 mr-1">{results}</div>}
        </div>
    );
};

export default Search;

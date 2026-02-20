import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, File, Folder } from 'lucide-react';
import useStore from '../store';

const Search = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [nodeToFocus, setNodeToFocus] = useState(null);
    const searchRef = useRef(null);
    const { expandPaths, setFocusedNode, nodes } = useStore();

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch(query);
            } else {
                setResults([]);
                setIsOpen(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Effect to focus the node once it appears in the graph
    useEffect(() => {
        if (nodeToFocus) {
            // Normalize paths for comparison
            const normalize = (p) => p.replace(/\\/g, '/').toLowerCase();
            const target = normalize(nodeToFocus);

            const node = nodes.find(n => normalize(n.id) === target);

            if (node) {
                setFocusedNode(node.id); // Use the actual node ID from the graph
                setNodeToFocus(null); // Reset trigger
            }
        }
    }, [nodes, nodeToFocus, setFocusedNode]);

    const performSearch = async (searchQuery) => {
        setSearching(true);
        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery })
            });
            const data = await res.json();

            if (data.matches && Array.isArray(data.matches)) {
                setResults(data.matches);
                setIsOpen(true);
            } else {
                setResults([]);
            }
        } catch (err) {
            console.error("Search failed:", err);
            setResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleResultClick = (match) => {
        // Normalize path separators to forward slashes for consistency
        const normalize = (p) => p.replace(/\\/g, '/');
        const currentPath = normalize(match.path);

        const ancestors = [];

        // If it's a file, start from its parent directory
        let dir = currentPath;
        if (!match.isDirectory) {
            const lastSlash = dir.lastIndexOf('/');
            if (lastSlash !== -1) {
                dir = dir.substring(0, lastSlash);
            }
        }

        // Walk up the directory tree
        // We assume the project root is the top-most folder we care about.
        // But since we don't know the root path here easily, we just walk up until we hit a drive root or empty string.
        // The backend 'expandPaths' should handle paths that are outside the project gracefully (or ignore them).

        // Better approach: Use the relativePath from backend to determine how many levels to go up.
        // match.relativePath is relative to project root.

        if (match.relativePath) {
            const relParts = normalize(match.relativePath).split('/').filter(p => p);
            // If it's a file, the relative path is to the containing folder (from backend logic).
            // Wait, backend says: relativePath: path.relative(ROOT_DIR, dir)
            // where 'dir' is the directory containing the file.

            // So we just need to expand 'dir' and all its parents.

            let walker = dir;
            // Add the directory itself
            ancestors.push(walker);

            // Add parents based on relative path depth
            for (let i = 0; i < relParts.length; i++) {
                const lastSlash = walker.lastIndexOf('/');
                if (lastSlash === -1) break;
                walker = walker.substring(0, lastSlash);
                ancestors.push(walker);
            }
        } else {
            // Fallback if relativePath is missing
            ancestors.push(dir);
        }

        // Send un-normalized paths if the backend expects OS-specific paths?
        // Actually, the graph generation on backend likely uses OS-specific paths for IDs.
        // So we should probably use the original match.path for the nodeToFocus,
        // but we might need to be careful with expandPaths.
        // Let's send the original OS-specific paths for expansion to be safe,
        // but we calculated ancestors using normalized strings.
        // Let's revert ancestors to OS specific if needed?
        // Actually, let's just try sending the paths we calculated.
        // If the backend uses `path.resolve`, it should handle forward slashes on Windows fine.

        expandPaths(ancestors);
        setNodeToFocus(match.path);

        setIsOpen(false);
        setQuery('');
    };

    return (
        <div ref={searchRef} className="absolute top-4 right-4 z-50 w-[300px]">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon size={18} className="text-slate-400 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                    className="block w-full pl-10 pr-10 py-2 bg-slate-800/90 backdrop-blur-md border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 shadow-2xl transition-all text-sm"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); setIsOpen(false); }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                )}

                {/* Loading Indicator */}
                {searching && (
                    <div className="absolute inset-y-0 right-10 flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && results.length > 0 && (
                <div className="absolute mt-2 w-full bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto right-0">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900/50 border-b border-slate-700/50">
                        Files & Folders
                    </div>
                    <ul>
                        {results.map((match, index) => (
                            <li key={index}>
                                <button
                                    onClick={() => handleResultClick(match)}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-500/10 hover:border-l-4 border-l-4 border-transparent hover:border-blue-500 transition-all flex items-center gap-3 group"
                                >
                                    <div className="p-2 rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                                        {match.isDirectory ? <Folder size={18} /> : <File size={18} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-200 truncate group-hover:text-white">
                                            {match.name}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate font-mono mt-0.5">
                                            {match.relativePath}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {isOpen && results.length === 0 && !searching && (
                <div className="absolute mt-2 w-full bg-slate-800/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-4 text-center text-slate-400 text-sm right-0">
                    No results found for "{query}"
                </div>
            )}
        </div>
    );
};

export default Search;

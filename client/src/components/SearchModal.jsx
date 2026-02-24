import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { File, Folder, Clock, X, Search } from 'lucide-react';
import useStore from '../store';

export default function SearchModal({ isOpen, onClose }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [recentFiles, setRecentFiles] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);
    const { editingFile, setEditingFile } = useStore();

    // Get file extension for icon
    const getFileIcon = (ext) => {
        if (!ext) return <File size={14} className="text-subtext0" />;
        const ext_lower = ext.toLowerCase();
        if (['.jsx', '.tsx', '.js', '.ts'].includes(ext_lower)) return <File size={14} className="text-blue" />;
        if (['.css', '.scss', '.sass'].includes(ext_lower)) return <File size={14} className="text-sky" />;
        if (['.json', '.yaml', '.yml'].includes(ext_lower)) return <File size={14} className="text-yellow" />;
        if (['.md', '.txt'].includes(ext_lower)) return <File size={14} className="text-green" />;
        return <File size={14} className="text-subtext0" />;
    };

    // Highlight matched characters
    const highlightMatch = (name, positions) => {
        const chars = name.split('');
        const positionSet = new Set(positions);

        return (
            <>
                {chars.map((char, i) => (
                    <span
                        key={i}
                        className={positionSet.has(i) ? 'text-peach font-bold' : 'text-text'}
                    >
                        {char}
                    </span>
                ))}
            </>
        );
    };

    // Search files with debounce
    const searchFiles = useCallback(async (q) => {
        if (!q || q.length < 1) {
            setResults([]);
            setSelectedIndex(0);
            // Load recent files if query is empty
            try {
                const res = await axios.get('/api/search/recent');
                setRecentFiles(res.data.recent || []);
            } catch (e) {
                console.error('Failed to load recent files:', e);
            }
            return;
        }

        setLoading(true);
        try {
            const res = await axios.get('/api/search/files', { params: { q } });
            setResults(res.data.results || []);
            setSelectedIndex(0);
            setRecentFiles([]);
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            searchFiles(query);
        }, 150);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query, searchFiles]);

    // Auto-focus input when modal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            // Load recent files on open if no query
            if (!query) {
                searchFiles('');
            }
        }
    }, [isOpen, query, searchFiles]);

    // Handle keyboard navigation
    const handleKeyDown = (e) => {
        const displayItems = query ? results : recentFiles;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % displayItems.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + displayItems.length) % displayItems.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (displayItems.length > 0) {
                handleSelect(displayItems[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    // Handle file selection
    const handleSelect = async (item) => {
        try {
            // Track recent file
            await axios.post('/api/search/recent', { path: item.path });

            // Set editing file in store (opens in CodeEditor)
            setEditingFile({
                path: item.path,
                name: item.name || item.relativePath || item.path
            });

            // Close modal
            setQuery('');
            onClose();
        } catch (error) {
            console.error('Failed to select file:', error);
        }
    };

    if (!isOpen) return null;

    const displayItems = query ? results : recentFiles;

    return (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-start justify-center pt-20 animate-fadeIn">
            {/* Modal Container */}
            <div className="w-[600px] shadow-2xl rounded-lg overflow-hidden bg-surface0 border border-surface1">
                {/* Header / Input */}
                <div className="p-4 border-b border-surface1 flex items-center gap-2 bg-surface0">
                    {loading ? (
                        <div className="animate-spin text-blue">⟳</div>
                    ) : (
                        <Search size={16} className="text-blue" />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Search files by name... (Esc to close)"
                        className="flex-1 bg-transparent text-text outline-none placeholder:text-subtext0 text-sm font-mono"
                    />
                    <button
                        onClick={onClose}
                        className="text-subtext0 hover:text-red transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Results */}
                <div className="max-h-96 overflow-auto">
                    {displayItems.length === 0 ? (
                        <div className="p-8 text-center text-subtext0 text-sm">
                            {query ? (
                                <>
                                    <div className="mb-2">No files found for "{query}"</div>
                                    <div className="text-xs text-subtext1">Try a different query</div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-2">No recent files</div>
                                    <div className="text-xs text-subtext1">Start typing to search</div>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Header for recent/results */}
                            {!query && recentFiles.length > 0 && (
                                <div className="px-4 py-2 text-xs font-bold text-subtext1 bg-mantle border-b border-surface1 flex items-center gap-2">
                                    <Clock size={12} /> Recent Files
                                </div>
                            )}

                            {/* Items */}
                            {displayItems.map((item, idx) => (
                                <div
                                    key={item.path}
                                    onClick={() => handleSelect(item)}
                                    className={`px-4 py-3 cursor-pointer border-b border-surface1 transition-colors flex items-start gap-3 ${
                                        idx === selectedIndex
                                            ? 'bg-surface1 text-peach'
                                            : 'hover:bg-surface1 text-text'
                                    }`}
                                >
                                    {/* Icon */}
                                    <div className="mt-0.5 flex-shrink-0">
                                        {getFileIcon(item.ext)}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        {/* Filename with highlights */}
                                        <div className="font-mono text-sm truncate">
                                            {item.matchPositions && query ? (
                                                highlightMatch(item.name, item.matchPositions)
                                            ) : (
                                                item.name
                                            )}
                                        </div>

                                        {/* Filepath */}
                                        <div className="text-xs text-subtext1 truncate">
                                            {item.relativePath || item.path}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Result count */}
                            {query && results.length > 0 && (
                                <div className="px-4 py-2 text-xs text-subtext1 bg-mantle border-t border-surface1">
                                    {results.length} result{results.length !== 1 ? 's' : ''} found
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 bg-mantle border-t border-surface1 text-xs text-subtext1 flex justify-between">
                    <div>
                        <kbd className="px-1.5 py-0.5 rounded bg-surface0 border border-surface1 text-xs">↑↓</kbd>
                        <span className="ml-1">Navigate</span>
                        <span className="mx-2">•</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-surface0 border border-surface1 text-xs">Enter</kbd>
                        <span className="ml-1">Select</span>
                    </div>
                    <div>
                        <kbd className="px-1.5 py-0.5 rounded bg-surface0 border border-surface1 text-xs">Esc</kbd>
                        <span className="ml-1">Close</span>
                    </div>
                </div>
            </div>
        </div>
    );
}


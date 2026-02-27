import React, { useState, useEffect } from 'react';
import { RefreshCw, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import ForgeCard from './ForgeCard';

export default function ForgePanel() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    const fetchFolders = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/forge/executable-folders');
            if (!response.ok) throw new Error('Failed to fetch folders');

            const data = await response.json();
            setFolders(data.folders || []);
        } catch (err) {
            console.error("Failed to fetch executable folders:", err);
            setFolders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders();
    }, []);

    return (
        <div className="w-96 bg-crust border-l-2 border-surface1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="h-10 border-b-2 border-surface1 flex items-center justify-between px-4 bg-mantle">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-text">
                    <Terminal size={14} /> Forge Executables
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-subtext0 hover:text-text"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                        onClick={fetchFolders}
                        className="text-subtext0 hover:text-text"
                        title="Refresh Folders"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            {/* Folders List */}
            {isExpanded && (
                <div className="flex-1 overflow-auto p-3 space-y-3 bg-base">
                    {loading ? (
                        <div className="text-center text-xs text-subtext0 italic py-4">
                            Scanning for executable folders...
                        </div>
                    ) : folders.length > 0 ? (
                        folders.map((folder, index) => (
                            <ForgeCard key={index} folder={folder} />
                        ))
                    ) : (
                        <div className="text-center text-xs text-subtext0 mt-4">
                            No executable folders found.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

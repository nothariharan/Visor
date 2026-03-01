import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, GitCommit, AlertTriangle, ChevronDown, ChevronRight, Clock, User, Zap, X } from 'lucide-react';
import useStore from '../store';
import axios from 'axios';

// ---------- helpers ----------
function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
}

// ---------- CommitPreview ----------
function CommitPreview({ commit, onClose, onTravel, travelLoading }) {
    if (!commit) return null;
    return (
        <div className="border-t-2 border-surface1 bg-mantle flex flex-col max-h-64">
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface1">
                <span className="text-mauve font-bold text-xs uppercase tracking-wider">Preview</span>
                <button onClick={onClose} className="text-subtext0 hover:text-text"><X size={12} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-1">
                <p className="text-text text-xs font-semibold">{commit.message}</p>
                <p className="text-subtext0 text-[10px]">{commit.author} · {formatDate(commit.date)}</p>
                {commit.stats && (
                    <div className="flex gap-3 text-[10px] mt-1">
                        <span className="text-subtext0">{commit.stats.filesChanged} files</span>
                        <span className="text-green">+{commit.stats.insertions}</span>
                        <span className="text-red">-{commit.stats.deletions}</span>
                    </div>
                )}
                {commit.files && commit.files.length > 0 && (
                    <div className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
                        {commit.files.map(f => (
                            <div key={f.path} className="flex items-center gap-2 text-[10px] font-mono">
                                <span className="text-green">+{f.insertions}</span>
                                <span className="text-red">-{f.deletions}</span>
                                <span className="text-subtext1 truncate">{f.path}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="px-3 py-2 border-t border-surface1">
                <button
                    onClick={() => onTravel(commit.hash)}
                    disabled={travelLoading}
                    className="w-full py-1.5 bg-mauve text-crust text-[10px] font-bold uppercase tracking-wider shadow-hard hover:shadow-hard-hover active:translate-y-0.5 transition-all disabled:opacity-50"
                >
                    {travelLoading ? '⏳ Traveling...' : '⏮ Time Travel Here'}
                </button>
            </div>
        </div>
    );
}

// ---------- TimelineItem ----------
function TimelineItem({ commit, isActive, isCurrent, onPreview, onTravel, travelLoading }) {
    const dotColor = isActive
        ? 'bg-peach shadow-[0_0_8px_2px_rgba(250,179,135,0.6)]'
        : isCurrent
            ? 'bg-green shadow-[0_0_8px_2px_rgba(166,227,161,0.5)]'
            : 'bg-surface2 group-hover:bg-mauve group-hover:scale-110';

    return (
        <div className="relative flex gap-3 mb-1 group">
            {/* Timeline dot */}
            <div className="relative flex flex-col items-center">
                <div
                    className={`w-3 h-3 rounded-full border-2 border-crust mt-2 shrink-0 transition-all cursor-pointer ${dotColor}`}
                    onClick={() => onTravel(commit.hash)}
                    title="Travel to this commit"
                />
            </div>

            {/* Card */}
            <div
                className={`flex-1 mb-2 p-2.5 border cursor-pointer transition-all rounded-sm
                    ${isActive ? 'bg-surface0 border-peach' : 'bg-mantle border-surface1 hover:border-surface2'}`}
                onClick={() => onPreview(commit.hash)}
            >
                <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-[10px] font-bold ${isActive ? 'text-peach' : 'text-blue'}`}>
                        {commit.shortHash}
                    </span>
                    <div className="flex gap-1 items-center">
                        {isCurrent && (
                            <span className="text-green text-[9px] font-bold uppercase tracking-wider px-1 bg-green/10 rounded">HEAD</span>
                        )}
                        {commit.refs && (
                            <span className="text-mauve text-[9px] px-1 bg-mauve/10 rounded truncate max-w-[80px]">
                                {commit.refs.split(',')[0].trim()}
                            </span>
                        )}
                    </div>
                </div>
                <p className="text-text text-xs leading-snug line-clamp-2">{commit.message}</p>
                <div className="flex items-center gap-2 mt-1 text-[9px] text-subtext0">
                    <User size={9} />
                    <span>{commit.author}</span>
                    <Clock size={9} />
                    <span>{formatDate(commit.date)}</span>
                </div>
            </div>
        </div>
    );
}

// ---------- Main ChroniclePanel ----------
export default function ChroniclePanel() {
    const {
        commits, commitsLoading,
        isDetached, currentCommit, timeTravelLoading,
        fetchHistory, initChronicleHead, timeTravelTo, returnToPresent
    } = useStore();

    const [selectedCommit, setSelectedCommit] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [stashWarning, setStashWarning] = useState(null); // pending hash needing confirmation

    useEffect(() => {
        fetchHistory();
        initChronicleHead();
    }, []);

    const handlePreview = useCallback(async (hash) => {
        if (selectedCommit === hash) {
            setSelectedCommit(null);
            setPreviewData(null);
            return;
        }
        setSelectedCommit(hash);
        setPreviewData(null);
        setPreviewLoading(true);
        try {
            const res = await axios.get(`/api/chronicle/commit/${hash}`);
            if (res.data.success) setPreviewData(res.data.commit);
        } catch (e) { }
        setPreviewLoading(false);
    }, [selectedCommit]);

    const handleTravel = useCallback(async (hash, force = false) => {
        setStashWarning(null);
        const result = await timeTravelTo(hash, force);
        if (!result?.success && result?.warnings?.uncommittedChanges) {
            setStashWarning(hash);
        }
    }, [timeTravelTo]);

    const handleReturn = useCallback(async () => {
        const result = await returnToPresent();
        if (result?.success) {
            setSelectedCommit(null);
            setPreviewData(null);
            fetchHistory();
            initChronicleHead();
        } else {
            const errorMsg = result?.error || 'Unknown error';
            const details = result?.details ? `\n\nDetails: ${result.details}` : '';
            const recovery = result?.recovery ? `\n\nRecovery: ${result.recovery}` : '';
            alert(`Failed to return to present: ${errorMsg}${details}${recovery}`);
        }
    }, [returnToPresent, fetchHistory, initChronicleHead]);

    const currentIndex = currentCommit
        ? commits.findIndex(c => c.hash === currentCommit)
        : -1;

    return (
        <div className="flex flex-col h-full bg-base font-mono select-none overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-surface1 bg-mantle">
                <span className="text-mauve flex items-center gap-1.5 font-bold text-xs uppercase tracking-tighter">
                    <GitBranch size={12} />
                    {isDetached
                        ? <span className="text-peach animate-pulse">⚠ DETACHED HEAD</span>
                        : 'Timeline'}
                </span>
                {isDetached && (
                    <button
                        onClick={handleReturn}
                        disabled={timeTravelLoading}
                        className="text-[9px] px-2 py-1 bg-red text-crust font-bold uppercase shadow-hard hover:shadow-hard-hover transition-all disabled:opacity-50"
                    >
                        {timeTravelLoading ? '...' : '✕ Return'}
                    </button>
                )}
                {!isDetached && (
                    <button
                        onClick={() => { fetchHistory(); initChronicleHead(); }}
                        className="text-[9px] text-subtext0 hover:text-text px-2 py-1 bg-surface1/30 hover:bg-surface1 rounded transition-colors"
                    >
                        ↻ Refresh
                    </button>
                )}
            </div>

            {/* Stats bar when in time travel */}
            {isDetached && currentCommit && (
                <div className="px-3 py-1.5 bg-peach/10 border-b border-peach/30 text-[10px] text-peach">
                    Viewing commit <span className="font-bold">{currentCommit.substring(0, 7)}</span>
                    {currentIndex >= 0 && <span className="text-subtext0 ml-1">({currentIndex + 1} of {commits.length})</span>}
                </div>
            )}

            {/* Stash Warning Dialog */}
            {stashWarning && (
                <div className="absolute inset-0 bg-crust/80 backdrop-blur-[1px] z-50 flex items-center justify-center p-6">
                    <div className="bg-mantle border-2 border-yellow p-4 shadow-hard text-center space-y-3">
                        <AlertTriangle size={28} className="text-yellow mx-auto" />
                        <p className="text-text text-xs font-bold">Uncommitted Changes Detected</p>
                        <p className="text-subtext0 text-[10px] max-w-[220px]">
                            Your current changes will be auto-stashed and restored when you return. Continue?
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStashWarning(null)}
                                className="flex-1 py-1.5 text-[10px] uppercase font-bold bg-surface1 text-text hover:bg-surface2 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleTravel(stashWarning, true)}
                                className="flex-1 py-1.5 text-[10px] uppercase font-bold bg-yellow text-crust hover:bg-yellow/80 transition-colors"
                            >
                                Stash &amp; Travel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Timeline scroll area */}
            <div className="flex-1 overflow-y-auto px-3 pt-3 scrollbar-thin scrollbar-thumb-surface1 scrollbar-track-transparent">
                {commitsLoading ? (
                    <div className="flex items-center justify-center gap-2 pt-10 text-subtext0 text-xs animate-pulse">
                        <GitCommit size={16} className="animate-spin" />
                        Loading history...
                    </div>
                ) : commits.length === 0 ? (
                    <div className="text-center text-subtext0 text-xs pt-10 space-y-2">
                        <GitBranch size={28} className="mx-auto opacity-40" />
                        <p className="uppercase tracking-widest text-[10px]">No commits found</p>
                        <p className="text-[10px] opacity-60">Init git and make your first commit to see the timeline.</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-[5px] top-0 bottom-0 w-[2px] bg-surface1 rounded-full" />
                        {commits.map((commit, index) => (
                            <TimelineItem
                                key={commit.hash}
                                commit={commit}
                                isActive={currentCommit === commit.hash}
                                isCurrent={!isDetached && index === 0}
                                onPreview={handlePreview}
                                onTravel={handleTravel}
                                travelLoading={timeTravelLoading}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Commit Preview Panel */}
            {selectedCommit && (
                <CommitPreview
                    commit={previewLoading ? null : previewData}
                    onClose={() => { setSelectedCommit(null); setPreviewData(null); }}
                    onTravel={handleTravel}
                    travelLoading={timeTravelLoading}
                />
            )}
        </div>
    );
}

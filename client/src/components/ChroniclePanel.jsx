import React, { useState, useEffect } from 'react';
import { GitBranch, AlertTriangle, ChevronDown, ChevronRight, X, RotateCcw, ArrowDown, ArrowUp } from 'lucide-react';
import useStore from '../store';
import axios from 'axios';

const InlineDiff = ({ diff }) => {
    if (!diff) return null;

    return (
        <div className="diff-preview font-mono text-[10px] bg-mantle p-2 border-t border-surface1 overflow-x-auto whitespace-pre">
            {diff.split('\n').map((line, i) => {
                let colorClass = 'text-subtext0';
                if (line.startsWith('+')) colorClass = 'text-green';
                else if (line.startsWith('-')) colorClass = 'text-red';
                else if (line.startsWith('@@')) colorClass = 'text-mauve';

                return (
                    <div key={i} className={`${colorClass} leading-tight`}>
                        {line}
                    </div>
                );
            })}
        </div>
    );
};

export default function ChroniclePanel() {
    const {
        chronicleStatus,
        chronicleLoading,
        stagingFiles,
        pushPullLoading,
        commitLoading,
        chronicleError,
        fetchChronicleStatus,
        stageFiles,
        unstageFiles,
        commitChanges,
        discardFiles,
        pushChanges,
        pullChanges,
        undoLastCommit,
        clearChronicleError,
        openFile
    } = useStore();

    const [commitMessage, setCommitMessage] = useState('');
    const [commitError, setCommitError] = useState(null);
    const [expandedDiffs, setExpandedDiffs] = useState(new Set());
    const [fileDiffs, setFileDiffs] = useState({});
    const [pendingDiscard, setPendingDiscard] = useState(null);

    useEffect(() => {
        fetchChronicleStatus();
    }, []);

    const toggleDiff = async (e, filePath) => {
        e.stopPropagation();
        if (expandedDiffs.has(filePath)) {
            setExpandedDiffs(prev => {
                const next = new Set(prev);
                next.delete(filePath);
                return next;
            });
        } else {
            try {
                const res = await axios.get('/api/chronicle/diff', { params: { path: filePath } });
                if (res.data.success) {
                    setFileDiffs(prev => ({ ...prev, [filePath]: res.data.diff }));
                    setExpandedDiffs(prev => new Set([...prev, filePath]));
                }
            } catch (err) {
                console.error('Failed to fetch diff', err);
            }
        }
    };

    const handleCommit = async () => {
        if (!commitMessage.trim()) {
            setCommitError('Message cannot be empty');
            return;
        }
        if (commitMessage.trim().length < 3) {
            setCommitError('Too short (min 3 chars)');
            return;
        }
        setCommitError(null);
        const result = await commitChanges(commitMessage.trim());
        if (result.success) {
            setCommitMessage('');
        }
    };

    const handlePush = () => pushChanges();
    const handlePull = () => pullChanges();
    const handleUndo = () => undoLastCommit();

    const toggleStage = (file, isStaged) => {
        if (isStaged) {
            unstageFiles([file]);
        } else {
            stageFiles([file]);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleCommit();
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                handlePush();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [commitMessage, chronicleStatus]);

    if (chronicleLoading && !chronicleStatus) {
        return (
            <div className="flex-1 flex items-center justify-center text-subtext0 animate-pulse">
                <GitBranch size={24} className="mr-2" />
                Scanning history...
            </div>
        );
    }

    if (!chronicleStatus || !chronicleStatus.success) {
        return (
            <div className="flex-1 p-4 text-center text-subtext0 flex flex-col items-center justify-center opacity-70">
                <GitBranch size={32} className="mb-2" />
                <p className="font-mono text-xs uppercase tracking-widest">◉ not a git repository</p>
                <p className="mt-4 text-[10px]">Initialize git to track changes.</p>
            </div>
        );
    }

    const { branch, ahead, behind, modified, untracked, staged, deleted, conflicted } = chronicleStatus;
    const hasChanges = modified.length > 0 || untracked.length > 0 || staged.length > 0 || deleted.length > 0 || conflicted.length > 0;

    const renderFileRow = (file, type) => {
        const isStaged = type === 'staged';
        const isConflicted = type === 'conflicted';
        const isModified = type === 'modified';
        const isUntracked = type === 'untracked';
        const isDeleted = type === 'deleted';

        let badgeClass = 'bg-peach/10 text-peach';
        let badgeLetter = 'M';
        if (isStaged) { badgeClass = 'bg-blue/10 text-blue'; badgeLetter = 'S'; }
        else if (isUntracked) { badgeClass = 'bg-green/10 text-green'; badgeLetter = 'U'; }
        else if (isDeleted) { badgeClass = 'bg-red/10 text-red'; badgeLetter = 'D'; }
        else if (isConflicted) { badgeClass = 'bg-red text-crust'; badgeLetter = '⚡'; }

        return (
            <div key={file} className="group flex flex-col border-b border-surface1/30 last:border-0 hover:bg-surface0/50 transition-colors">
                <div className="flex items-center py-1.5 px-2 gap-2">
                    {!isConflicted && (
                        <input
                            type="checkbox"
                            checked={isStaged}
                            onChange={() => toggleStage(file, isStaged)}
                            className="w-3 h-3 rounded-sm border-surface2 bg-mantle text-peach focus:ring-peach cursor-pointer"
                        />
                    )}

                    {stagingFiles.has(file) && <span className="animate-spin text-[10px] text-peach">⏳</span>}

                    <span className={`text-[9px] font-bold px-1 rounded min-w-[14px] text-center ${badgeClass}`}>
                        {badgeLetter}
                    </span>

                    <span
                        onClick={() => openFile(file, file.split(/[/\\]/).pop())}
                        className="font-mono text-xs truncate flex-1 cursor-pointer hover:text-text"
                    >
                        {file}
                    </span>

                    <div className="flex gap-1">
                        <button
                            onClick={(e) => toggleDiff(e, file)}
                            className="text-[10px] bg-surface1/30 px-1 text-subtext1 hover:text-text rounded"
                        >
                            {expandedDiffs.has(file) ? 'hide' : 'diff'}
                        </button>

                        {(isModified || isDeleted) && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setPendingDiscard(file); }}
                                className="text-red/50 hover:text-red p-0.5 rounded transition-colors"
                                title="Discard changes"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
                {expandedDiffs.has(file) && <InlineDiff diff={fileDiffs[file]} />}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-base font-mono select-none overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between p-2 border-b border-surface1 bg-mantle">
                <div className="flex items-center gap-2">
                    <span className="text-mauve flex items-center gap-1 font-bold text-xs uppercase tracking-tighter">
                        <GitBranch size={12} /> {branch}
                    </span>
                    {(ahead > 0 || behind > 0) && (
                        <div className="flex gap-2 text-[10px]">
                            {ahead > 0 && <span className="text-green">↑{ahead}</span>}
                            {behind > 0 && <span className="text-yellow">↓{behind}</span>}
                        </div>
                    )}
                </div>

                <div className="flex gap-1">
                    <button
                        onClick={handlePull}
                        disabled={pushPullLoading}
                        className="flex items-center gap-1 px-2 py-0.5 bg-surface1/30 text-[10px] text-subtext1 hover:bg-surface1 hover:text-text rounded transition-all disabled:opacity-50"
                    >
                        <ArrowDown size={10} />
                    </button>
                    <button
                        onClick={handlePush}
                        disabled={pushPullLoading || ahead === 0}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-all shadow-hard disabled:opacity-50 disabled:shadow-none
                            ${ahead > 0 ? 'bg-mauve text-crust hover:shadow-hard-hover' : 'bg-surface1/30 text-subtext1'}
                        `}
                    >
                        <ArrowUp size={10} /> {pushPullLoading ? '...' : (ahead || '')}
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {chronicleError && (
                <div className="bg-red/10 border-b border-red/50 text-red p-2 text-[10px] flex items-start gap-2 animate-in fade-in slide-in-from-top duration-300">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5 font-bold" />
                    <span className="flex-1">{chronicleError.message}</span>
                    <button onClick={clearChronicleError} className="hover:text-white"><X size={12} /></button>
                </div>
            )}

            {/* Stats Summary */}
            <div className="text-[10px] text-subtext0 flex justify-around py-1.5 border-b border-surface1/50 bg-base/50 tracking-tighter">
                <span className={staged.length > 0 ? 'text-blue' : ''}>{staged.length} staged</span>
                <span className={modified.length > 0 ? 'text-peach' : ''}>{modified.length} changed</span>
                <span className={untracked.length > 0 ? 'text-green' : ''}>{untracked.length} new</span>
                {deleted.length > 0 && <span className="text-red">{deleted.length} deleted</span>}
            </div>

            {/* Bulk Actions */}
            <div className="flex p-1 border-b border-surface1/50 bg-mantle gap-1">
                <button
                    onClick={() => stageFiles([...modified, ...untracked])}
                    className="flex-1 py-1 text-[9px] uppercase font-bold text-subtext1 hover:text-text hover:bg-surface0 rounded transition-colors"
                >
                    Stage All
                </button>
                <button
                    onClick={() => unstageFiles(staged)}
                    className="flex-1 py-1 text-[9px] uppercase font-bold text-subtext1 hover:text-text hover:bg-surface0 rounded transition-colors"
                >
                    Unstage All
                </button>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface1 scrollbar-track-transparent">
                {!hasChanges && (
                    <div className="flex flex-col items-center justify-center h-40 opacity-40">
                        <span className="text-green text-sm">◉</span>
                        <span className="text-[10px] uppercase tracking-widest mt-2">working tree clean</span>
                    </div>
                )}

                {conflicted.length > 0 && (
                    <div className="mb-2">
                        <div className="px-2 py-1 text-[9px] uppercase font-bold text-red bg-red/5 border-b border-red/20 flex items-center gap-1">
                            <AlertTriangle size={10} /> Merge Conflicts ({conflicted.length})
                        </div>
                        {conflicted.map(f => renderFileRow(f, 'conflicted'))}
                    </div>
                )}

                {staged.length > 0 && (
                    <div className="mb-2">
                        <div className="px-2 py-1 text-[9px] uppercase font-bold text-blue bg-blue/5 border-b border-blue/20">
                            Staged for commit ({staged.length})
                        </div>
                        {staged.map(f => renderFileRow(f, 'staged'))}
                    </div>
                )}

                {(modified.length > 0 || deleted.length > 0 || untracked.length > 0) && (
                    <div>
                        <div className="px-2 py-1 text-[9px] uppercase font-bold text-peach bg-peach/5 border-b border-peach/20">
                            Changes ({modified.length + deleted.length + untracked.length})
                        </div>
                        {modified.map(f => renderFileRow(f, 'modified'))}
                        {deleted.map(f => renderFileRow(f, 'deleted'))}
                        {untracked.map(f => renderFileRow(f, 'untracked'))}
                    </div>
                )}
            </div>

            {/* Commit Area */}
            <div className="p-3 border-t border-surface1 bg-crust space-y-2">
                <div className="relative">
                    <textarea
                        value={commitMessage}
                        onChange={(e) => { setCommitMessage(e.target.value); setCommitError(null); }}
                        placeholder='Commit message...'
                        className={`w-full bg-mantle text-xs font-mono text-text border p-2 resize-none transition-all
                            ${commitError ? 'border-red/50 shadow-hard-red' : 'border-surface1 hover:border-surface2 focus:border-peach'}
                        `}
                        rows={2}
                    />
                    <div className={`absolute bottom-2 right-2 text-[9px] select-none
                        ${commitMessage.length > 72 ? 'text-yellow animate-pulse' : 'text-subtext1'}
                    `}>
                        {commitMessage.length}/72
                    </div>
                </div>

                {commitError && (
                    <p className="text-[9px] text-red uppercase font-bold flex items-center gap-1 animate-in zoom-in-95">
                        <AlertTriangle size={10} /> {commitError}
                    </p>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handleCommit}
                        disabled={commitLoading || staged.length === 0}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-all shadow-hard
                            ${commitLoading || staged.length === 0
                                ? 'bg-surface1 text-subtext0 opacity-40 shadow-none cursor-not-allowed'
                                : 'bg-mauve text-crust hover:shadow-hard-hover active:translate-x-0.5 active:translate-y-0.5'
                            }
                        `}
                    >
                        {commitLoading ? 'Processing...' : `Commit Staged (${staged.length})`}
                    </button>

                    <button
                        onClick={handleUndo}
                        className="w-10 flex items-center justify-center border border-surface1 hover:bg-surface0 text-yellow rounded shadow-hard hover:shadow-hard-hover transition-all"
                        title="Undo Last Commit"
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            {/* Discard Confirmation Overlay */}
            {pendingDiscard && (
                <div className="absolute inset-0 bg-crust/80 backdrop-blur-[1px] flex items-center justify-center p-6 z-50 animate-in fade-in">
                    <div className="bg-mantle border-2 border-red p-4 shadow-hard flex flex-col items-center text-center">
                        <AlertTriangle size={32} className="text-red mb-2" />
                        <h3 className="text-sm font-bold text-text uppercase">Irreversible Action</h3>
                        <p className="text-[10px] text-subtext0 mt-1 max-w-[200px]">
                            Discarding changes in <span className="text-peach font-bold">{pendingDiscard}</span> cannot be undone.
                        </p>
                        <div className="flex w-full gap-2 mt-4">
                            <button
                                onClick={() => setPendingDiscard(null)}
                                className="flex-1 py-2 text-[10px] uppercase font-bold bg-surface1 text-text hover:bg-surface2 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { discardFiles([pendingDiscard]); setPendingDiscard(null); }}
                                className="flex-1 py-2 text-[10px] uppercase font-bold bg-red text-crust hover:bg-red/80 transition-colors"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

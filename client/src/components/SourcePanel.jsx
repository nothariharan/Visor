import React, { useState, useEffect } from 'react';
import { GitBranch, FileDiff, CheckSquare, Square, Upload, GitCommit, RefreshCw } from 'lucide-react';
import useStore from '../store';

export default function SourcePanel() {
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
        pushChanges,
        clearChronicleError
    } = useStore();

    const [commitMsg, setCommitMsg] = useState('');

    useEffect(() => {
        fetchChronicleStatus();
    }, []);

    // Build a unified list of changed files from chronicleStatus
    const modified = chronicleStatus?.modified || [];
    const staged = chronicleStatus?.staged || [];
    const untracked = chronicleStatus?.untracked || [];
    const deleted = chronicleStatus?.deleted || [];
    const created = chronicleStatus?.created || [];

    // Generate flat list with status tag
    const allFiles = [
        ...staged.map(f => ({ path: f, tag: 'S', isStaged: true })),
        ...modified.filter(f => !staged.includes(f)).map(f => ({ path: f, tag: 'M', isStaged: false })),
        ...created.filter(f => !staged.includes(f)).map(f => ({ path: f, tag: 'A', isStaged: false })),
        ...untracked.filter(f => !staged.includes(f)).map(f => ({ path: f, tag: '?', isStaged: false })),
        ...deleted.filter(f => !staged.includes(f)).map(f => ({ path: f, tag: 'D', isStaged: false })),
    ];

    const isStagingFile = (path) => stagingFiles?.has ? stagingFiles.has(path) : false;

    const handleToggle = async (file) => {
        if (file.isStaged) {
            await unstageFiles([file.path]);
        } else {
            await stageFiles([file.path]);
        }
    };

    const handleStageAll = async () => {
        const unstaged = allFiles.filter(f => !f.isStaged).map(f => f.path);
        if (unstaged.length) await stageFiles(unstaged);
    };

    const handleCommit = async () => {
        if (!commitMsg.trim() || staged.length === 0) return;
        const result = await commitChanges(commitMsg.trim());
        if (result?.success) setCommitMsg('');
    };

    const handlePush = async () => {
        await pushChanges();
    };

    const tagColor = {
        S: 'text-blue',
        M: 'text-yellow',
        A: 'text-green',
        '?': 'text-green',
        D: 'text-red',
    };

    return (
        <div className="flex flex-col h-full bg-base font-mono overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface1 bg-mantle">
                <span className="text-blue flex items-center gap-1.5 font-bold text-xs uppercase tracking-tighter">
                    <GitBranch size={12} />
                    Source
                    {chronicleStatus?.branch && (
                        <span className="text-subtext0 font-normal normal-case ml-1">
                            › {chronicleStatus.branch}
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    {chronicleStatus?.ahead > 0 && (
                        <span className="text-[9px] text-green bg-green/10 px-1.5 py-0.5">
                            ↑{chronicleStatus.ahead}
                        </span>
                    )}
                    {chronicleStatus?.behind > 0 && (
                        <span className="text-[9px] text-red bg-red/10 px-1.5 py-0.5">
                            ↓{chronicleStatus.behind}
                        </span>
                    )}
                    <button
                        onClick={fetchChronicleStatus}
                        disabled={chronicleLoading}
                        className="text-subtext0 hover:text-text transition-colors"
                        title="Refresh git status"
                    >
                        <RefreshCw size={11} className={chronicleLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {chronicleError && (
                <div className="px-3 py-2 bg-red/10 border-b border-red/30 text-red text-[10px] flex justify-between items-center">
                    <span className="truncate">{chronicleError.message}</span>
                    <button onClick={clearChronicleError} className="hover:text-text ml-2 shrink-0">✕</button>
                </div>
            )}

            {/* Files List */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-surface1 scrollbar-track-transparent">
                {/* Subheader */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                    <span className="text-subtext0 text-[10px] uppercase tracking-widest">
                        Changes · {allFiles.length}
                    </span>
                    {allFiles.some(f => !f.isStaged) && (
                        <button
                            onClick={handleStageAll}
                            className="text-[9px] text-blue hover:text-text uppercase tracking-wider"
                        >
                            Stage All +
                        </button>
                    )}
                </div>

                {allFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 pt-10 text-subtext0">
                        <FileDiff size={24} className="opacity-30" />
                        <span className="text-[10px] uppercase tracking-widest opacity-60">
                            {chronicleLoading ? 'Loading...' : 'Clean working tree'}
                        </span>
                    </div>
                ) : (
                    <div className="px-2 pb-2 space-y-0.5">
                        {allFiles.map(file => (
                            <div
                                key={file.path}
                                onClick={() => !isStagingFile(file.path) && handleToggle(file)}
                                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-sm transition-all
                                    ${file.isStaged ? 'bg-surface0/60' : 'hover:bg-mantle'}
                                    ${isStagingFile(file.path) ? 'opacity-50 pointer-events-none' : ''}
                                `}
                            >
                                {file.isStaged
                                    ? <CheckSquare size={12} className="text-blue shrink-0" />
                                    : <Square size={12} className="text-surface2 shrink-0" />
                                }
                                <span className={`text-[10px] font-bold w-4 shrink-0 ${tagColor[file.tag] || 'text-text'}`}>
                                    {file.tag}
                                </span>
                                <span className="text-text text-[10px] truncate font-mono flex-1" title={file.path}>
                                    {file.path.split(/[\\/]/).pop() || file.path}
                                </span>
                                <span className="text-subtext0 text-[9px] truncate hidden max-w-[80px]">
                                    {file.path}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Commit Section */}
            <div className="border-t-2 border-surface1 bg-mantle p-3 space-y-2 shrink-0">
                <div className="flex items-center gap-1.5 mb-1">
                    <GitCommit size={11} className="text-subtext0" />
                    <span className="text-subtext0 text-[10px] uppercase tracking-widest">Commit</span>
                    {staged.length > 0 && (
                        <span className="text-blue text-[9px] bg-blue/10 px-1.5 py-0.5 ml-auto">
                            {staged.length} staged
                        </span>
                    )}
                </div>

                <textarea
                    value={commitMsg}
                    onChange={e => setCommitMsg(e.target.value)}
                    placeholder="feat: describe your changes..."
                    rows={3}
                    className="w-full bg-surface0 border border-surface1 focus:border-blue text-text text-[11px] font-mono p-2 resize-none outline-none placeholder-surface2 leading-relaxed"
                />

                <div className="flex gap-2">
                    <button
                        onClick={handleCommit}
                        disabled={!commitMsg.trim() || staged.length === 0 || commitLoading}
                        className="flex-1 py-1.5 bg-blue text-crust text-[10px] font-bold uppercase tracking-wider
                            shadow-hard hover:translate-y-[1px] hover:shadow-none transition-all
                            disabled:opacity-40 disabled:pointer-events-none"
                    >
                        {commitLoading ? '...' : 'Commit'}
                    </button>
                    <button
                        onClick={handlePush}
                        disabled={pushPullLoading}
                        className="px-3 py-1.5 bg-surface1 text-text text-[10px] font-bold uppercase tracking-wider
                            shadow-hard hover:translate-y-[1px] hover:shadow-none transition-all
                            disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1"
                        title="Push to origin"
                    >
                        <Upload size={11} />
                        Push
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState } from 'react';
import { Play, Square, Loader2, Folder, FileText, ExternalLink, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';

const ForgeCard = ({ folder, status, isActive, onClick, onRun, onStop, url }) => {
    // Status can be: 'stopped', 'starting', 'running', 'stopping', 'error'
    const isRunning = status === 'starting' || status === 'running';

    const [patching, setPatching] = useState(false);
    const [patchState, setPatchState] = useState('unknown'); // 'unknown' | 'patched' | 'error'

    const handlePatch = async (e) => {
        e.stopPropagation();
        setPatching(true);
        try {
            const res = await fetch('/api/project/patch-html', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: folder.path })
            });
            const data = await res.json();
            if (data.success) {
                setPatchState('patched');
                // Restart so injected script loads
                onStop();
                setTimeout(() => onRun(), 800);
            } else {
                setPatchState('error');
            }
        } catch (err) {
            setPatchState('error');
        } finally {
            setPatching(false);
        }
    };

    const renderMetadata = () => {
        const { metadata, executables } = folder;
        const execNames = executables ? executables.map(e => e.name).join(', ') : '';

        return (
            <div className="text-[10px] text-subtext1 mt-1 space-y-1">
                {metadata?.fileCount !== undefined && <span>{metadata.fileCount} files</span>}
                {metadata?.lastModified && (
                    <span className="block text-[10px] opacity-70">
                        Modified: {new Date(metadata.lastModified).toLocaleDateString()}
                    </span>
                )}
                {execNames && (
                    <div className="flex items-center gap-1 mt-1">
                        <FileText size={10} />
                        <span className="truncate" title={execNames}>{execNames}</span>
                    </div>
                )}
            </div>
        );
    };

    const statusColors = {
        stopped: 'text-subtext0 bg-surface0',
        starting: 'text-yellow bg-surface0 animate-pulse',
        running: 'text-green bg-surface0',
        stopping: 'text-yellow bg-surface0',
        error: 'text-red bg-surface0'
    };

    return (
        <div
            onClick={onClick}
            className={`p-3 rounded-md border flex flex-col gap-2 cursor-pointer transition-colors
                ${isActive ? 'border-blue bg-mantle shadow-md' : 'border-surface1 bg-crust hover:border-surface2'}
            `}
        >
            <div className="flex items-center gap-2">
                <Folder size={16} className={`shrink-0 ${isActive ? 'text-blue' : 'text-subtext0'}`} />
                <h4 className="text-sm font-bold text-text truncate flex-1" title={folder.name}>
                    {folder.name}
                </h4>
            </div>

            <p className="text-xs text-subtext0 line-clamp-2 min-h-[2.5em]">
                {folder.description || 'No description provided.'}
            </p>

            {renderMetadata()}

            {/* Error tracking status — shown when running */}
            {isRunning && (
                <div
                    onClick={patchState !== 'patched' ? handlePatch : undefined}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[11px] font-medium transition-colors cursor-pointer select-none
                        ${patchState === 'patched'
                            ? 'border-green/30 bg-green/5 text-green cursor-default'
                            : patchState === 'error'
                                ? 'border-red/30 bg-red/10 text-red hover:bg-red/20'
                                : 'border-yellow/30 bg-yellow/5 text-yellow hover:bg-yellow/10 animate-pulse'
                        }`}
                    title={patchState === 'patched' ? 'Visor error tracking is active' : 'Click to enable Visor error tracking in your app'}
                >
                    {patchState === 'patched'
                        ? <><ShieldCheck size={12} className="shrink-0" /> <span>Visor Tracking Active</span></>
                        : patchState === 'error'
                            ? <><ShieldAlert size={12} className="shrink-0" /> <span>Tracking failed — retry</span></>
                            : patching
                                ? <><Loader2 size={12} className="animate-spin shrink-0" /> <span>Injecting tracker...</span></>
                                : <><Shield size={12} className="shrink-0" /> <span>⚡ Click to enable error tracking</span></>
                    }
                </div>
            )}

            {status === 'error' && (
                <div className="text-red text-xs mt-1 bg-red/10 p-1 rounded border border-red/20">
                    Process exited with error.
                </div>
            )}

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface1">
                <div className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${statusColors[status]}`}>
                    {status}
                </div>

                <div className="flex gap-2">
                    {isRunning && url && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center gap-1 px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors bg-blue/20 text-blue hover:bg-blue/30"
                            title={`Open ${url}`}
                        >
                            <ExternalLink size={12} /> Open
                        </a>
                    )}
                    {status === 'stopped' || status === 'error' ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setPatchState('unknown');
                                onRun();
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors bg-green/20 text-green hover:bg-green/30"
                            title="Run"
                        >
                            <Play size={12} /> Run
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStop();
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors bg-red/20 text-red hover:bg-red/30"
                            title="Stop"
                        >
                            {status === 'starting' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />} Stop
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgeCard;

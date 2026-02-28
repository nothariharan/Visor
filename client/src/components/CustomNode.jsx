import React, { memo, useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { FileCode, FileJson, File, AlertCircle, ExternalLink, Eye, Rocket, Star, Pencil } from 'lucide-react';
import useStore from '../store';

const getIcon = (filename) => {
    if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FileCode size={16} className="text-blue-400" />;
    if (filename.endsWith('.json')) return <FileJson size={16} className="text-yellow-400" />;
    return <File size={16} className="text-slate-400" />;
};

const CustomNode = ({ id, data, isConnectable }) => {
    const { label, git, health, isEntryPoint, isCentral, criticalReason } = data;
    const { focusedNode, setFocusedNode, openFile } = useStore();
    const isFocused = focusedNode === id;
    const [executionState, setExecutionState] = useState(null);

    const { activeErrors, executionStates, isFixing, handleAIFix } = useStore();

    // Derive execution state from global store
    useEffect(() => {
        const normalize = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : '';
        const normalizedId = normalize(id);

        // Priority 1: Primary Errors (from activeErrors map)
        const error = activeErrors[normalizedId];
        if (error) {
            setExecutionState({
                type: 'error',
                message: error.message,
                line: error.line,
                originalError: error, // keep full error for AI fix
                primary: true
            });
            return;
        }

        // Priority 2: Real-time execution states
        const rtState = executionStates[normalizedId];
        if (rtState) {
            setExecutionState(rtState);
            return;
        }

        setExecutionState(null);
    }, [activeErrors, executionStates, id]);

    // Trace/Warning can stay if they come from other sources, 
    // but for now let's assume we removed socket so we can't listen to them here.
    // We should move trace/warning to store eventually.
    // For now, let's just leave the socket import removed and focus on error.


    // Visual Logic
    const isHighChurn = git?.commits > 20; // Example threshold
    const healthScore = health ?? 100;
    let healthColor = 'bg-green-500';
    if (healthScore < 70) healthColor = 'bg-red-500';
    else if (healthScore < 90) healthColor = 'bg-yellow-500';

    // Critical path visual overrides
    let borderColor = isHighChurn ? 'border-red-500' : 'border-slate-700';
    let glow = isHighChurn ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)]' : '';
    if (isEntryPoint) {
        borderColor = 'border-emerald-500';
        glow = 'shadow-[0_0_18px_rgba(16,185,129,0.35)]';
    } else if (isCentral) {
        borderColor = 'border-amber-500';
        glow = 'shadow-[0_0_18px_rgba(245,158,11,0.3)]';
    }

    // Execution State Overrides
    let executionClass = '';
    if (executionState) {
        switch (executionState.type) {
            case 'error':
                borderColor = '!border-red-500';
                glow = 'node-execution-error';
                executionClass = 'bg-gradient-to-br from-red-900/80 to-slate-900';
                break;
            case 'error-path':
                borderColor = '!border-red-400';
                glow = '!shadow-[0_0_15px_rgba(248,113,113,0.4)]';
                break;
            case 'warning':
                borderColor = '!border-amber-500';
                glow = '!shadow-[0_0_20px_rgba(245,158,11,0.5)] animate-pulse';
                break;
            case 'executing':
            case 'component':
                borderColor = '!border-emerald-500';
                glow = 'node-execution-executing';
                break;
            case 'entry':
            case 'start':
                borderColor = '!border-blue-400';
                glow = 'node-execution-entry';
                break;
        }
    }

    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-slate-800 border-2 ${borderColor} ${glow} ${executionClass} min-w-[180px] relative transition-all duration-300`}>
            {/* Execution Indicator */}
            {executionState && (
                <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-slate-900 border-2 border-current flex items-center justify-center text-xs z-20 shadow-lg">
                    {executionState.type === 'error' && '🔴'}
                    {executionState.type === 'warning' && '🟡'}
                    {executionState.type === 'executing' && '🟢'}
                </div>
            )}

            {/* Entry Point Badge */}
            {isEntryPoint && !executionState && (
                <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-md z-10">
                    <Rocket size={9} /> Entry
                </div>
            )}
            {/* Core Module Badge */}
            {isCentral && !isEntryPoint && !executionState && (
                <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-md z-10">
                    <Star size={9} /> Core
                </div>
            )}
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!bg-slate-500" />

            <div className="flex items-center">
                <div className="mr-2 relative">
                    {getIcon(label)}
                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${healthColor} shadow-sm border border-slate-900`} title={`Health: ${healthScore}%`}></div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-200 truncate">
                        {label}
                    </div>
                    {git && !executionState && (
                        <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                            <span>{git.commits} commits</span>
                            {isHighChurn && <AlertCircle size={10} className="text-red-500 inline ml-1" />}
                        </div>
                    )}
                    {/* Execution Message */}
                    {executionState && executionState.message && (
                        <div className="text-[10px] text-white mt-1 bg-black/40 p-1 rounded border-l-2 border-current">
                            <div className="truncate" title={executionState.message}>{executionState.message}</div>
                            {executionState.line && <div className="opacity-70">Line {executionState.line}</div>}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openFile(id, label);
                        }}
                        className="description-btn deep-link-btn !text-emerald-400 !bg-emerald-500/10 !border-emerald-500/30 hover:!bg-emerald-500/20 hover:!border-emerald-500"
                        title="Edit Code in Visor"
                    >
                        <Pencil size={13} />
                    </button>
                    <a
                        href={`vscode://file/${data.path || id}${executionState?.line ? `:${executionState.line}` : ''}`}
                        className="deep-link-btn"
                        title="Open in VS Code"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink size={12} />
                    </a>
                    <button
                        onClick={(e) => { e.stopPropagation(); setFocusedNode(id); }}
                        className={`deep-link-btn ${isFocused ? '!bg-blue-500/30 !border-blue-400' : ''}`}
                        title="Focus Mode"
                    >
                        <Eye size={12} />
                    </button>
                </div>
            </div>

            {/* Critical reason tag */}
            {criticalReason && !executionState && (
                <div className="text-[9px] text-slate-500 mt-1 text-center opacity-70">
                    {criticalReason}
                </div>
            )}

            {/* Error Actions — always show when executionState is error */}
            {executionState?.type === 'error' && (
                <div className="flex flex-col gap-1 mt-2">
                    {executionState.line && (
                        <button
                            className="w-full py-1 bg-red-700/80 hover:bg-red-600 text-white text-[10px] font-bold rounded transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.location.href = `vscode://file/${data.path || id}:${executionState.line}`;
                            }}
                        >
                            Jump to Error line {executionState.line} →
                        </button>
                    )}
                    <button
                        disabled={isFixing}
                        className={`w-full py-1.5 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1.5 ${isFixing
                                ? 'opacity-50 cursor-not-allowed'
                                : 'shadow-[0_0_12px_rgba(99,102,241,0.6)] hover:shadow-[0_0_18px_rgba(99,102,241,0.8)]'
                            }`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (handleAIFix) {
                                handleAIFix(
                                    data.path || id,
                                    executionState.originalError || { message: executionState.message, type: 'BrowserError' }
                                );
                            }
                        }}
                    >
                        ✨ {isFixing ? 'AI is fixing...' : 'AI Auto-Fix'}
                    </button>
                </div>
            )}

            <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!bg-slate-500" />
        </div>
    );

};

export default memo(CustomNode);

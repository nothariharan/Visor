import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

import { FileCode, FileJson, File, AlertCircle, ExternalLink, Eye } from 'lucide-react';
import useStore from '../store';



const getIcon = (filename) => {
    if (filename.endsWith('.js') || filename.endsWith('.jsx') || filename.endsWith('.ts') || filename.endsWith('.tsx')) return <FileCode size={16} className="text-blue-400" />;
    if (filename.endsWith('.json')) return <FileJson size={16} className="text-yellow-400" />;
    return <File size={16} className="text-slate-400" />;
};

const CustomNode = ({ id, data, isConnectable }) => {
    const { label, git, health, isEntryPoint, isCentral, criticalReason } = data;
    const { focusedNode, setFocusedNode } = useStore();
    const isFocused = focusedNode === id;


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

    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-slate-800 border-2 ${borderColor} ${glow} min-w-[180px] relative`}>
            {/* Entry Point Badge */}
            {isEntryPoint && (
                <div className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-md z-10">
                    🚀 Entry
                </div>
            )}
            {/* Core Module Badge */}
            {isCentral && !isEntryPoint && (
                <div className="absolute -top-2.5 -right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white shadow-md z-10">
                    ⭐ Core
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
                    {git && (
                        <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                            <span>{git.commits} commits</span>
                            {isHighChurn && <AlertCircle size={10} className="text-red-500 inline ml-1" />}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                    <a
                        href={`vscode://file/${data.path || id}`}
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
            {criticalReason && (
                <div className="text-[9px] text-slate-500 mt-1 text-center opacity-70">
                    {criticalReason}
                </div>
            )}

            <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!bg-slate-500" />
        </div>
    );

};

export default memo(CustomNode);

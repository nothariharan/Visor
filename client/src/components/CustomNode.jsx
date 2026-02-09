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
    const { label, git, health } = data;
    const { focusedNode, setFocusedNode } = useStore();
    const isFocused = focusedNode === id;


    // Visual Logic
    const isHighChurn = git?.commits > 20; // Example threshold
    const healthScore = health ?? 100;
    let healthColor = 'bg-green-500';
    if (healthScore < 70) healthColor = 'bg-red-500';
    else if (healthScore < 90) healthColor = 'bg-yellow-500';

    const borderColor = isHighChurn ? 'border-red-500' : 'border-slate-700';
    const glow = isHighChurn ? 'shadow-[0_0_15px_rgba(239,68,68,0.3)]' : '';

    return (
        <div className={`px-4 py-2 shadow-md rounded-md bg-slate-800 border-2 ${borderColor} ${glow} min-w-[180px]`}>
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-slate-500" />

            <div className="flex items-center">
                <div className="mr-2 relative">
                    {getIcon(label)}
                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${healthColor} shadow-sm border border-slate-900`} title={`Health: ${healthScore}%`}></div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-200 truncate flex justify-between items-center group">
                        <span>{label}</span>
                        <a
                            href={`vscode://file/${data.path || ''}`} // explicit path from data
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 transition-opacity"
                            title="Open in VS Code"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink size={12} />
                        </a>
                        <button
                            onClick={(e) => { e.stopPropagation(); setFocusedNode(id); }}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity ${isFocused ? 'text-blue-400 opacity-100' : 'text-slate-400 hover:text-blue-400'}`}
                            title="Focus Mode"
                        >
                            <Eye size={12} />
                        </button>
                    </div>
                    {git && (

                        <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                            <span>{git.commits} commits</span>
                            {isHighChurn && <AlertCircle size={10} className="text-red-500 inline ml-1" />}
                        </div>
                    )}
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-slate-500" />
        </div>
    );
};

export default memo(CustomNode);

import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Folder, FolderOpen, ExternalLink } from 'lucide-react';
import useStore from '../store';

const FolderNode = ({ id, data, isConnectable }) => {
    const { label } = data;
    const { toggleFolder, expandedFolders } = useStore();
    const isExpanded = expandedFolders.has(id);

    const handleClick = (e) => {
        e.stopPropagation(); // Prevent canvas click
        toggleFolder(id);
    };

    // Group/Container Style for Expanded Folders
    if (isExpanded) {
        return (
            <div
                onClick={handleClick}
                className="relative rounded-lg border-2 border-slate-600 bg-slate-800/50 transition-colors group"
                style={{ width: data.width, height: data.height }}
            >

                {/* Header / Label Area */}
                <div className="absolute top-0 left-0 right-0 px-3 py-1 bg-slate-800 border-b border-slate-600 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FolderOpen size={14} className="text-yellow-500" />
                        <span className="font-bold text-xs text-slate-300 truncate tracking-wide">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={`vscode://file/${data.path || id}`}
                            className="deep-link-btn !w-[18px] !h-[18px]"
                            title="Open folder in VS Code"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <ExternalLink size={10} />
                        </a>
                        <div className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
                            Click to collapse
                        </div>
                    </div>
                </div>

                {/* Handles for connections to the group itself */}
                <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!bg-slate-500 !w-2 !h-6 !rounded-sm" style={{ top: '15px' }} />
                <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!bg-slate-500 !w-2 !h-6 !rounded-sm" style={{ top: '15px' }} />
            </div>
        );
    }

    // Standard Collapsed Folder Node
    return (
        <div
            onClick={handleClick}
            className={`px-4 py-2 shadow-md rounded-md bg-indigo-900/40 border border-indigo-500/50 hover:border-blue-400 cursor-pointer min-w-[150px] transition-all backdrop-blur-sm`}
        >
            <Handle type="target" position={Position.Left} isConnectable={isConnectable} className="!bg-slate-500" />

            <div className="flex items-center">
                <div className="mr-2 text-yellow-500 opacity-80">
                    <Folder size={16} />
                </div>
                <div className="flex-1">
                    <div className="font-medium text-sm text-slate-200 truncate">{label}</div>
                    <div className="text-[10px] text-slate-500">
                        {data.fileCount ? `${data.fileCount} items` : 'Click to expand'}
                    </div>
                </div>
                <a
                    href={`vscode://file/${data.path || id}`}
                    className="deep-link-btn !w-[20px] !h-[20px] ml-2"
                    title="Open folder in VS Code"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ExternalLink size={11} />
                </a>
            </div>

            <Handle type="source" position={Position.Right} isConnectable={isConnectable} className="!bg-slate-500" />
        </div>
    );


};

export default memo(FolderNode);

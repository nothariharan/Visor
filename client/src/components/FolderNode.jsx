import React, { memo } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Folder, FolderOpen } from 'lucide-react';
import useStore from '../store';

const FolderNode = ({ id, data, isConnectable }) => {
    const { label } = data;
    const { toggleFolder, expandedFolders } = useStore();
    const isExpanded = expandedFolders.has(id);

    const handleClick = (e) => {
        e.stopPropagation(); // Prevent canvas click
        toggleFolder(id);
    };

    return (
        <div
            onClick={handleClick}
            className={`px-4 py-2 shadow-md rounded-md bg-slate-700 border-2 border-slate-600 hover:border-blue-400 cursor-pointer min-w-[150px] transition-colors`}
        >
            <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-slate-500" />

            <div className="flex items-center">
                <div className="mr-2 text-yellow-500">
                    {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
                </div>
                <div className="flex-1">
                    <div className="font-bold text-sm text-slate-200 truncate">{label}</div>
                    <div className="text-[10px] text-slate-400">
                        {isExpanded ? 'Click to collapse' : 'Click to expand'}
                    </div>
                </div>
            </div>

            <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-slate-500" />
        </div>
    );
};

export default memo(FolderNode);

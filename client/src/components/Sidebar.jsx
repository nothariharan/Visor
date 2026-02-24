import React, { useState } from 'react';
import { Folder, GitBranch } from 'lucide-react';
import FileTree from './FileTree';
import SourcePanel from './SourcePanel';

export default function Sidebar() {
    const [activeTab, setActiveTab] = useState('files');

    return (
        <div className="w-96 bg-crust border-r-2 border-surface1 flex flex-col pt-4">
            {/* Tab Bar */}
            <div className="h-10 border-b-2 border-surface1 flex px-4">
                <button
                    onClick={() => setActiveTab('files')}
                    className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${activeTab === 'files' ? 'text-peach border-b-2 border-peach' : 'text-subtext0 hover:text-text'}
                    `}
                >
                    <Folder size={14} /> Files
                </button>
                <button
                    onClick={() => setActiveTab('source')}
                    className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${activeTab === 'source' ? 'text-blue border-b-2 border-blue' : 'text-subtext0 hover:text-text'}
                    `}
                >
                    <GitBranch size={14} /> Source
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'files' && <FileTree />}
                {activeTab === 'source' && <SourcePanel />}
            </div>
        </div>
    );
}

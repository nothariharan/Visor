import React, { useState } from 'react';
import { Folder, GitBranch } from 'lucide-react';
import FileTree from './FileTree';
import ChroniclePanel from './ChroniclePanel';

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
                    onClick={() => setActiveTab('chronicle')}
                    className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all
                        ${activeTab === 'chronicle' ? 'text-mauve border-b-2 border-mauve' : 'text-subtext0 hover:text-text'}
                    `}
                >
                    <GitBranch size={14} /> Chronicle
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'files' && <FileTree />}
                {activeTab === 'chronicle' && <ChroniclePanel />}
            </div>
        </div>
    );
}

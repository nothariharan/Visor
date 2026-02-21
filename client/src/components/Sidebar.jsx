import React, { useState } from 'react';
import { Folder, Info } from 'lucide-react';
import FileTree from './FileTree';

export default function Sidebar() {
    const [activeTab, setActiveTab] = useState('files');

    return (
        <div className="w-96 bg-crust border-r-2 border-surface1 flex flex-col">
            {/* Tab Bar */}
            <div className="h-12 border-b-2 border-surface1 flex">
                <button
                    onClick={() => setActiveTab('files')}
                    className={`
            flex-1 text-xs font-bold uppercase flex items-center justify-center gap-2
            ${activeTab === 'files'
                            ? 'bg-surface0 text-text border-b-2 border-peach'
                            : 'bg-mantle text-subtext0 hover:bg-surface0'
                        }
          `}
                >
                    <Folder size={14} /> Files
                </button>
                <button
                    onClick={() => setActiveTab('info')}
                    className={`
            flex-1 text-xs font-bold uppercase flex items-center justify-center gap-2
            ${activeTab === 'info'
                            ? 'bg-surface0 text-text border-b-2 border-peach'
                            : 'bg-mantle text-subtext0 hover:bg-surface0'
                        }
          `}
                >
                    <Info size={14} /> Info
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden text-sm flex flex-col">
                {activeTab === 'files' && (
                    <FileTree />
                )}

                {activeTab === 'info' && (
                    <div className="space-y-4 text-xs p-2">
                        <InfoBlock title="Project" items={[
                            ['Name', 'Visor Project'],
                            ['Type', 'React + Express'],
                            ['Status', 'Active']
                        ]} />

                        <InfoBlock title="System" items={[
                            ['Node', 'v18.x'],
                            ['OS', 'Windows'],
                            ['Memory', 'Run "stats"']
                        ]} />
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoBlock({ title, items }) {
    return (
        <div className="border border-surface1 rounded p-3 bg-mantle">
            <div className="text-peach font-bold mb-2 text-xs uppercase">
                {title}
            </div>
            <div className="space-y-1">
                {items.map(([key, value]) => (
                    <div key={key} className="flex justify-between text-subtext0">
                        <span>[{key.toLowerCase()}]:</span>
                        <span className="text-text">{value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

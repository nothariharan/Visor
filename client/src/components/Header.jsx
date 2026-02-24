import React from 'react';
import { Network, Share2, Zap, ArrowRight, Save, RotateCcw } from 'lucide-react';
import useStore from '../store';

export default function Header({ currentMode, onModeChange }) {
    const { selectedPath, saveLayout, lastSaveTime, isSavingLayout, resetLayout } = useStore();

    const modes = [
        { id: 'topography', label: 'Topography', icon: <Network size={14} />, desc: 'Raw file tree' },
        { id: 'skeleton', label: 'Skeleton', icon: <Share2 size={14} />, desc: 'Critical path' },
        { id: 'forge', label: 'Forge', icon: <Zap size={14} />, desc: 'Live execution' },
    ];

    const handleResetLayout = async () => {
        if (confirm('Are you sure you want to reset the layout? This will clear all saved positions and restore the default layout.')) {
            await resetLayout();
        }
    };

    return (
        <header className="h-14 bg-crust border-b-2 border-surface1 flex items-center justify-between px-6">
            {/* Left: Project Path */}
            <div className="flex items-center gap-3 text-sm">
                <ArrowRight size={16} className="text-green" />
                <span className="text-blue">~/visor</span>
                <span className="text-subtext0">/</span>
                <span className="text-text">Visor{selectedPath && selectedPath !== 'Visor' ? ` / ${selectedPath}` : ''}</span>
            </div>

            {/* Center: Mode Switcher */}
            <div className="flex gap-2">
                {modes.map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => onModeChange(mode.id)}
                        className={`
              px-4 py-1.5 text-xs font-bold uppercase tracking-wider
              border transition-all flex items-center gap-2
              ${currentMode === mode.id
                                ? 'bg-peach text-crust border-peach shadow-hard-peach'
                                : 'bg-surface0 text-subtext0 border-surface1 hover:border-text'
                            }
            `}
                        title={mode.desc}
                    >
                        {mode.icon}
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Right: Layout Controls & System Status */}
            <div className="flex items-center gap-4 text-xs">
                {/* Layout Controls */}
                <div className="flex items-center gap-2 border-r border-surface1 pr-4">
                    <button
                        onClick={() => { if (!isSavingLayout) saveLayout(); }}
                        disabled={isSavingLayout}
                        className="flex items-center gap-1 text-subtext0 hover:text-text disabled:opacity-50"
                        title="Save Layout"
                    >
                        <Save size={14} />
                        {isSavingLayout ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={handleResetLayout}
                        className="flex items-center gap-1 text-subtext0 hover:text-red"
                        title="Reset Layout"
                    >
                        <RotateCcw size={14} />
                    </button>
                    {lastSaveTime && (
                        <span className="text-[10px] text-subtext0 opacity-70">
                            Saved {new Date(lastSaveTime).toLocaleTimeString()}
                        </span>
                    )}
                </div>

                {/* System Status */}
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green animate-pulse-slow" />
                    <span className="text-subtext0">System Nominal</span>
                </div>
            </div>
        </header>
    );
}

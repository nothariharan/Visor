import React from 'react';
import { Network, Share2, Zap, ArrowRight, Save, RotateCcw, Clock } from 'lucide-react';
import useStore from '../store';

export default function Header({ currentMode, onModeChange }) {
    const { selectedPath, saveLayout, lastSaveTime, isSavingLayout, resetLayout, projectRoot } = useStore();

    // Fix: extract project name from projectRoot
    const projectName = projectRoot ? projectRoot.replace(/\\/g, '/').split('/').pop() : '...';

    const modes = [
        { id: 'topography', label: 'Topography', icon: <Network size={14} />, desc: 'Raw file tree' },
        { id: 'skeleton', label: 'Skeleton', icon: <Share2 size={14} />, desc: 'Critical path' },
        { id: 'forge', label: 'Forge', icon: <Zap size={14} />, desc: 'Live execution' },
        { id: 'chronicle', label: 'Chronicle', icon: <Clock size={14} />, desc: 'Spatial time travel' },
    ];

    const handleResetLayout = async () => {
        if (confirm('Are you sure you want to reset the layout? This will clear all saved positions and restore the default layout.')) {
            await resetLayout();
        }
    };

    const formatPath = (path) => {
        if (!path) return '';

        // Strip 'Visor' completely if it's the root
        let normalized = path.replace(/\\/g, '/');
        if (normalized.toLowerCase() === 'visor') return '';

        // Remove leading Visor/ if present
        const rootMatch = normalized.match(/(?:^|\/)visor\/(.+)$/i);
        if (rootMatch) {
            normalized = rootMatch[1];
        }

        const parts = normalized.split('/').filter(Boolean);
        if (parts.length > 2) {
            return `... / ${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
        } else if (parts.length > 0) {
            return parts.join(' / ');
        }
        return '';
    };

    const formatted = formatPath(selectedPath);

    return (
        <header className="h-14 bg-crust border-b-2 border-surface1 relative flex items-center px-6">
            {/* Left Section: Project & Path */}
            <div className="flex-1 flex items-center gap-3 text-sm min-w-0">
                <ArrowRight size={16} className="text-green shrink-0" />
                <div className="flex items-center gap-1 overflow-hidden">
                    <span className="text-blue font-bold shrink-0">~/visor</span>
                    <span className="text-subtext0 shrink-0">/</span>
                    <span className="text-blue font-bold shrink-0">{projectName}</span>
                    {formatted && (
                        <>
                            <span className="text-subtext0 shrink-0">/</span>
                            <span className="text-text truncate" title={selectedPath}>
                                {formatted}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Center Section: Mode Switcher (Pinned to Center) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
                {modes.map(mode => (
                    <button
                        key={mode.id}
                        onClick={() => onModeChange(mode.id)}
                        className={`
                            px-4 py-1.5 text-xs font-bold uppercase tracking-wider
                            border transition-all flex items-center gap-2
                            ${currentMode === mode.id
                                ? mode.id === 'chronicle'
                                    ? 'bg-mauve text-crust border-mauve shadow-[2px_2px_0px_#1e1e2e]'
                                    : 'bg-peach text-crust border-peach shadow-hard-peach'
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

            {/* Right Section: Controls & Status */}
            <div className="flex-1 flex items-center justify-end gap-4 text-xs">
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
                            {new Date(lastSaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>

                {/* System Status */}
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green" />
                    <span className="text-subtext0 uppercase tracking-tighter font-bold opacity-60">Nominal</span>
                </div>
            </div>
        </header>
    );
}

import React from 'react';
import { Box, X } from 'lucide-react';

const legendItems = [
    { label: 'DIR', color: '#89b4fa', desc: 'Directory' },
    { label: 'LOGIC', color: '#f9e2af', desc: 'JS / TS' },
    { label: 'UI', color: '#89dceb', desc: 'JSX / TSX' },
    { label: 'STYLE', color: '#f5c2e7', desc: 'CSS / SCSS' },
    { label: 'DOCS', color: '#cba6f7', desc: 'Markdown' },
    { label: 'CFG', color: '#fab387', desc: 'Config / JSON' },
    { label: 'EXEC', color: '#a6e3a1', desc: 'Scripts' },
    { label: 'FILE', color: '#a6adc8', desc: 'Other' },
];

export default function LegendPanel({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="absolute bottom-12 left-4 bg-crust border border-surface1 shadow-hard font-mono text-xs z-50 w-64">
            {/* Panel Header */}
            <div className="px-3 py-2 bg-mantle border-b border-surface1 text-text flex justify-between items-center">
                <span className="font-bold">┌─ [ FILE TYPE INDEX ]</span>
                <button onClick={onClose} className="hover:text-red">
                    <X size={14} />
                </button>
            </div>

            {/* Panel Body */}
            <div className="p-3 flex flex-col gap-2 bg-base">
                {legendItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between group hover:bg-surface0 p-1 rounded">
                        <div className="flex items-center gap-3">
                            {/* Color Swatch */}
                            <div
                                className="w-3 h-3 border border-text/20"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="font-bold" style={{ color: item.color }}>{item.label}</span>
                        </div>
                        <span className="text-subtext0 text-[10px]">{item.desc}</span>
                    </div>
                ))}
            </div>

            {/* Panel Footer */}
            <div className="px-3 py-1 bg-mantle border-t border-surface1 text-subtext0">
                <span>└─────────────────────</span>
            </div>
        </div>
    );
}

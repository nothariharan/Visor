import React from 'react';
import { PackageOpen } from 'lucide-react';

const EmptyState = () => {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 z-10 pointer-events-none">
            <div className="text-center">
                <PackageOpen size={64} className="mx-auto mb-4 text-slate-600" />
                <h2 className="text-xl font-bold text-slate-200 mb-2">No files analyzed yet</h2>
                <p className="max-w-md mx-auto">
                    The graph seems empty. This might be because the project analysis is still running,
                    or the configured filters excluded all files.
                </p>
                <p className="mt-4 text-sm text-slate-500">
                    Try expanding folders or checking <code>visor.config.js</code>.
                </p>
            </div>
        </div>
    );
};

export default EmptyState;

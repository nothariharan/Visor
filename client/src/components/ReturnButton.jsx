import React from 'react';
import useStore from '../store';

/**
 * Floating "Return to Present" button shown only when in detached HEAD (time travel) mode.
 */
export default function ReturnButton() {
    const { isDetached, timeTravelLoading, returnToPresent, currentCommit } = useStore();

    if (!isDetached) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            {/* Commit badge */}
            {currentCommit && (
                <div className="bg-mantle border border-peach text-peach font-mono text-[10px] px-3 py-1 shadow-hard animate-pulse">
                    ⚠ VIEWING {currentCommit.substring(0, 7)}
                </div>
            )}
            {/* Return button */}
            <button
                onClick={returnToPresent}
                disabled={timeTravelLoading}
                className="
                    px-5 py-2.5 bg-red text-crust font-mono font-bold uppercase text-xs tracking-wider
                    border-2 border-red shadow-hard
                    hover:translate-y-[2px] hover:shadow-none
                    active:translate-y-1
                    transition-all disabled:opacity-50 disabled:pointer-events-none
                "
            >
                {timeTravelLoading ? '⏳ Returning...' : '✕ Return to Present'}
            </button>
        </div>
    );
}

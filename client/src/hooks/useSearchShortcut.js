import { useEffect } from 'react';

export function useSearchShortcut(onOpenSearch) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Check for Cmd+P (Mac) or Ctrl+P (Windows/Linux)
            const isCmdP = (e.metaKey || e.ctrlKey) && e.key === 'p';

            if (isCmdP) {
                e.preventDefault();
                e.stopPropagation();
                onOpenSearch();
            }
        };

        // Add listener to window
        window.addEventListener('keydown', handleKeyDown, true);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [onOpenSearch]);
}


import { useEffect, useRef } from 'react';
import useStore from '../store';

// This hook listens to changes in nodes and viewport and triggers a debounced save.
const useAutoSave = () => {
    const { nodes, viewport, loading } = useStore(state => ({
        nodes: state.nodes,
        viewport: state.viewport,
        loading: state.loading
    }));

    const saveTimeout = useRef(null);

    // We watch for node changes (position, size, etc.) and viewport changes (pan, zoom).
    // The JSON.stringify is a simple way to deep-compare the parts of the state we care about.
    const watchedState = JSON.stringify({
        nodes: nodes.map(n => ({ id: n.id, pos: n.position })),
        viewport: viewport
    });

    useEffect(() => {
        // If app is still loading initial layout, don't schedule autosave
        if (loading) return;

        // Clear any existing timer
        if (saveTimeout.current) {
            clearTimeout(saveTimeout.current);
        }

        // Set a new timer; call the store getter directly to avoid stale function refs
        saveTimeout.current = setTimeout(() => {
            // use the store getter to invoke a stable saveLayout implementation
            const save = useStore.getState().saveLayout;
            if (typeof save === 'function') save();
        }, 2000); // 2-second debounce

        // Cleanup function to clear timer if component unmounts
        return () => {
            if (saveTimeout.current) {
                clearTimeout(saveTimeout.current);
            }
        };

    }, [watchedState, loading]); // Re-run effect when the watched state changes or loading completes
};

export default useAutoSave;

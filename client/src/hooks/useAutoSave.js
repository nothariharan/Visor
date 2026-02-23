import { useEffect, useRef } from 'react';
import useStore from '../store';

// This hook listens to changes in nodes and viewport and triggers a debounced save.
const useAutoSave = () => {
    const { nodes, viewport, saveLayout } = useStore(state => ({
        nodes: state.nodes,
        viewport: state.viewport,
        saveLayout: state.saveLayout,
    }));

    const saveTimeout = useRef(null);

    // We watch for node changes (position, size, etc.) and viewport changes (pan, zoom).
    // The JSON.stringify is a simple way to deep-compare the parts of the state we care about.
    const watchedState = JSON.stringify({
        nodes: nodes.map(n => ({ id: n.id, pos: n.position })),
        viewport: viewport
    });

    useEffect(() => {
        // Clear any existing timer
        if (saveTimeout.current) {
            clearTimeout(saveTimeout.current);
        }

        // Set a new timer
        saveTimeout.current = setTimeout(() => {
            saveLayout();
        }, 2000); // 2-second debounce

        // Cleanup function to clear timer if component unmounts
        return () => {
            if (saveTimeout.current) {
                clearTimeout(saveTimeout.current);
            }
        };

    }, [watchedState, saveLayout]); // Re-run effect when the watched state changes
};

export default useAutoSave;

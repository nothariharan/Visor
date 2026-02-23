import React, { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import useStore from '../store';
import AutoSaveWrapper from './AutoSaveWrapper';
import 'reactflow/dist/style.css';

export default function GraphCanvas({ mode }) {
    const { organizeGraph, loading, error } = useStore();

    // Mode switching effect
    useEffect(() => {
        if (mode === 'skeleton' || mode === 'forge') {
            organizeGraph('critical');
        } else {
            organizeGraph('all');
        }
    }, [mode, organizeGraph]);

    if (loading) {
        return <div className="h-full w-full bg-mantle flex items-center justify-center text-subtext0">Loading graph...</div>;
    }

    if (error) {
        return <div className="h-full w-full bg-mantle flex items-center justify-center text-red">{error}</div>;
    }

    return (
        <div className="h-full w-full bg-mantle">
            <ReactFlowProvider>
                <AutoSaveWrapper />
            </ReactFlowProvider>
        </div>
    );
}

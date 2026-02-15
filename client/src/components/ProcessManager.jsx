import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Ansi from 'ansi-to-react';
import { Play, Square, RefreshCw, Trash2, ExternalLink, Activity, Terminal } from 'lucide-react';
import useStore from '../store';

export default function ProcessManager() {
    const { activeRunDir } = useStore();

    // State from RunControls
    const [runtimes, setRuntimes] = useState([]);
    const [activeRuntimeId, setActiveRuntimeId] = useState(null);
    const [outputs, setOutputs] = useState({});
    const [statuses, setStatuses] = useState({});
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);

    const outputRef = useRef(null);
    const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : '/'; // Fixed port to 3000 as per App.jsx

    // 1. Fetch Runtimes
    useEffect(() => {
        setLoading(true);
        fetch('/api/runtimes/detect')
            .then(res => res.json())
            .then(data => {
                const detected = data.runtimes || [];
                setRuntimes(detected);

                // Initialize state
                const initialOutputs = {};
                const initialStatuses = {};
                detected.forEach(r => {
                    initialOutputs[r.id] = [];
                    initialStatuses[r.id] = 'stopped';
                });

                setOutputs(prev => ({ ...initialOutputs, ...prev }));
                setStatuses(prev => ({ ...initialStatuses, ...prev }));

                setLoading(false);
            })
            .catch(err => {
                console.error("Runtime detection failed:", err);
                setLoading(false);
            });
    }, [activeRunDir]);

    // 2. Sync Initial Statuses
    useEffect(() => {
        fetch('/api/process/list')
            .then(res => res.json())
            .then(list => {
                const newStatuses = {};
                list.forEach(p => {
                    newStatuses[p.id] = p.status;
                });
                setStatuses(prev => ({ ...prev, ...newStatuses }));
            });
    }, []);

    // 3. Socket Connection
    useEffect(() => {
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        const appendOutput = (id, entry) => {
            setOutputs(prev => {
                const current = prev[id] || [];
                const updated = [...current, entry];
                if (updated.length > 1000) updated.shift();
                return { ...prev, [id]: updated };
            });
        };

        newSocket.on('process:output', (data) => {
            const { id, type, data: text } = data;
            const lines = text.split('\n');
            if (lines[lines.length - 1] === '') lines.pop();
            lines.forEach(line => {
                appendOutput(id, { type, text: line, timestamp: Date.now() });
            });
        });

        newSocket.on('process:exit', (data) => {
            const { id, code } = data;
            setStatuses(prev => ({ ...prev, [id]: 'stopped' }));
            appendOutput(id, { type: 'system', text: `>>> Process exited with code ${code}`, timestamp: Date.now() });
        });

        return () => newSocket.close();
    }, [socketUrl]);

    // Scroll to bottom
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [outputs, activeRuntimeId]);

    // Actions
    const handleStart = async (id) => {
        const runtime = runtimes.find(r => r.id === id);
        if (!runtime) return;

        setStatuses(prev => ({ ...prev, [id]: 'starting' }));

        try {
            await fetch('/api/process/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: runtime.id,
                    command: runtime.command,
                    cwd: runtime.workingDir
                })
            });
        } catch (error) {
            setStatuses(prev => ({ ...prev, [id]: 'error' }));
        }
    };

    const handleStop = async (id) => {
        setStatuses(prev => ({ ...prev, [id]: 'stopping' }));
        try {
            await fetch('/api/process/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
        } catch (error) {
            console.error("Stop failed", error);
        }
    };

    const activeRuntime = runtimes.find(r => r.id === activeRuntimeId);
    const activeOutput = activeRuntimeId ? (outputs[activeRuntimeId] || []) : [];

    return (
        <div className="w-96 bg-crust border-l-2 border-surface1 flex flex-col h-full">
            {/* Header */}
            <div className="h-10 border-b-2 border-surface1 flex items-center justify-between px-4 bg-mantle">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-text">
                    <Activity size={14} /> Processes
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetch('/api/runtimes/detect')}
                        className="text-subtext0 hover:text-text"
                        title="Refresh Runtimes"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            {/* Process List */}
            <div className="flex-1 overflow-auto p-3 space-y-3">
                {runtimes.map(proc => (
                    <ProcessCard
                        key={proc.id}
                        proc={proc}
                        status={statuses[proc.id] || 'stopped'}
                        isActive={activeRuntimeId === proc.id}
                        onClick={() => setActiveRuntimeId(proc.id)}
                        onStart={() => handleStart(proc.id)}
                        onStop={() => handleStop(proc.id)}
                    />
                ))}

                {loading && <div className="text-center text-xs text-subtext0 italic">Detecting runtimes...</div>}

                {!loading && runtimes.length === 0 && (
                    <div className="text-center text-xs text-subtext0 mt-4">No runtimes detected</div>
                )}
            </div>

            {/* Terminal Output Area (Bottom Half) */}
            {activeRuntimeId && (
                <div className="h-64 border-t-2 border-surface1 bg-base flex flex-col">
                    <div className="h-8 bg-surface0 px-2 flex items-center justify-between border-b border-surface1">
                        <div className="flex items-center gap-2 text-subtext0 truncate">
                            <Terminal size={12} />
                            <span className="text-[10px] font-bold uppercase">
                                {activeRuntime?.name || 'Terminal'}
                            </span>
                        </div>
                        <button
                            onClick={() => setOutputs(prev => ({ ...prev, [activeRuntimeId]: [] }))}
                            className="text-subtext0 hover:text-red"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div
                        ref={outputRef}
                        className="flex-1 overflow-auto p-2 font-mono text-[10px] text-subtext0"
                    >
                        {activeOutput.map((line, i) => (
                            <div key={i} className={`whitespace-pre-wrap break-all ${line.type === 'error' ? 'text-red' :
                                    line.type === 'system' ? 'text-blue' : 'text-text'
                                }`}>
                                <Ansi>{line.text}</Ansi>
                            </div>
                        ))}
                        {activeOutput.length === 0 && (
                            <div className="text-surface2 italic">Ready...</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ProcessCard({ proc, status, isActive, onClick, onStart, onStop }) {
    const isRunning = status === 'running';
    const isStarting = status === 'starting';
    const isStopping = status === 'stopping';

    return (
        <div
            onClick={onClick}
            className={`
          border-2 relative cursor-pointer transition-all
          ${isActive ? 'border-blue' : isRunning ? 'border-green' : 'border-surface1'}
          bg-surface0 rounded p-3
          ${isActive ? 'shadow-hard-hover' : 'shadow-hard'}
          ${isRunning ? 'shadow-hard-green' : ''}
        `}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`
            w-2 h-2 rounded-full
            ${isRunning ? 'bg-green animate-pulse-slow' : 'bg-surface1'}
          `} />
                    <span className="text-sm font-bold truncate w-32">{proc.name}</span>
                </div>

                <div className="flex gap-1">
                    {!isRunning && !isStarting && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStart(); }}
                            className="p-1 bg-green text-crust hover:bg-green/80 rounded"
                        >
                            <Play size={10} fill="currentColor" />
                        </button>
                    )}
                    {(isRunning || isStarting) && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStop(); }}
                            disabled={isStopping}
                            className="p-1 bg-red text-crust hover:bg-red/80 rounded disabled:opacity-50"
                        >
                            <Square size={10} fill="currentColor" />
                        </button>
                    )}
                </div>
            </div>

            {/* Info */}
            <div className="text-[10px] text-subtext0 space-y-1">
                <div className="flex justify-between">
                    <span className="truncate w-full pr-2 text-surface2">{proc.command}</span>
                </div>
                {proc.port && (
                    <div className="flex justify-between">
                        <span>[port]:</span>
                        <span className="text-blue">{proc.port}</span>
                    </div>
                )}
            </div>

            {/* Open in Browser */}
            {isRunning && proc.port && (
                <button
                    onClick={(e) => { e.stopPropagation(); window.open(`http://localhost:${proc.port}`, '_blank'); }}
                    className="
          w-full mt-2 py-1 flex items-center justify-center gap-1
          bg-blue text-crust 
          text-[10px] font-bold uppercase 
          hover:bg-blue/80 transition-colors
        ">
                    <ExternalLink size={10} /> Open : {proc.port}
                </button>
            )}
        </div>
    );
}

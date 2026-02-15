import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Ansi from 'ansi-to-react';
import { Play, Square, RefreshCw, Trash2, ExternalLink, Activity, Terminal, ChevronDown, ChevronUp, Layers, Box } from 'lucide-react';
import useStore from '../store';
import '../styles/run-controls.css'; // Ensure you have basic styles or update them

export default function RunControls() {
    const { activeRunDir } = useStore();

    // State
    const [runtimes, setRuntimes] = useState([]);
    const [activeRuntimeId, setActiveRuntimeId] = useState(null);
    const [outputs, setOutputs] = useState({}); // { [id]: [{type, text, timestamp}] }
    const [statuses, setStatuses] = useState({}); // { [id]: 'stopped' | 'starting' | 'running' | 'error' }
    const [isExpanded, setIsExpanded] = useState(true);
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);

    const outputRef = useRef(null);
    const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : '/';

    // 1. Fetch Runtimes on Mount/Change
    useEffect(() => {
        setLoading(true);
        const url = activeRunDir
            ? `/api/project/detect?path=${encodeURIComponent(activeRunDir)}` // Fallback/Legacy if needed, but we prefer new endpoint
            : '/api/runtimes/detect'; // Use new endpoint

        // If activeRunDir is set, we might want to filter or detect just that dir.
        // But the new detector detects EVERYTHING. 
        // Let's use the new endpoint always for now, it returns everything.
        // If activeRunDir is set, we could maybe auto-select the runtime matching that dir.

        fetch('/api/runtimes/detect')
            .then(res => res.json())
            .then(data => {
                const detected = data.runtimes || [];
                setRuntimes(detected);

                // Initialize state for new runtimes
                const initialOutputs = {};
                const initialStatuses = {};
                detected.forEach(r => {
                    initialOutputs[r.id] = [];
                    initialStatuses[r.id] = 'stopped';
                });

                // Merge with existing to preserve history if re-fetching
                setOutputs(prev => ({ ...initialOutputs, ...prev }));
                setStatuses(prev => ({ ...initialStatuses, ...prev }));

                // Auto-select first if none selected
                if (detected.length > 0 && !activeRuntimeId) {
                    // Try to find one matching activeRunDir
                    const match = activeRunDir ? detected.find(r => r.workingDir === activeRunDir) : null;
                    setActiveRuntimeId(match ? match.id : detected[0].id);
                } else if (detected.length > 0 && !detected.find(r => r.id === activeRuntimeId)) {
                    // If active ID no longer exists, reset
                    setActiveRuntimeId(detected[0].id);
                }

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

        // Helper to update output for a specific ID
        const appendOutput = (id, entry) => {
            setOutputs(prev => {
                const current = prev[id] || [];
                // Limit to 1000 lines per runtime
                const updated = [...current, entry];
                if (updated.length > 1000) updated.shift();
                return { ...prev, [id]: updated };
            });
        };

        newSocket.on('process:output', (data) => {
            const { id, type, data: text } = data;
            // Split lines to handle chunked output better
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

        newSocket.on('process:error', (data) => {
            const { id, error } = data;
            // setStatuses(prev => ({ ...prev, [id]: 'error' })); // Optional, maybe keep 'running' if just an error log?
            appendOutput(id, { type: 'error', text: `>>> ERROR: ${error}`, timestamp: Date.now() });
        });

        return () => newSocket.close();
    }, [socketUrl]);

    // Auto-scroll
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [outputs, activeRuntimeId]);

    // Handlers
    const getActiveRuntime = () => runtimes.find(r => r.id === activeRuntimeId);

    const handleStart = async () => {
        const runtime = getActiveRuntime();
        if (!runtime) return;

        // Clear output on start? Maybe optional.
        setOutputs(prev => ({ ...prev, [runtime.id]: [] }));
        setStatuses(prev => ({ ...prev, [runtime.id]: 'starting' }));
        setIsExpanded(true);

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
            // Status update will come via socket or assumption
            setStatuses(prev => ({ ...prev, [runtime.id]: 'running' }));
        } catch (error) {
            setStatuses(prev => ({ ...prev, [runtime.id]: 'error' }));
            console.error("Start failed", error);
        }
    };

    const handleStop = async () => {
        const runtime = getActiveRuntime();
        if (!runtime) return;

        setStatuses(prev => ({ ...prev, [runtime.id]: 'stopping' }));
        try {
            await fetch('/api/process/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: runtime.id })
            });
        } catch (error) {
            console.error("Stop failed", error);
        }
    };

    const handleRestart = async () => {
        const runtime = getActiveRuntime();
        if (!runtime) return;

        setStatuses(prev => ({ ...prev, [runtime.id]: 'stopping' }));
        try {
            await fetch('/api/process/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: runtime.id })
            });
            setStatuses(prev => ({ ...prev, [runtime.id]: 'running' }));
        } catch (error) {
            console.error("Restart failed", error);
        }
    };

    const handleClear = () => {
        if (activeRuntimeId) {
            setOutputs(prev => ({ ...prev, [activeRuntimeId]: [] }));
        }
    };

    // Render Helpers
    const activeRuntime = getActiveRuntime();
    const activeStatus = activeRuntimeId ? (statuses[activeRuntimeId] || 'stopped') : 'stopped';
    const activeOutput = activeRuntimeId ? (outputs[activeRuntimeId] || []) : [];

    // Minimized View
    if (!isExpanded) {
        // Show status of ALL running apps or just a summary
        const runningCount = Object.values(statuses).filter(s => s === 'running').length;

        return (
            <div
                className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-md shadow-lg p-2 flex items-center gap-3 cursor-pointer z-50 hover:bg-slate-700 transition-colors"
                onClick={() => setIsExpanded(true)}
            >
                <div className="flex items-center gap-2">
                    {runningCount > 0 ? (
                        <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                    ) : (
                        <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                    )}
                    <span className="text-sm font-bold text-slate-200">
                        {runningCount > 0 ? `${runningCount} Apps Running` : 'Run Project'}
                    </span>
                </div>
                <ChevronUp size={16} className="text-slate-400" />
            </div>
        );
    }

    if (loading && runtimes.length === 0) {
        return (
            <div className="fixed bottom-4 right-4 bg-slate-800 text-slate-400 p-4 rounded shadow-lg border border-slate-700">
                Loading runtimes...
            </div>
        );
    }

    return (
        <div className="run-controls flex flex-col h-[300px] w-[600px] fixed bottom-4 right-4 bg-[#1e1e1e] border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
            {/* Header / Tabs */}
            <div className="bg-[#252526] border-b border-black flex items-center justify-between px-2 h-10">

                {/* Runtime Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 mr-2">
                    {runtimes.length > 0 ? runtimes.map(r => (
                        <button
                            key={r.id}
                            onClick={() => setActiveRuntimeId(r.id)}
                            className={`
                                flex items-center gap-2 px-3 py-1 text-xs rounded-t-sm border-t-2 transition-colors whitespace-nowrap
                                ${activeRuntimeId === r.id
                                    ? 'bg-[#1e1e1e] text-white border-blue-500'
                                    : 'bg-[#2d2d2d] text-slate-400 border-transparent hover:bg-[#333]'}
                            `}
                        >
                            <span>{r.icon || '📦'}</span>
                            <span className="font-medium">{r.name}</span>
                            {statuses[r.id] === 'running' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            )}
                        </button>
                    )) : (
                        <div className="text-xs text-slate-500 px-2 flex items-center gap-1">
                            <Box size={12} /> No runtimes detected
                        </div>
                    )}
                </div>

                {/* Window Controls */}
                <div className="flex items-center gap-1">
                    <button onClick={() => setIsExpanded(false)} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white">
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>

            {/* Toolbar (Context Sensitive) */}
            <div className="bg-[#1e1e1e] border-b border-slate-800 p-2 flex items-center gap-2 h-10">
                {activeRuntime ? (
                    <>
                        <div className="flex items-center gap-2 mr-auto">
                            <span className="text-xs text-slate-400 font-mono bg-black/20 px-2 py-0.5 rounded">
                                {activeRuntime.command}
                            </span>
                            {activeStatus === 'running' && activeRuntime.port && (
                                <a
                                    href={`http://localhost:${activeRuntime.port}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline"
                                >
                                    <ExternalLink size={10} /> localhost:{activeRuntime.port}
                                </a>
                            )}
                        </div>

                        {/* Controls */}
                        {activeStatus === 'running' || activeStatus === 'stopping' ? (
                            <>
                                <button onClick={handleRestart} disabled={activeStatus === 'stopping'} className="p-1.5 bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600/30 rounded" title="Restart">
                                    <RefreshCw size={14} />
                                </button>
                                <button onClick={handleStop} disabled={activeStatus === 'stopping'} className="flex items-center gap-1 px-3 py-1 bg-red-600/20 text-red-500 hover:bg-red-600/30 rounded text-xs font-bold uppercase transition-colors">
                                    <Square size={12} fill="currentColor" /> Stop
                                </button>
                            </>
                        ) : (
                            <button onClick={handleStart} disabled={activeStatus === 'starting'} className="flex items-center gap-1 px-3 py-1 bg-emerald-600/20 text-emerald-500 hover:bg-emerald-600/30 rounded text-xs font-bold uppercase transition-colors">
                                <Play size={12} fill="currentColor" /> Run
                            </button>
                        )}

                        <div className="w-px h-4 bg-slate-700 mx-1"></div>

                        <button onClick={handleClear} className="p-1.5 text-slate-500 hover:text-slate-300 rounded" title="Clear Output">
                            <Trash2 size={14} />
                        </button>
                    </>
                ) : (
                    <div className="text-xs text-slate-500">Select a runtime to control</div>
                )}
            </div>

            {/* Terminal Area */}
            <div className="flex-1 bg-black p-2 overflow-y-auto font-mono text-xs" ref={outputRef}>
                {activeOutput.length > 0 ? (
                    activeOutput.map((line, i) => (
                        <div key={i} className={`whitespace-pre-wrap break-all leading-tight ${line.type === 'error' ? 'text-red-400' :
                                line.type === 'system' ? 'text-blue-400 italic' :
                                    'text-slate-300'
                            }`}>
                            <Ansi>{line.text}</Ansi>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-50">
                        <Terminal size={32} className="mb-2" />
                        <span>Ready to run</span>
                    </div>
                )}
            </div>
        </div>
    );
}


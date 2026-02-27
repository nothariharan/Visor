import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Play, Square, RefreshCw, Trash2, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import useStore from '../store';

export default function ExecutablesPanel() {
    const [executables, setExecutables] = useState([]);
    const [activeExecutableId, setActiveExecutableId] = useState(null);
    const [outputs, setOutputs] = useState({});
    const [statuses, setStatuses] = useState({});
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);
    const outputRef = useRef(null);
    const socketUrl = import.meta.env.DEV ? 'http://localhost:6767' : '/';

    // Fetch executables
    useEffect(() => {
        setLoading(true);
        fetch('/api/executables/find')
            .then(res => res.json())
            .then(data => {
                const execs = data.executables || [];
                setExecutables(execs);

                // Initialize state
                const initialOutputs = {};
                const initialStatuses = {};
                execs.forEach(e => {
                    initialOutputs[e.path] = [];
                    initialStatuses[e.path] = 'stopped';
                });

                setOutputs(initialOutputs);
                setStatuses(initialStatuses);
                setLoading(false);
            })
            .catch(err => {
                console.error("Executable detection failed:", err);
                setLoading(false);
            });
    }, []);

    // Socket connection
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
    }, [outputs, activeExecutableId]);

    // Run executable
    const handleRun = async (execPath) => {
        setStatuses(prev => ({ ...prev, [execPath]: 'starting' }));

        try {
            const response = await fetch('/api/executables/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: execPath,
                    cwd: null
                })
            });

            if (!response.ok) {
                setStatuses(prev => ({ ...prev, [execPath]: 'error' }));
                const error = await response.json();
                setOutputs(prev => ({
                    ...prev,
                    [execPath]: [
                        ...(prev[execPath] || []),
                        { type: 'error', text: `Error: ${error.error}`, timestamp: Date.now() }
                    ]
                }));
            }
        } catch (error) {
            setStatuses(prev => ({ ...prev, [execPath]: 'error' }));
            setOutputs(prev => ({
                ...prev,
                [execPath]: [
                    ...(prev[execPath] || []),
                    { type: 'error', text: `Error: ${error.message}`, timestamp: Date.now() }
                ]
            }));
        }

        // Set as active
        setActiveExecutableId(execPath);
    };

    // Stop executable
    const handleStop = async (execPath) => {
        setStatuses(prev => ({ ...prev, [execPath]: 'stopping' }));
        try {
            // Look for the execution ID for this path
            // For simplicity, we'll need to track it differently
            // For now, just reset
            setStatuses(prev => ({ ...prev, [execPath]: 'stopped' }));
        } catch (error) {
            console.error("Stop failed", error);
        }
    };

    const activeOutput = activeExecutableId ? (outputs[activeExecutableId] || []) : [];
    const typeColors = {
        stdout: 'text-green',
        stderr: 'text-red',
        system: 'text-yellow',
        error: 'text-red'
    };

    return (
        <div className="w-96 bg-crust border-l-2 border-surface1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="h-10 border-b-2 border-surface1 flex items-center justify-between px-4 bg-mantle">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-text">
                    <Terminal size={14} /> Executables
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-subtext0 hover:text-text"
                        title={isExpanded ? "Collapse" : "Expand"}
                    >
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <button
                        onClick={() => location.reload()}
                        className="text-subtext0 hover:text-text"
                        title="Refresh Executables"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            {/* Executables List */}
            {isExpanded && (
                <div className="flex-1 overflow-auto p-3 space-y-2 border-b-2 border-surface1">
                    {executables.map(exec => (
                        <ExecutableCard
                            key={exec.path}
                            exec={exec}
                            status={statuses[exec.path] || 'stopped'}
                            isActive={activeExecutableId === exec.path}
                            onClick={() => setActiveExecutableId(exec.path)}
                            onRun={() => handleRun(exec.path)}
                            onStop={() => handleStop(exec.path)}
                        />
                    ))}

                    {loading && (
                        <div className="text-center text-xs text-subtext0 italic py-4">
                            Scanning for executables...
                        </div>
                    )}

                    {!loading && executables.length === 0 && (
                        <div className="text-center text-xs text-subtext0 mt-4">
                            No executable files found
                        </div>
                    )}
                </div>
            )}

            {/* Terminal Output Area (Bottom) */}
            {activeExecutableId && (
                <div className="h-64 bg-base flex flex-col border-t-2 border-surface1">
                    <div className="h-8 bg-surface0 px-2 flex items-center justify-between border-b border-surface1">
                        <div className="flex items-center gap-2 text-subtext0 truncate">
                            <Terminal size={12} />
                            <span className="text-[10px] font-bold uppercase">
                                {executables.find(e => e.path === activeExecutableId)?.name || 'Terminal'}
                            </span>
                        </div>
                        <button
                            onClick={() => setOutputs(prev => ({ ...prev, [activeExecutableId]: [] }))}
                            className="text-subtext0 hover:text-red"
                            title="Clear output"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div
                        ref={outputRef}
                        className="flex-1 overflow-auto p-2 font-mono text-[10px] text-subtext0 bg-base"
                    >
                        {activeOutput.length === 0 ? (
                            <div className="text-subtext1 italic">Run an executable to see output...</div>
                        ) : (
                            activeOutput.map((line, i) => (
                                <div key={i} className={`whitespace-pre-wrap break-all ${typeColors[line.type] || 'text-subtext0'}`}>
                                    {line.text}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ExecutableCard({ exec, status, isActive, onClick, onRun, onStop }) {
    const getTypeIcon = (type) => {
        const icons = {
            shell: '🔧',
            python: '🐍',
            node: '📦',
            ruby: '💎',
            go: '🐹',
            perl: '🦪',
            php: '🐘',
            java: '☕',
            windows: '🪟'
        };
        return icons[type] || '⚙️';
    };

    const statusColors = {
        stopped: 'text-subtext0 bg-surface0',
        starting: 'text-yellow bg-surface0 animate-pulse',
        running: 'text-green bg-surface0',
        stopping: 'text-yellow bg-surface0',
        error: 'text-red bg-surface0'
    };

    return (
        <div
            onClick={onClick}
            className={`p-2 rounded-sm cursor-pointer transition-all border border-surface1
                ${isActive ? 'bg-blue/20 border-blue' : 'hover:bg-surface0'}
            `}
        >
            <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getTypeIcon(exec.type)}</span>
                    <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-text truncate">
                            {exec.name}
                        </div>
                        <div className="text-[10px] text-subtext1 truncate">
                            {exec.path}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status and Controls */}
            <div className="flex items-center justify-between">
                <div className={`text-[10px] font-bold uppercase px-2 py-1 rounded-sm ${statusColors[status]}`}>
                    {status}
                </div>
                <div className="flex gap-1">
                    {status === 'stopped' ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRun();
                            }}
                            className="p-1 hover:bg-green/20 rounded transition-colors"
                            title="Run"
                        >
                            <Play size={12} className="text-green" />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onStop();
                            }}
                            className="p-1 hover:bg-red/20 rounded transition-colors"
                            title="Stop"
                        >
                            <Square size={12} className="text-red" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}


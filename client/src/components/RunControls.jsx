import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Ansi from 'ansi-to-react';
import { Play, Square, RefreshCw, Trash2, ExternalLink, Activity, Terminal } from 'lucide-react';
import useStore from '../store';
import '../styles/run-controls.css';

export default function RunControls() {
    const { activeRunDir } = useStore(); // Get selected directory
    const [projectInfo, setProjectInfo] = useState(null);
    const [processStatus, setProcessStatus] = useState('stopped'); // stopped, starting, running, stopping, error
    const [output, setOutput] = useState([]);
    const [selectedCommand, setSelectedCommand] = useState(null);
    const [socket, setSocket] = useState(null);
    const [isExpanded, setIsExpanded] = useState(true);

    const outputRef = useRef(null);
    const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : '/';

    // Detect project on mount OR when activeRunDir changes
    useEffect(() => {
        // Reset while loading new dir info, unless it's just initial load
        if (activeRunDir) setProjectInfo(null);

        const url = activeRunDir
            ? `/api/project/detect?path=${encodeURIComponent(activeRunDir)}`
            : '/api/project/detect';

        fetch(url)
            .then(res => res.json())
            .then(info => {
                setProjectInfo(info);
                // Auto-select primary command
                const primary = info.commands?.find(c => c.primary);
                if (primary) setSelectedCommand(primary);
            })
            .catch(err => console.error("Project detection failed:", err));
    }, [activeRunDir]);

    // Check status on mount in case already running (e.g. refresh)
    useEffect(() => {
        fetch('/api/process/status')
            .then(res => res.json())
            .then(status => {
                if (status.status === 'running') {
                    setProcessStatus('running');
                    // We missed past logs, but socket will send new ones. 
                    // Could implement log replay in backend if needed.
                }
            });
    }, []);

    // Setup WebSocket for real-time output
    useEffect(() => {
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        newSocket.on('process:output', (data) => {
            setOutput(prev => {
                const lines = data.data.split('\n');
                // Remove trailing empty line from split
                if (lines[lines.length - 1] === '') lines.pop();

                const newEntries = lines.map(line => ({
                    type: data.type,
                    text: line,
                    timestamp: Date.now()
                }));
                return [...prev, ...newEntries].slice(-1000); // Keep last 1000 lines
            });
        });

        newSocket.on('process:exit', (data) => {
            setProcessStatus('stopped');
            setOutput(prev => [...prev, {
                type: 'system',
                text: `>>> Process exited with code ${data.code}`,
                timestamp: Date.now()
            }]);
        });

        newSocket.on('process:error', (data) => {
            // Only update status if it was running/starting
            // setProcessStatus('error'); 
            setOutput(prev => [...prev, {
                type: 'error',
                text: `>>> ERROR: ${data.error}`,
                timestamp: Date.now()
            }]);
        });

        return () => newSocket.close();
    }, [socketUrl]);

    // Auto-scroll
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    const handleStart = async () => {
        if (!selectedCommand) return;

        setOutput([]); // Clear previous run
        setProcessStatus('starting');
        setIsExpanded(true);

        try {
            const res = await fetch('/api/process/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 'default',
                    command: selectedCommand.command,
                    cwd: activeRunDir // Run in selected directory
                })
            });
            const data = await res.json();

            if (data.status === 'running') {
                setProcessStatus('running');
            } else {
                setProcessStatus('error'); // Should happen via socket error event usually
            }

        } catch (error) {
            setProcessStatus('error');
            setOutput(prev => [...prev, {
                type: 'error',
                text: `Failed to start: ${error.message}`,
                timestamp: Date.now()
            }]);
        }
    };

    const handleStop = async () => {
        setProcessStatus('stopping');

        try {
            await fetch('/api/process/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: 'default' })
            });
            // Status update will come via socket exit event
        } catch (error) {
            console.error('Stop failed:', error);
        }
    };

    const handleRestart = async () => {
        // Optimistic UI updates handled by events
        setProcessStatus('stopping');

        try {
            await fetch('/api/process/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: 'default' })
            });
            setProcessStatus('running'); // Assume success, socket will correcting if fails
        } catch (e) {
            console.error(e);
        }
    };

    const handleClear = () => {
        setOutput([]);
    };

    if (!projectInfo) {
        return (
            <div className="fixed bottom-4 right-4 bg-slate-800 text-slate-400 text-xs px-3 py-2 rounded shadow-lg border border-slate-700 animate-pulse">
                Detecting Project...
            </div>
        );
    }

    // Minimized State
    if (!isExpanded) {
        return (
            <div
                className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-md shadow-lg p-2 flex items-center gap-3 cursor-pointer z-50 hover:bg-slate-700 transition-colors"
                onClick={() => setIsExpanded(true)}
            >
                <div className={`w-3 h-3 rounded-full ${processStatus === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
                <span className="text-sm font-bold text-slate-200">Run Project</span>
                <Terminal size={16} className="text-slate-400" />
            </div>
        );
    }

    if (projectInfo.type === 'unknown') {
        return (
            <div className="run-controls unknown">
                <div className="flex justify-between w-full mb-2">
                    <span className="font-bold text-amber-500">Manual Mode</span>
                    <button onClick={() => setIsExpanded(false)} className="text-slate-500 hover:text-white"><Square size={14} /></button>
                </div>
                <p className="text-xs text-slate-400">Could not auto-detect project type.</p>
                <p className="text-xs text-slate-500 mt-1">Add package.json, requirements.txt, or docker-compose.yml.</p>
            </div>
        );
    }

    return (
        <div className="run-controls">
            {/* Header */}
            <div className="run-header">
                <div className="project-info">
                    <button onClick={() => setIsExpanded(false)} className="mr-2 text-slate-400 hover:text-white" title="Minimize">
                        <Terminal size={14} />
                    </button>
                    <span className="project-type uppercase">{projectInfo.framework}</span>
                    {projectInfo.defaultPort && (
                        <span className="text-slate-500 text-xs ml-2">:{projectInfo.defaultPort}</span>
                    )}
                </div>

                <div className="command-selector">
                    <select
                        className="bg-slate-800 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1 outline-none focus:border-blue-500"
                        value={selectedCommand?.command || ''}
                        onChange={(e) => {
                            const cmd = projectInfo.commands.find(c => c.command === e.target.value);
                            setSelectedCommand(cmd);
                        }}
                    >
                        {projectInfo.commands.map(cmd => (
                            <option key={cmd.command} value={cmd.command}>
                                {cmd.name} ({cmd.command})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Control Buttons */}
            <div className="run-controls-buttons">
                {processStatus !== 'running' && processStatus !== 'stopping' ? (
                    <button
                        className="btn-start"
                        onClick={handleStart}
                        disabled={!selectedCommand || processStatus === 'starting'}
                    >
                        <Play size={14} fill="currentColor" /> Run
                    </button>
                ) : (
                    <>
                        <button
                            className="btn-stop"
                            onClick={handleStop}
                            disabled={processStatus === 'stopping'}
                        >
                            <Square size={14} fill="currentColor" /> Stop
                        </button>
                        <button
                            className="btn-restart"
                            onClick={handleRestart}
                            disabled={processStatus !== 'running'}
                        >
                            <RefreshCw size={14} /> Restart
                        </button>
                    </>
                )}

                <button
                    className="btn-clear"
                    onClick={handleClear}
                    title="Clear Console"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Terminal Output */}
            <div className="terminal-output" ref={outputRef}>
                {output.length === 0 ? (
                    <div className="terminal-placeholder">
                        <Terminal size={48} className="mx-auto text-slate-700 mb-2" />
                        <p>Output will appear here...</p>
                    </div>
                ) : (
                    output.map((line, i) => (
                        <div key={i} className={`terminal-line ${line.type}`}>
                            <Ansi>{line.text}</Ansi>
                        </div>
                    ))
                )}
            </div>

            {/* Quick Actions */}
            {processStatus === 'running' && projectInfo.defaultPort && (
                <div className="quick-actions">
                    <span className="mr-auto text-xs text-emerald-500 flex items-center gap-1">
                        <Activity size={12} /> App Running
                    </span>
                    <a
                        href={`http://localhost:${projectInfo.defaultPort}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="open-browser-btn"
                    >
                        Open Browser <ExternalLink size={12} />
                    </a>
                </div>
            )}
        </div>
    );
}

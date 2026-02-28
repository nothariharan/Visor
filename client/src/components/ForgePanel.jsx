import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Terminal, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import io from 'socket.io-client';
import useStore from '../store';
import Ansi from 'ansi-to-react';
import ForgeCard from './ForgeCard';

export default function ForgePanel() {
    const {
        forgeOutputs,
        forgeStatuses,
        appendForgeOutput,
        setForgeStatus,
        initializeForgeState
    } = useStore();

    const [folders, setFolders] = useState([]);
    const [activeExecutableId, setActiveExecutableId] = useState(null);
    const [socket, setSocket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);
    const [urls, setUrls] = useState({}); // processId -> url

    const outputRef = useRef(null);
    const socketUrl = import.meta.env.DEV ? 'http://localhost:6767' : '/';

    const fetchFolders = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/forge/executable-folders');
            if (!response.ok) throw new Error('Failed to fetch folders');

            const data = await response.json();
            const execs = data.folders || [];

            // Sort to put root directory first if possible, otherwise by name
            execs.sort((a, b) => {
                if (a.path === a.name) return -1;
                if (b.path === b.name) return 1;
                return a.name.localeCompare(b.name);
            });

            setFolders(execs);

            // Initialize state for outputs and statuses if not already present
            initializeForgeState(execs);
        } catch (err) {
            console.error("Failed to fetch executable folders:", err);
            setFolders([]);
        } finally {
            setLoading(false);
        }
    };

    // Socket connection
    useEffect(() => {
        const newSocket = io(socketUrl);
        setSocket(newSocket);

        const appendOutput = (id, entry) => {
            appendForgeOutput(id, entry);
        };

        newSocket.on('process:output', (data) => {
            const { id, type, data: text } = data;
            if (!text) return;
            // Split into lines for easier rendering
            const lines = text.split('\n');
            if (lines[lines.length - 1] === '') lines.pop(); // Remove trailing empty split
            lines.forEach(line => {
                appendOutput(id, { type, text: line, timestamp: Date.now() });
            });
        });

        newSocket.on('process:error', (data) => {
            appendOutput(data.id, { type: 'error', text: `Error: ${data.error}`, timestamp: Date.now() });
        });

        newSocket.on('process:exit', (data) => {
            const { id, code } = data;
            setForgeStatus(id, 'stopped');
            appendOutput(id, { type: 'system', text: `>>> Process exited with code ${code}`, timestamp: Date.now() });
        });

        newSocket.on('process:url', (data) => {
            const { id, url } = data;
            console.log('[ForgePanel] Received URL for', id, '->', url);
            setUrls(prev => ({ ...prev, [id]: url }));
            setForgeStatus(id, 'running');
            appendOutput(id, { type: 'system', text: `>>> Server ready at ${url}`, timestamp: Date.now() });
        });

        return () => newSocket.close();
    }, [socketUrl]);

    useEffect(() => {
        fetchFolders();
    }, []);

    // AI Auto-Restart Listener
    useEffect(() => {
        if (!socket) return;

        const onAIFix = (data) => {
            const { filePath, message } = data;
            const normalize = p => p ? p.replace(/\\/g, '/').toLowerCase() : '';
            const normFile = normalize(filePath);

            // Find matching folder
            const matchingFolder = folders.find(f => normFile.includes(normalize(f.path)));
            if (matchingFolder) {
                appendForgeOutput(matchingFolder.path, { type: 'system', text: `✨ AI Auto-Fix Applied: ${message}`, timestamp: Date.now() });
                appendForgeOutput(matchingFolder.path, { type: 'system', text: `>>> Auto-restarting process...`, timestamp: Date.now() });
                // Trigger natural restart using the existing flow
                handleRun(matchingFolder.path);
            }
        };

        socket.on('ai:fix-applied', onAIFix);
        return () => socket.off('ai:fix-applied', onAIFix);
    }, [socket, folders]);

    // Scroll to bottom of terminal output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [forgeOutputs, activeExecutableId]);

    const handleRun = async (folderPath) => {
        console.log('[ForgePanel] handleRun for:', folderPath);
        setForgeStatus(folderPath, 'starting');
        setActiveExecutableId(folderPath);

        try {
            console.log('[ForgePanel] Sending /api/forge/run POST...');
            const response = await fetch('/api/forge/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: folderPath })
            });

            console.log('[ForgePanel] /api/forge/run response status:', response.status);
            if (!response.ok) {
                const data = await response.json();
                console.error('[ForgePanel] /api/forge/run error:', data.error);
                setForgeStatus(folderPath, 'error');
                appendForgeOutput(folderPath, { type: 'error', text: `Launch Error: ${data.error}`, timestamp: Date.now() });
            } else {
                setForgeStatus(folderPath, 'running');
            }
        } catch (error) {
            console.error('Error running folder:', error);
            setForgeStatus(folderPath, 'error');
            appendForgeOutput(folderPath, { type: 'error', text: `Error: ${error.message}`, timestamp: Date.now() });
        }
    };

    const handleStop = async (folderPath) => {
        setForgeStatus(folderPath, 'stopping');
        try {
            // In Visor ProcessRunner, the id is typically the path when run from Forge
            await fetch('/api/process/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: folderPath })
            });
            setForgeStatus(folderPath, 'stopped');
        } catch (error) {
            console.error("Failed to stop process", error);
        }
    };

    const activeOutput = activeExecutableId ? (forgeOutputs[activeExecutableId] || []) : [];
    const typeColors = {
        stdout: 'text-green',
        stderr: 'text-red',
        system: 'text-yellow',
        error: 'text-red'
    };


    const stripControlCodes = (text) => {
        if (!text) return text;
        return text
            .replace(/\x1bc/g, '') // strip alt clear screen
            .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, (match) => match.endsWith('m') ? match : '');
    };

    return (
        <div className="w-96 bg-[#000000] border-l-2 border-surface1 flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="h-10 border-b-2 border-surface1 flex items-center justify-between px-4 bg-[#0a0a0a]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-text">
                    <Terminal size={14} /> Forge Executables
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
                        onClick={fetchFolders}
                        className="text-subtext0 hover:text-text"
                        title="Refresh Folders"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            {/* Folders List */}
            {isExpanded && (
                <div className="flex-1 overflow-auto p-3 space-y-3 bg-[#0a0a09] border-b-2 border-surface1">
                    {loading && folders.length === 0 ? (
                        <div className="text-center text-xs text-subtext0 italic py-4">
                            Scanning for executable folders...
                        </div>
                    ) : folders.length > 0 ? (
                        folders.map((folder, index) => (
                            <ForgeCard
                                key={index}
                                folder={folder}
                                status={forgeStatuses[folder.path] || 'stopped'}
                                isActive={activeExecutableId === folder.path}
                                onClick={() => setActiveExecutableId(folder.path)}
                                onRun={() => handleRun(folder.path)}
                                onStop={() => handleStop(folder.path)}
                                url={urls[folder.path] || null}
                            />
                        ))
                    ) : (
                        <div className="text-center text-xs text-subtext0 mt-4">
                            No executable folders found.
                        </div>
                    )}
                </div>
            )}

            {/* Terminal Output Area (Bottom) */}
            {activeExecutableId && (
                <div className="h-72 bg-[#050505] flex flex-col border-t-2 border-surface1 shadow-inner">
                    <div className="h-8 bg-[#0a0a0a] px-2 flex items-center justify-between border-b border-surface1">
                        <div className="flex items-center gap-2 text-green opacity-80 truncate">
                            <Terminal size={12} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                {folders.find(e => e.path === activeExecutableId)?.name || 'Terminal'}
                            </span>
                        </div>
                        <button
                            onClick={() => useStore.setState(state => ({ forgeOutputs: { ...state.forgeOutputs, [activeExecutableId]: [] } }))}
                            className="text-subtext0 hover:text-red transition-colors"
                            title="Clear output"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                    <div
                        ref={outputRef}
                        className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-subtext0 bg-[#050505] selection:bg-surface2"
                    >
                        {activeOutput.length === 0 ? (
                            <div className="text-subtext1 italic py-2">Select a folder and click Run to see output...</div>
                        ) : (
                            activeOutput.map((line, i) => (
                                <div key={i} className={`whitespace-pre-wrap break-all ${typeColors[line.type] || 'text-subtext0'}`}>
                                    <Ansi>{stripControlCodes(line.text)}</Ansi>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

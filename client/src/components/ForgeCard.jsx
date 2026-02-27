import React, { useState, useEffect, useRef } from 'react';
import { Play, Loader2, Folder, FileText, Clock, ExternalLink } from 'lucide-react';
import io from 'socket.io-client';

const ForgeCard = ({ folder }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState(null);
    const [processId, setProcessId] = useState(null);
    const [detectedUrl, setDetectedUrl] = useState(null);

    // Refs to access state inside socket callbacks without re-binding
    const processIdRef = useRef(null);
    const socketRef = useRef(null);

    // Update ref when state changes
    useEffect(() => {
        processIdRef.current = processId;
    }, [processId]);

    useEffect(() => {
        // Initialize socket connection once
        const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : '/';
        socketRef.current = io(socketUrl);

        socketRef.current.on('process:url', (data) => {
            if (data.id === processIdRef.current) {
                setDetectedUrl(data.url);
                setIsRunning(false); // Stop loading spinner
                window.open(data.url, '_blank');
            }
        });

        socketRef.current.on('process:error', (data) => {
            if (data.id === processIdRef.current) {
                setError(data.error);
                setIsRunning(false);
            }
        });

        socketRef.current.on('process:exit', (data) => {
             if (data.id === processIdRef.current && data.code !== 0 && data.code !== null) {
                // Only show error if it exited with error and we haven't opened a URL yet
                // (Sometimes processes exit after opening URL, e.g. if they fork)
                // But for dev servers, they usually stay running.
                setError(`Process exited with code ${data.code}`);
                setIsRunning(false);
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const handleRun = async () => {
        setIsRunning(true);
        setError(null);
        setDetectedUrl(null);

        try {
            const response = await fetch('/api/forge/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: folder.path })
            });

            const data = await response.json();

            if (response.ok) {
                setProcessId(data.id);
                // We keep isRunning=true until we get a URL or error
                // But set a timeout to stop loading if no URL is found after some time
                setTimeout(() => {
                    setIsRunning(prev => {
                        if (prev) {
                            // If still running (loading) after 15s, just stop spinner but keep process
                            // Maybe the user needs to check logs (which we don't show here yet)
                            return false;
                        }
                        return prev;
                    });
                }, 15000);
            } else {
                setError(data.error || 'Failed to launch executable.');
                setIsRunning(false);
            }
        } catch (err) {
            console.error('Error running executable:', err);
            setError('An unexpected error occurred during launch.');
            setIsRunning(false);
        }
    };

    // Placeholder for metadata display
    const renderMetadata = () => {
        const { metadata, executables } = folder;
        const execNames = executables ? executables.map(e => e.name).join(', ') : '';

        return (
            <div className="text-[10px] text-subtext1 mt-1 space-y-1">
                {metadata?.fileCount !== undefined && <span>{metadata.fileCount} files</span>}
                {metadata?.lastModified && (
                    <span className="block text-[10px] opacity-70">
                        Modified: {new Date(metadata.lastModified).toLocaleDateString()}
                    </span>
                )}
                {execNames && (
                    <div className="flex items-center gap-1 mt-1">
                        <FileText size={10} />
                        <span className="truncate" title={execNames}>{execNames}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-surface0 p-3 rounded-md border border-surface1 flex flex-col gap-2 hover:border-blue transition-colors">
            <div className="flex items-center gap-2">
                <Folder size={16} className="text-blue shrink-0" />
                <h4 className="text-sm font-bold text-text truncate flex-1" title={folder.name}>
                    {folder.name}
                </h4>
            </div>
            <p className="text-xs text-subtext0 line-clamp-2 min-h-[2.5em]">
                {folder.description || 'No description provided.'}
            </p>

            {renderMetadata()}

            {error && (
                <div className="text-red text-xs mt-1 bg-red/10 p-1 rounded border border-red/20">
                    {error}
                </div>
            )}

            <div className="flex gap-2 mt-2">
                <button
                    onClick={handleRun}
                    disabled={isRunning}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors
                        ${isRunning
                            ? 'bg-surface1 text-subtext0 cursor-not-allowed'
                            : 'bg-green text-crust hover:bg-green/80'
                        }`}
                >
                    {isRunning ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Launching...
                        </>
                    ) : (
                        <>
                            <Play size={14} />
                            Run
                        </>
                    )}
                </button>

                {detectedUrl && (
                    <a
                        href={detectedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue text-crust rounded-sm hover:bg-blue/80 flex items-center justify-center"
                        title="Open App"
                    >
                        <ExternalLink size={14} />
                    </a>
                )}
            </div>
        </div>
    );
};

export default ForgeCard;

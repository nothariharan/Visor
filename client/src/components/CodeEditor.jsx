import React, { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { X, Save, FileCode } from 'lucide-react';
import useStore from '../store';

const CodeEditor = () => {
    const { editingFile, closeFile, updateFileContent, saveFile, isSaving } = useStore();
    const editorRef = useRef(null);

    // Keyboard shortcut for save
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveFile();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveFile]);

    if (!editingFile) return null;

    const { path, label, content, originalContent } = editingFile;
    const hasUnsavedChanges = content !== originalContent;

    // Determine language
    const getLanguage = (filename) => {
        if (!filename) return 'javascript';
        if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
        if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
        if (filename.endsWith('.json')) return 'json';
        if (filename.endsWith('.css')) return 'css';
        if (filename.endsWith('.html')) return 'html';
        if (filename.endsWith('.md')) return 'markdown';
        return 'plaintext';
    };

    return (
        <div className="fixed top-0 right-0 h-full w-[600px] bg-base shadow-hard-hover z-[200] flex flex-col border-l-2 border-surface1 transform transition-transform duration-300 ease-in-out font-mono">
            {/* Header */}
            <div className="h-10 bg-mantle flex items-center justify-between px-4 border-b-2 border-surface1">
                <div className="flex items-center gap-2 overflow-hidden">
                    <FileCode size={16} className="text-blue shrink-0" />
                    <span className="text-sm font-bold text-text truncate" title={path}>
                        {label}
                    </span>
                    {hasUnsavedChanges && (
                        <span className="w-2 h-2 rounded-full bg-yellow shrink-0 ml-1" title="Unsaved changes" />
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={saveFile}
                        disabled={!hasUnsavedChanges || isSaving}
                        className={`p-1.5 rounded transition-colors ${hasUnsavedChanges
                            ? 'text-text hover:bg-surface0 hover:text-green'
                            : 'text-surface2 cursor-not-allowed'
                            }`}
                        title="Save (Ctrl+S)"
                    >
                        <Save size={16} />
                    </button>
                    <button
                        onClick={closeFile}
                        className="p-1.5 text-overlay0 hover:text-red hover:bg-surface0 rounded transition-colors"
                        title="Close"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative bg-base">
                <Editor
                    height="100%"
                    defaultLanguage={getLanguage(path)}
                    path={path}
                    value={content}
                    theme="vs-dark"
                    onChange={(value) => updateFileContent(value || '')}
                    onMount={(editor) => {
                        editorRef.current = editor;
                    }}
                    options={{
                        minimap: { enabled: true },
                        fontSize: 13,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                        fontFamily: "'JetBrains Mono', monospace",
                        fontLigatures: true,
                        backgroundColor: '#1e1e2e',
                    }}
                />

                {isSaving && (
                    <div className="absolute inset-0 bg-crust/50 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <div className="bg-mantle border border-surface1 text-text px-4 py-2 rounded shadow-hard text-sm font-bold">
                            Saving...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeEditor;

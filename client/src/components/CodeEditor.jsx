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
        <div className="fixed top-0 right-0 h-full w-[600px] bg-[#1e1e1e] shadow-2xl z-50 flex flex-col border-l border-slate-700 transform transition-transform duration-300 ease-in-out">
            {/* Header */}
            <div className="h-12 bg-[#252526] flex items-center justify-between px-4 border-b border-[#3e3e42]">
                <div className="flex items-center gap-2 overflow-hidden">
                    <FileCode size={16} className="text-blue-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-200 truncate" title={path}>
                        {label}
                    </span>
                    {hasUnsavedChanges && (
                        <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0 ml-1" title="Unsaved changes" />
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={saveFile}
                        disabled={!hasUnsavedChanges || isSaving}
                        className={`p-1.5 rounded transition-colors ${hasUnsavedChanges
                                ? 'text-slate-200 hover:bg-[#3e3e42] hover:text-white'
                                : 'text-slate-500 cursor-not-allowed'
                            }`}
                        title="Save (Ctrl+S)"
                    >
                        <Save size={18} />
                    </button>
                    <button
                        onClick={closeFile}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-[#3e3e42] rounded transition-colors"
                        title="Close"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    defaultLanguage={getLanguage(path)}
                    path={path} // Important for model URI and intellisense isolation
                    value={content}
                    theme="vs-dark"
                    onChange={(value) => updateFileContent(value || '')}
                    onMount={(editor) => {
                        editorRef.current = editor;
                    }}
                    options={{
                        minimap: { enabled: true },
                        fontSize: 14,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                        fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                        fontLigatures: true,
                    }}
                />

                {isSaving && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10 backdrop-blur-[1px]">
                        <div className="bg-slate-800 text-white px-4 py-2 rounded shadow-lg text-sm font-medium">
                            Saving...
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeEditor;

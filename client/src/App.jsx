import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GraphCanvas from './components/GraphCanvas';
import Sidebar from './components/Sidebar';
import ProcessManager from './components/ProcessManager';
import ForgePanel from './components/ForgePanel';
import SearchBar from './components/SearchBar';
import SearchModal from './components/SearchModal';
import CodeEditor from './components/CodeEditor';
import ErrorToast from './components/ErrorToast';
import ReturnButton from './components/ReturnButton';
import ChroniclePanel from './components/ChroniclePanel';
import io from 'socket.io-client';
import useStore from './store';
import LegendPanel from './components/LegendPanel';
import { ReactFlowProvider } from 'reactflow';
import { Eye, Zap, Save } from 'lucide-react';
import { useSearchShortcut } from './hooks/useSearchShortcut';

function getRelativeTime(timestamp) {
  if (!timestamp) return 'never';
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 1) return 'just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return 'long ago';
}

function App() {
  const [currentMode, setCurrentMode] = useState('skeleton');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { handleExecutionError, clearErrors, isSearchModalOpen, setIsSearchModalOpen, lastSaveTime, isSavingLayout } = useStore();

  // ...existing code...

  // Refresh the "saved X ago" text every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Global Socket for App-wide Events (Error Visualization)
    const socketUrl = import.meta.env.DEV ? 'http://localhost:6767' : '/';
    const socket = io(socketUrl);

    socket.on('execution:error', (data) => {
      console.log('[App] Global execution error received:', data);
      handleExecutionError(data);
    });

    socket.on('errors:cleared', () => {
      clearErrors();
    });

    return () => socket.close();
  }, [handleExecutionError, clearErrors]);


  // Setup Cmd+P keyboard shortcut
  useSearchShortcut(() => {
    setIsSearchModalOpen(true);
  });

  return (
    <div className="h-screen w-screen bg-base font-mono flex flex-col overflow-hidden text-text">
      {/* Global Components */}
      <CodeEditor />
      <ErrorToast />
      <ReturnButton />
      <SearchModal isOpen={isSearchModalOpen} onClose={() => setIsSearchModalOpen(false)} />

      {/* Header */}
      <Header
        currentMode={currentMode}
        onModeChange={setCurrentMode}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Floating Search Bar */}
        <SearchBar />

        {/* Sidebar (Left) */}
        {showSidebar && (
          <Sidebar />
        )}

        {/* Graph Canvas (Center) */}
        <div className="flex-1 relative bg-mantle h-full w-full">
          <ReactFlowProvider>
            <GraphCanvas mode={currentMode} />
          </ReactFlowProvider>
          {/* Floating Legend Panel */}
          <LegendPanel isOpen={showLegend} onClose={() => setShowLegend(false)} />
        </div>

        {/* Right Panel: Chronicle Timeline or ExecutablesPanel (Forge) */}
        {currentMode === 'chronicle' && (
          <div className="w-96 bg-crust border-l-2 border-mauve/40 flex flex-col overflow-hidden">
            <ChroniclePanel />
          </div>
        )}
        {currentMode === 'forge' && (
          <ForgePanel />
        )}
      </div>

      {/* Status Bar (Bottom) */}
      <div className="h-6 bg-crust border-t border-surface1 flex items-center justify-between px-4 text-xs text-subtext0 select-none">
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowSidebar(!showSidebar)} className="hover:text-text">
            [{showSidebar ? 'x' : ' '}] Sidebar
          </button>
          <div className="flex items-center gap-1">
            <Eye size={10} className="text-green" />
            <span>Watching files...</span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          {/* Legend Toggle */}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={`hover:text-text flex items-center gap-1 ${showLegend ? 'text-blue' : ''}`}
          >
            <span>[?]</span> Index
          </button>

          {/* Auto-save Status */}
          <div className="flex items-center gap-1" key={refreshKey}>
            <Save size={10} className={isSavingLayout ? 'text-yellow animate-pulse' : 'text-green'} />
            <span className="text-xs">
              {isSavingLayout ? 'Saving...' : `Saved ${getRelativeTime(lastSaveTime)}`}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Zap size={10} className="text-yellow" />
            <span>0ms</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

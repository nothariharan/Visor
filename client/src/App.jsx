import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import GraphCanvas from './components/GraphCanvas';
import Sidebar from './components/Sidebar';
import ProcessManager from './components/ProcessManager';
import SearchBar from './components/SearchBar';
import CodeEditor from './components/CodeEditor';
import ErrorToast from './components/ErrorToast';
import io from 'socket.io-client';
import useStore from './store';
import LegendPanel from './components/LegendPanel';
import { Eye, Zap } from 'lucide-react';

function App() {
  const [currentMode, setCurrentMode] = useState('skeleton');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showProcessManager, setShowProcessManager] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const { handleExecutionError, clearErrors } = useStore();

  useEffect(() => {
    // Global Socket for App-wide Events (Error Visualization)
    const socketUrl = import.meta.env.DEV ? 'http://localhost:3000' : '/';
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

  return (
    <div className="h-screen w-screen bg-base font-mono flex flex-col overflow-hidden text-text">
      {/* Global Components */}
      <CodeEditor />
      <ErrorToast />

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
        <div className="flex-1 relative bg-mantle">
          <GraphCanvas mode={currentMode} />
          {/* Floating Legend Panel */}
          <LegendPanel isOpen={showLegend} onClose={() => setShowLegend(false)} />
        </div>

        {/* ProcessManager (Right) */}
        {showProcessManager && (
          <ProcessManager />
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

          <button onClick={() => setShowProcessManager(!showProcessManager)} className="hover:text-text">
            [{showProcessManager ? 'x' : ' '}] Process Mgr
          </button>
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

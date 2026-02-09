import React from 'react';
import Graph from './components/Graph';
import Search from './components/Search';


function App() {
  return (
    <div className="App">
      <div className="absolute top-4 left-4 z-50 bg-slate-800/90 backdrop-blur p-4 rounded-lg border border-slate-700 shadow-xl">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">VISOR</h1>
        <p className="text-xs text-slate-400 mt-1">Foundational Build v0.1</p>
      </div>
      <Search />
      <Graph />
    </div>

  );
}

export default App;

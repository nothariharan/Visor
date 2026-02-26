import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

const ProcessManager = () => {
  const [runtimes, setRuntimes] = useState([]);

  useEffect(() => {
    fetchRuntimes();
  }, []);

  const fetchRuntimes = async () => {
    try {
      const response = await fetch('/api/runtimes');
      if (response.ok) {
        const data = await response.json();
        setRuntimes(data);
      } else {
        console.error('Failed to fetch runtimes:', response.status);
      }
    } catch (error) {
      console.error('Error fetching runtimes:', error);
    }
  };

  const detectRuntimes = async () => {
    try {
      const response = await fetch('/api/runtimes/detect', { method: 'POST' });
      if (response.ok) {
        // Runtimes detected successfully, refresh the list
        fetchRuntimes();
      } else {
        console.error('Failed to detect runtimes:', response.status);
      }
    } catch (error) {
      console.error('Error detecting runtimes:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-surface0 border-b border-surface1 px-4 py-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">Runtimes</h3>
        <button
          onClick={detectRuntimes}
          className="text-subtext0 hover:text-text"
          title="Refresh Runtimes"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="overflow-y-auto p-4">
        {runtimes.length > 0 ? (
          <ul>
            {runtimes.map((runtime, idx) => (
              <li key={idx} className="text-sm">
                {runtime.name} - {runtime.version}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-subtext0">No runtimes detected.</p>
        )}
      </div>
    </div>
  );
};

export default ProcessManager;

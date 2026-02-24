import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { File, Folder, AlertTriangle, XCircle, Zap, Box } from 'lucide-react';
import useStore from '../store';
import { getFileTypeStyles } from '../utils/fileColors';

const TerminalNode = ({ id, data, selected }) => {
  const { activeErrors, searchQuery } = useStore();

  const normalize = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : '';
  const normalizedId = normalize(id);

  if (!data) return null; // Safety first

  const { color: fileColor, label: fileTypeLabel } = getFileTypeStyles(data?.label, data?.type === 'folder');

  const errorData = activeErrors[normalizedId];

  const isError = !!errorData || data.status === 'error';
  const isExecuting = data.status === 'executing';
  const isWarning = data.status === 'warning';
  const isExpanded = data.expanded;
  const isSearchResult = searchQuery && data?.label?.toLowerCase().includes(searchQuery.toLowerCase());

  // --- Style Calculation ---
  // Use color values directly instead of Tailwind classes to avoid conflicts
  const statusBorderColor = isError ? '#ef4444' : // red
    isWarning ? '#f9e2af' : // yellow
      isExecuting ? '#a6e3a1' : // green
        selected ? '#89b4fa' : // blue
          '#585b70'; // default surface1

  const shadowColor = isError ? 'shadow-hard-red' :
    isExecuting ? 'shadow-hard-green' :
      isExpanded ? 'shadow-none' : 'shadow-hard';

  const animationClass = isExecuting ? 'animate-pulse-slow' :
    isError ? 'animate-pulse' : '';

  const errorMessage = errorData?.message || data.errorMessage;
  const errorLine = errorData?.line || data.line;

  // === CONTAINER MODE (Expanded Folder) ===
  if (isExpanded && data.type === 'folder') {
    return (
      <div className={`
              w-full h-full min-w-[200px] min-h-[100px]
              rounded-lg border-2 border-dashed
              bg-crust/50 transition-all group
              relative
              ${isSearchResult ? 'ring-2 ring-yellow ring-offset-2 ring-offset-surface0' : ''}
          `} style={{ borderColor: fileColor }}>
        <div className="absolute -top-3 left-4 px-2 bg-crust text-xs font-mono text-subtext0 flex items-center gap-2">
          <Box size={12} style={{ color: fileColor }} />
          <span className="font-bold" style={{ color: fileColor }}>{data?.label || 'Unknown'}</span>
        </div>
        <Handle type="target" position={Position.Left} className="opacity-0" />
        <Handle type="source" position={Position.Right} className="opacity-0" />
      </div>
    );
  }

  // === CARD MODE (File or Collapsed Folder) ===
  return (
    <div
      className={`
        font-mono w-64 bg-surface0 text-text 
        border-2 ${shadowColor}
        rounded-md overflow-hidden transition-all
        hover:shadow-hard-hover
        ${animationClass}
        ${isSearchResult ? 'ring-2 ring-yellow ring-offset-2 ring-offset-surface0' : ''}
      `}
      style={{
        borderColor: statusBorderColor, // Use the calculated color value
        borderTopColor: fileColor,
        borderTopWidth: '4px'
      }}
    >
      {/* Header Bar */}
      <div className={`
        px-3 py-1 text-xs border-b-2
        ${isError ? 'bg-red/10 border-red/20' : isExecuting ? 'bg-green/10 border-green/20' : 'bg-mantle border-surface1'}
        flex justify-between items-center
      `}>
        <span className="text-subtext0">
          {data.type === 'folder' ? 'drwxr-xr-x' : '-rw-r--r--'}
        </span>
        <span style={{ color: fileColor }}>[{fileTypeLabel}]</span>
      </div>

      {/* Main Content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {isError && <XCircle className="text-red" size={20} />}
          {isExecuting && <Zap className="text-green" size={20} />}
          {isWarning && <AlertTriangle className="text-yellow" size={20} />}
          {!isError && !isExecuting && !isWarning && (
            data.type === 'folder'
              ? <Folder size={20} style={{ color: fileColor }} />
              : <File size={20} style={{ color: fileColor }} />
          )}
          <span className="font-bold text-sm truncate" title={data?.label || ''}>{data?.label || ''}</span>
        </div>

        {/* Metadata & Tags */}
      </div>

      {/* Error/Warning Message */}
      {(isError || isWarning) && errorMessage && (
        <div className={`p-2 border-t-2 ${isError ? 'border-red/20 bg-red/5' : 'border-yellow/20 bg-yellow/5'}`}>
          {/* ... error content ... */}
        </div>
      )}

      {/* React Flow Handles */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-4 !bg-surface1 !rounded-none !border-none hover:!bg-blue" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-4 !bg-surface1 !rounded-none !border-none hover:!bg-blue" />
    </div>
  );
};

export default memo(TerminalNode);

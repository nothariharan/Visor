import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { File, Folder, AlertTriangle, XCircle, Zap, Box } from 'lucide-react';
import useStore from '../store';
import { getFileTypeStyles } from '../utils/fileColors';

const TerminalNode = ({ id, data, selected }) => {
  const { activeErrors, searchQuery, historicalChanges, isFixing, handleAIFix } = useStore();

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

  // --- Chronicle diff status ---
  const chronicleStatus = historicalChanges
    ? historicalChanges.added?.some(f => normalizedId.endsWith(f.replace(/\\/g, '/').toLowerCase())) ? 'added'
      : historicalChanges.deleted?.some(f => normalizedId.endsWith(f.replace(/\\/g, '/').toLowerCase())) ? 'deleted'
        : historicalChanges.modified?.some(f => normalizedId.endsWith(f.replace(/\\/g, '/').toLowerCase())) ? 'modified'
          : null
    : null;

  // --- Style Calculation ---
  const statusBorderColor = chronicleStatus === 'added' ? '#a6e3a1'
    : chronicleStatus === 'modified' ? '#f9e2af'
      : chronicleStatus === 'deleted' ? '#f38ba8'
        : isError ? '#ef4444'
          : isWarning ? '#f9e2af'
            : isExecuting ? '#a6e3a1'
              : selected ? '#89b4fa'
                : '#585b70';

  const shadowColor = isExpanded ? 'shadow-none' : 'shadow-hard';

  const animationClass = isExecuting ? 'animate-pulse-slow' :
    isError ? 'node-execution-error' : '';

  const errorMessage = errorData?.message || data.errorMessage;

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
        borderColor: statusBorderColor,
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

        {/* Chronicle diff badge */}
        {chronicleStatus && (
          <div className={`mt-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded w-fit
            ${chronicleStatus === 'added' ? 'bg-green/10 text-green'
              : chronicleStatus === 'deleted' ? 'bg-red/10 text-red'
                : 'bg-yellow/10 text-yellow'}
          `}>
            {chronicleStatus}
          </div>
        )}
      </div>

      {/* Error/Warning Message */}
      {(isError || isWarning) && errorMessage && (
        <div className={`p-2 border-t-2 flex flex-col gap-1 ${isError ? 'border-red/20' : 'border-yellow/20'}`}>
          <div className="text-xs break-words">{errorMessage}</div>
          {isError && (
            <div className="flex flex-col gap-1 mt-1">
              {errorData?.line && (
                <button
                  className="w-full py-1 border border-red/20 hover:bg-red/20 text-red text-[10px] font-bold rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `vscode://file/${data.path || id}:${errorData.line}`;
                  }}
                >
                  <span className="opacity-70 mr-1">&gt;</span> jump_to_line {errorData.line}
                </button>
              )}

              <div className="flex gap-1 w-full">
                <button
                  disabled={isFixing}
                  className={`flex-1 py-1.5 border border-yellow/30 text-yellow text-[10px] font-bold rounded transition-all flex items-center justify-center gap-1.5 ${isFixing
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-yellow/20 hover:border-yellow/50'
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (handleAIFix) {
                      handleAIFix(
                        data.path || id,
                        errorData?.originalError || { message: errorMessage, type: 'BrowserError', line: errorData?.line }
                      );
                    }
                  }}
                >
                  ✨ {isFixing ? 'Fixing...' : 'AI Auto Fix'}
                </button>

                <button
                  className="flex-1 py-1.5 border border-blue/30 hover:bg-blue/20 hover:border-blue/50 text-blue text-[10px] font-bold rounded transition-colors flex items-center justify-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    useStore.getState().openFile(data.path || id, data.label || 'Unknown');
                  }}
                >
                  <span className="opacity-70">&gt;</span> Manual Fix
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* React Flow Handles */}
      <Handle type="target" position={Position.Left} className="!w-2 !h-4 !bg-surface1 !rounded-none !border-none hover:!bg-blue" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-4 !bg-surface1 !rounded-none !border-none hover:!bg-blue" />
    </div>
  );
};

export default memo(TerminalNode);

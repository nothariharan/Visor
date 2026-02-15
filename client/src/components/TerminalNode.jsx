import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { File, Folder, AlertTriangle, XCircle, Zap, Box } from 'lucide-react';
import useStore from '../store';
import { getFileTypeStyles } from '../utils/fileColors';

const TerminalNode = ({ id, data, selected }) => {
  const { activeErrors } = useStore();

  // Normalization logic
  const normalize = (p) => p ? p.replace(/\\/g, '/').toLowerCase() : '';
  const normalizedId = normalize(id);

  // Get File Type Styles
  const { color: fileColor, label: fileTypeLabel } = getFileTypeStyles(data.label, data.type === 'folder');

  // Check global error state
  const errorData = activeErrors[normalizedId];

  const isError = !!errorData || data.status === 'error';
  const isExecuting = data.status === 'executing';
  const isWarning = data.status === 'warning';
  const isExpanded = data.expanded;

  // Determine styles based on state
  const borderColor = isError ? 'border-red' :
    isWarning ? 'border-yellow' :
      isExecuting ? 'border-green' :
        selected ? 'border-blue' :
          isExpanded ? 'border-surface2' : 'border-surface1';

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
          `} style={{ borderColor: fileColor }}>
        {/* Minimal Label */}
        <div className="absolute -top-3 left-4 px-2 bg-crust text-xs font-mono text-subtext0 flex items-center gap-2">
          <Box size={12} style={{ color: fileColor }} />
          <span className="font-bold" style={{ color: fileColor }}>{data.label}</span>
        </div>

        {/* Handles for connections (Hidden but functional) */}
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
      `}
      style={{
        borderColor: isError ? undefined : (isExecuting ? undefined : (selected ? undefined : '#45475a')),
        borderTopColor: isError ? undefined : (isExecuting ? undefined : fileColor),
        borderTopWidth: '4px'
      }}
    >
      {/* Header Bar */}
      <div className={`
        px-3 py-1 text-xs border-b-2 border-surface1
        ${isError ? 'bg-red/10' : isExecuting ? 'bg-green/10' : 'bg-mantle'}
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
          {/* Icon based on status */}
          {isError && <XCircle className="text-red" size={20} />}
          {isExecuting && <Zap className="text-green" size={20} />}
          {isWarning && <AlertTriangle className="text-yellow" size={20} />}
          {!isError && !isExecuting && !isWarning && (
            data.type === 'folder'
              ? <Folder size={20} style={{ color: fileColor }} />
              : <File size={20} style={{ color: fileColor }} />
          )}

          {/* Filename */}
          <span className="font-bold text-sm truncate" title={data.label}>{data.label}</span>
        </div>

        {/* Metadata */}
        <div className="text-[10px] text-subtext0 space-y-1">
          {data.commits && (
            <div className="flex justify-between">
              <span>[commits]:</span>
              <span className={data.commits > 20 ? 'text-red' : 'text-green'}>
                {data.commits}
              </span>
            </div>
          )}

          {data.loc && (
            <div className="flex justify-between">
              <span>[loc]:</span>
              <span>{data.loc}</span>
            </div>
          )}

          {data.imports && (
            <div className="flex justify-between">
              <span>[imports]:</span>
              <span className="text-blue">{data.imports}</span>
            </div>
          )}

          {data.importedBy && (
            <div className="flex justify-between">
              <span>[deps]:</span>
              <span className="text-peach font-bold">{data.importedBy}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {data.framework && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="tag tag-blue">{data.framework}</span>
            {data.category && (
              <span className="tag tag-green">{data.category}</span>
            )}
          </div>
        )}
      </div>

      {/* Error/Warning Message */}
      {(isError || isWarning) && errorMessage && (
        <div className={`
          p-2 border-t-2 ${borderColor}
          ${isError ? 'bg-red/5' : 'bg-yellow/5'}
        `}>
          <div className={`
            text-[10px] mb-2 font-mono
            ${isError ? 'text-red' : 'text-yellow'}
            break-words
          `}>
            [ERROR] {errorMessage}
          </div>
          {errorLine && (
            <div className="text-[10px] text-subtext0 mb-2">
              → Line {errorLine}:{data.column || 0}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button className="
              flex-1 py-1 bg-peach text-crust 
              text-[10px] font-bold uppercase 
              hover:bg-peach/80 transition-colors
              border border-peach
            ">
              ✨ AI Fix
            </button>
            <button className="
              px-3 py-1 bg-surface1 text-text 
              text-[10px] font-bold uppercase 
              hover:bg-surface2 transition-colors
              border border-surface1
            ">
              Jump →
            </button>
          </div>
        </div>
      )}

      {/* React Flow Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-4 !bg-surface1 !rounded-none !border-none hover:!bg-blue"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-4 !bg-surface1 !rounded-none !border-none hover:!bg-blue"
      />
    </div>
  );
};

export default memo(TerminalNode);

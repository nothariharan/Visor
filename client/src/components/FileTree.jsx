import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, File, FileCode, FileJson, Image, Database } from 'lucide-react';
import useStore from '../store';

const FileTreeNode = ({ node, level = 0, onToggle, onSelect }) => {
    const { expandedFolders, focusedNode } = useStore();
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = focusedNode === node.path;

    const getIcon = (name, isDir) => {
        if (isDir) return isExpanded ? <Folder size={16} className="text-yellow-500" /> : <Folder size={16} className="text-yellow-500" />;
        if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.ts') || name.endsWith('.tsx')) return <FileCode size={16} className="text-blue-400" />;
        if (name.endsWith('.json')) return <FileJson size={16} className="text-yellow-400" />;
        if (name.endsWith('.css') || name.endsWith('.scss')) return <FileCode size={16} className="text-sky-400" />;
        if (name.match(/\.(png|jpg|jpeg|gif|svg)$/)) return <Image size={16} className="text-purple-400" />;
        if (name.match(/\.(sql|db|sqlite)$/)) return <Database size={16} className="text-green-400" />;
        return <File size={16} className="text-slate-400" />;
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (node.isDirectory) {
            onToggle(node.path);
        } else {
            onSelect(node.path);
        }
    };

    return (
        <div style={{ paddingLeft: `${level * 12}px` }}>
            <div
                onClick={handleClick}
                className={`flex items-center py-1 pr-2 cursor-pointer select-none transition-colors rounded-sm
                    ${isSelected ? 'bg-blue/20 text-blue' : 'text-subtext1 hover:bg-surface0'}
                `}
            >
                <div className="w-4 h-4 mr-1 flex items-center justify-center shrink-0">
                    {node.isDirectory && (
                        isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </div>
                <div className="mr-2 shrink-0">
                    {getIcon(node.name, node.isDirectory)}
                </div>
                <span className="text-xs truncate">{node.name}</span>
            </div>

            {node.isDirectory && isExpanded && node.children && (
                <div>
                    {node.children.map(child => (
                        <FileTreeNode
                            key={child.path}
                            node={child}
                            level={level + 1}
                            onToggle={onToggle}
                            onSelect={onSelect}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const FileTree = () => {
    const { nodes, toggleFolder, setFocusedNode, openFile } = useStore();
    const [treeData, setTreeData] = useState([]);

    // Convert flat node list to tree structure
    useEffect(() => {
        const buildTree = () => {
            // Filter only file/folder nodes from the graph AND only those that aren't hidden
            const graphNodes = nodes.filter(n => (n.type === 'folder' || n.type === 'custom') && !n.hidden);

            const tree = [];
            const idMap = {};

            // Sort nodes: folders first, then files, alphabetically
            const sortedNodes = [...graphNodes].sort((a, b) => {
                if (a.type === b.type) return a.data.label.localeCompare(b.data.label);
                return a.type === 'folder' ? -1 : 1;
            });

            sortedNodes.forEach(n => {
                idMap[n.id] = {
                    path: n.id,
                    name: n.data.label,
                    isDirectory: n.type === 'folder',
                    children: [],
                };
            });

            sortedNodes.forEach(n => {
                if (n.parentNode && idMap[n.parentNode]) {
                    idMap[n.parentNode].children.push(idMap[n.id]);
                } else {
                    // It's a root node in the graph context (or its parent is hidden)
                    // If it has a parentNode but that parent isn't in our current (filtered) idMap,
                    // we treat it as a root for the purpose of the sidebar view.
                    tree.push(idMap[n.id]);
                }
            });

            setTreeData(tree);
        };

        buildTree();
    }, [nodes]);

    const handleToggle = (path) => {
        toggleFolder(path);
    };

    const handleSelect = (path) => {
        setFocusedNode(path);
        // Also open the file in editor
        const node = nodes.find(n => n.id === path);
        if (node && node.type === 'custom') {
            openFile(path, node.data.label);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-base font-mono">
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-surface1 scrollbar-track-transparent">
                {treeData.length === 0 ? (
                    <div className="text-center text-subtext0 text-xs mt-10 p-4 border border-dashed border-surface1 rounded">
                        <p>No files in view.</p>
                        <p className="mt-2 text-[10px] opacity-70">Adjust view mode or expand folders in the graph.</p>
                    </div>
                ) : (
                    treeData.map(node => (
                        <FileTreeNode
                            key={node.path}
                            node={node}
                            onToggle={handleToggle}
                            onSelect={handleSelect}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default FileTree;

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
                    ${isSelected ? 'bg-blue-500/20 text-blue-200' : 'text-slate-300 hover:bg-slate-800'}
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
    const [isVisible, setIsVisible] = useState(true);

    // Convert flat node list to tree structure
    useEffect(() => {
        const buildTree = () => {
            // Filter only file/folder nodes from the graph
            const graphNodes = nodes.filter(n => n.type === 'folder' || n.type === 'custom');

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
                    // It's a root node in the graph context
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

    if (!isVisible) {
        return (
            <div className="absolute top-20 left-0 z-40">
                <button
                    onClick={() => setIsVisible(true)}
                    className="bg-slate-800 p-2 rounded-r-md border border-l-0 border-slate-700 text-slate-400 hover:text-white shadow-md"
                    title="Show Project Structure"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="absolute top-20 left-4 bottom-20 w-64 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col z-40 transition-all duration-300">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/50 rounded-t-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Project Structure</span>
                <button
                    onClick={() => setIsVisible(false)}
                    className="text-slate-500 hover:text-white p-1 hover:bg-slate-700 rounded"
                    title="Hide Sidebar"
                >
                    <ChevronDown size={16} className="rotate-90" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {treeData.length === 0 ? (
                    <div className="text-center text-slate-500 text-xs mt-4 p-4 border border-dashed border-slate-700 rounded">
                        <p>Graph is empty.</p>
                        <p className="mt-2">Expand folders in the graph to populate this tree.</p>
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

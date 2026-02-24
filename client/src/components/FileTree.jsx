import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, ChevronDown, Folder, File, FileCode, FileJson, Image, Database } from 'lucide-react';
import useStore from '../store';

const Highlight = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <span key={i} className="bg-yellow text-base">
                        {part}
                    </span>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

const FileTreeNode = ({ node, level = 0, onToggle, onSelect, searchQuery }) => {
    const { expandedFolders, focusedNode } = useStore();
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = focusedNode === node.path;

    const getIcon = (name, isDir) => {
        if (isDir) return <Folder size={18} className="text-yellow" />;
        if (name.endsWith('.js') || name.endsWith('.jsx') || name.endsWith('.ts') || name.endsWith('.tsx')) return <FileCode size={18} className="text-blue" />;
        if (name.endsWith('.json')) return <FileJson size={18} className="text-yellow" />;
        if (name.endsWith('.css') || name.endsWith('.scss')) return <FileCode size={18} className="text-sky" />;
        if (name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) return <Image size={18} className="text-purple" />;
        if (name.match(/\.(sql|db|sqlite)$/i)) return <Database size={18} className="text-green" />;
        return <File size={18} className="text-subtext1" />;
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (node.isDirectory) {
            onToggle(node.path);
        } else {
            onSelect(node.path, node.name);
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
                <div className="w-5 h-5 mr-1 flex items-center justify-center shrink-0">
                    {node.isDirectory && (
                        isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                    )}
                </div>
                <div className="mr-2 shrink-0">
                    {getIcon(node.name, node.isDirectory)}
                </div>
                <span className="text-sm font-medium truncate">
                    <Highlight text={node.name} highlight={searchQuery} />
                </span>
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
                            searchQuery={searchQuery}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const FileTree = () => {
    const { nodes, toggleFolder, setFocusedNode, openFile, searchQuery, expandPaths } = useStore();

    const treeData = useMemo(() => {
        const graphNodes = nodes.filter(n => (n.type === 'folder' || n.type === 'custom') && !n.hidden);
        const idMap = {};
        const tree = [];

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
                tree.push(idMap[n.id]);
            }
        });

        return tree;
    }, [nodes]);

    const filteredTree = useMemo(() => {
        if (!searchQuery) return treeData;

        const lowerCaseQuery = searchQuery.toLowerCase();
        const pathsToExpand = new Set();

        function filter(nodes) {
            const result = [];
            for (const node of nodes) {
                let matched = node.name.toLowerCase().includes(lowerCaseQuery);
                let children = [];

                if (node.isDirectory) {
                    children = filter(node.children);
                }

                if (matched || children.length > 0) {
                    if (matched) {
                        // If this node matches, add its parents to the expansion set
                        let parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
                        while(parentPath) {
                            pathsToExpand.add(parentPath);
                            parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
                        }
                    }
                    result.push({ ...node, children });
                }
            }
            return result;
        }

        const result = filter(treeData);
        if(pathsToExpand.size > 0) {
            // Use a timeout to avoid a Zustand state update loop during render
            setTimeout(() => expandPaths(Array.from(pathsToExpand)), 0);
        }
        return result;

    }, [searchQuery, treeData, expandPaths]);

    const handleToggle = (path) => {
        toggleFolder(path);
    };

    const handleSelect = (path, label) => {
        setFocusedNode(path);
        const node = nodes.find(n => n.id === path);
        if (node && node.type === 'custom') {
            openFile(path, label);
        }
    };

    const finalTreeData = searchQuery ? filteredTree : treeData;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-base font-mono">
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-surface1 scrollbar-track-transparent">
                {finalTreeData.length === 0 ? (
                    <div className="text-center text-subtext0 text-xs mt-10 p-4 border border-dashed border-surface1 rounded">
                        <p>{searchQuery ? 'No results found.' : 'No files in view.'}</p>
                        {!searchQuery && <p className="mt-2 text-[10px] opacity-70">Adjust view mode or expand folders in the graph.</p>}
                    </div>
                ) : (
                    finalTreeData.map(node => (
                        <FileTreeNode
                            key={node.path}
                            node={node}
                            onToggle={handleToggle}
                            onSelect={handleSelect}
                            searchQuery={searchQuery}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default FileTree;

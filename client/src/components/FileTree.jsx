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
                        while (parentPath) {
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
        if (pathsToExpand.size > 0) {
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
                    <div className="mt-8 mx-2 border border-surface1 bg-mantle p-4 font-mono shadow-hard">
                        <div className="flex items-center gap-2 mb-3 border-b border-surface1 pb-2">
                            <span className="text-peach animate-pulse">!</span>
                            <span className="text-subtext0 text-[10px] uppercase font-bold tracking-widest">System Message</span>
                        </div>
                        <div className="space-y-2">
                            <p className="text-text text-sm">
                                {searchQuery ? 'QUERY_RESULT: 0_ENTRIES' : 'VIEW_STATE: NO_FILES_IN_SCOPE'}
                            </p>
                            <p className="text-subtext0 text-[10px] leading-relaxed">
                                {searchQuery
                                    ? `Search for "${searchQuery}" returned no matches in the current graph context.`
                                    : 'The current view filters or collapsed states have excluded all nodes from the interface.'}
                            </p>
                            {!searchQuery && (
                                <div className="mt-4 pt-2 border-t border-surface1/30">
                                    <p className="text-[9px] text-blue uppercase font-bold mb-1">Suggestions:</p>
                                    <ul className="text-[9px] text-subtext1 space-y-1 list-none">
                                        <li>- Expand folder nodes in the Graph Canvas</li>
                                        <li>- Switch to "Skeleton" or "Topography" mode</li>
                                        <li>- Check filters in visor.config.js</li>
                                    </ul>
                                </div>
                            )}
                        </div>
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

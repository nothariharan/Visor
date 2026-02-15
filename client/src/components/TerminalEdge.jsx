import React from 'react';
import { getBezierPath } from 'reactflow';

export default function TerminalEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data
}) {
    const [edgePath] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const isActive = data?.executionType === 'trace';
    const isError = data?.executionType === 'error';

    // Base styles
    const strokeColor = isError ? '#f38ba8' : (isActive ? '#89b4fa' : '#45475a');
    const strokeWidth = isActive || isError ? 3 : 2;
    const strokeDasharray = isError ? '5,5' : '0';

    return (
        <>
            {/* Main path */}
            <path
                id={id}
                style={style}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                fill="none"
            />

            {/* Animated packet for active execution */}
            {isActive && (
                <circle r="3" fill="#89b4fa">
                    <animateMotion
                        dur="1.5s"
                        repeatCount="indefinite"
                        path={edgePath}
                        rotate="auto"
                    />
                </circle>
            )}

            {/* Error particle */}
            {isError && (
                <circle r="3" fill="#f38ba8">
                    <animateMotion
                        dur="0.5s"
                        repeatCount="indefinite"
                        path={edgePath}
                        rotate="auto"
                    />
                </circle>
            )}

            {/* Label */}
            {data?.label && (
                <text>
                    <textPath
                        href={`#${id}`}
                        startOffset="50%"
                        textAnchor="middle"
                        className="text-[10px] fill-subtext0 font-mono"
                        style={{ fill: '#bac2de' }}
                    >
                        {data.label}
                    </textPath>
                </text>
            )}
        </>
    );
}

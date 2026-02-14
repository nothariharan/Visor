import React from 'react';
import { BaseEdge, getSmoothStepPath } from 'reactflow';

const CustomEdge = ({
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
}) => {
    // Use SmoothStep for that "circuit board" / n8n feel
    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 16, // Rounded corners on the step
    });

    // Dynamic styles for execution flow
    let edgeStyle = { ...style };
    let className = '';

    if (data?.executionType === 'error') {
        edgeStyle = { ...edgeStyle, stroke: '#ef4444', strokeWidth: 3 };
        className = 'execution-path-error';
    } else if (data?.executionType === 'executing') {
        edgeStyle = { ...edgeStyle, stroke: '#10b981', strokeWidth: 3 };
        className = 'execution-path-active';
    }

    return (
        <>
            <BaseEdge path={edgePath} markerEnd={markerEnd} style={edgeStyle} className={className} />
            {data?.executionType === 'error' && (
                <circle r="4" fill="#ef4444">
                    <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
                </circle>
            )}
             {data?.executionType === 'executing' && (
                <circle r="4" fill="#10b981">
                    <animateMotion dur="1s" repeatCount="indefinite" path={edgePath} />
                </circle>
            )}
        </>
    );
};

export default CustomEdge;

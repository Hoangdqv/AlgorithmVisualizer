import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';

const GraphVisualization = forwardRef(({ currentState, tracerData }, ref) => {
  const graphData = currentState?.graph || [];
  const visited = currentState?.visited || [];
  const queue = currentState?.queue || [];
  const stack = currentState?.stack || [];
  const processingNode = currentState?.processing;
  const discoveredNode = currentState?.discovered;

  // Get data structure info from metadata
  const dataStructureType = tracerData?.metadata?.dataStructure || 'queue';
  const dataStructureLabel = tracerData?.metadata?.dataStructureLabel || 'Queue';

  const [nodePositions, setNodePositions] = useState([]);
  const [dragState, setDragState] = useState({ nodeIndex: null, offset: [0, 0] });
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Function to calculate initial positions
  const calculateInitialPositions = (nodeCount) => {
    if (nodeCount === 0) return [];

    const radius = 150;
    const centerX = 200;
    const centerY = 200;
    
    const positions = [];
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i * 2 * Math.PI) / nodeCount - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positions.push({ x, y });
    }
    return positions;
  };

  // Expose resetPositions to parent component
  useImperativeHandle(ref, () => ({
    resetPositions: () => {
      const nodeCount = graphData.length;
      setNodePositions(calculateInitialPositions(nodeCount));
    }
  }));

  // Initialize node positions
  useEffect(() => {
    const nodeCount = graphData.length;
    setNodePositions(calculateInitialPositions(nodeCount));
  }, [graphData.length]);

  const getSVGCoordinates = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const onMouseDown = (e, nodeIndex) => {
    e.preventDefault();
    isDraggingRef.current = true;
    
    const svgCoords = getSVGCoordinates(e);
    const offset = [
      svgCoords.x - nodePositions[nodeIndex].x,
      svgCoords.y - nodePositions[nodeIndex].y
    ];
    
    setDragState({ nodeIndex, offset });
  };

  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || dragState.nodeIndex === null) return;
    
    const svgCoords = getSVGCoordinates(e);
    let newX = svgCoords.x - dragState.offset[0];
    let newY = svgCoords.y - dragState.offset[1];
    
    // Constrain to viewBox boundaries (0-400 with padding for node radius of 25)
    const nodeRadius = 25;
    const minBound = nodeRadius;
    const maxBound = 400 - nodeRadius;
    
    newX = Math.max(minBound, Math.min(maxBound, newX));
    newY = Math.max(minBound, Math.min(maxBound, newY));
    
    setNodePositions(prev => {
      const newPositions = [...prev];
      newPositions[dragState.nodeIndex] = { x: newX, y: newY };
      return newPositions;
    });
  }, [dragState.nodeIndex, dragState.offset]);

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setDragState({ nodeIndex: null, offset: [0, 0] });
  }, []);

  useEffect(() => {
    if (dragState.nodeIndex !== null) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [dragState.nodeIndex, onMouseMove, onMouseUp]);

  const getNodeClass = (nodeIndex) => {
    let classes = 'graph-node';
    
    if (processingNode === nodeIndex) {
      classes += ' graph-node-processing';
    } else if (discoveredNode === nodeIndex) {
      classes += ' graph-node-discovered';
    } else if (visited[nodeIndex]) {
      classes += ' graph-node-visited';
    }
    
    if (queue.includes(nodeIndex) || stack.includes(nodeIndex)) {
      classes += ' graph-node-queued';
    }
    return classes;
  };

  const renderGraph = () => {
    if (nodePositions.length === 0) return null;

    return (
      <svg 
        ref={svgRef}
        className="graph-svg" 
        viewBox="-100 0 500 400" 
        preserveAspectRatio="xMidYMid meet"
      >
        {graphData.map((row, i) =>
          row.map((connected, j) => {
            if (connected === 1 && i < j) {
              return (
                <line
                  key={`edge-${i}-${j}`}
                  x1={nodePositions[i].x}
                  y1={nodePositions[i].y}
                  x2={nodePositions[j].x}
                  y2={nodePositions[j].y}
                  className="graph-edge"
                />
              );
            }
            return null;
          })
        )}
        
        {nodePositions.map((pos, i) => (
          <g 
            key={`node-${i}`}
            onMouseDown={(e) => onMouseDown(e, i)}
            style={{ cursor: dragState.nodeIndex === i ? 'grabbing' : 'grab' }}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={25}
              className={getNodeClass(i)}
            />
            <text
              x={pos.x}
              y={pos.y}
              className="graph-node-text"
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents= "none"
            >
              {i}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="visual-module-display">
      <div className="graph-visualization-wrapper">
        <div className='graph-visualization-container'>
          <div className="graph-visualization-left">
            {renderGraph()}
          </div>
          <div className="graph-visualization-right">
            <div className="graph-info-section">
              <h3 className="graph-info-title">Algorithm State</h3>
              <div className="graph-info-item">
                <div className="graph-info-label">{dataStructureLabel}:</div>
                <div className="graph-info-value">
                  [{(dataStructureType === 'queue' ? queue : stack).length > 0 ? (dataStructureType === 'queue' ? queue : stack).join(', ') : 'empty'}]
                </div>
              </div>
              <div className="graph-info-item">
                <div className="graph-info-label">Visited Nodes:</div>
                <div className="graph-info-value">
                  [{visited.map((v, i) => v ? i : null).filter(v => v !== null).join(', ') || 'none'}]
                </div>
              </div>
              <div className="graph-info-item">
                <div className="graph-info-label">Processing:</div>
                <div className="graph-info-value graph-info-processing">
                  {processingNode !== null && processingNode !== undefined ? `Node ${processingNode}` : '-'}
                </div>
              </div>
              <div className="graph-info-item">
                <div className="graph-info-label">Discovered:</div>
                <div className="graph-info-value graph-info-discovered">
                  {discoveredNode !== null && discoveredNode !== undefined ? `Node ${discoveredNode}` : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="graph-legend">
          <div className="graph-legend-item">
            <span className="graph-legend-color graph-node-processing"></span> Processing
          </div>
          <div className="graph-legend-item">
            <span className="graph-legend-color graph-node-discovered"></span> Discovered
          </div>
          <div className="graph-legend-item">
            <span className="graph-legend-color graph-node-visited"></span> Visited
          </div>
          <div className="graph-legend-item">
            <span className="graph-legend-color graph-node-queued"></span> In {dataStructureLabel}
          </div>
        </div>
      </div>
    </div>
  );
});

export default GraphVisualization;

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';

const GraphVisualization = forwardRef(({ currentState, tracerData }, ref) => {
  const graphData = useMemo(() => currentState?.graph || [], [currentState?.graph]);
  const visited = currentState?.visited || [];
  const queue = currentState?.queue || [];
  const stack = currentState?.stack || [];
  const processingNode = currentState?.processing;
  const discoveredNode = currentState?.discovered;

  // Get data structure info from metadata
  const dataStructureType = tracerData?.metadata?.dataStructure || 'queue';
  const dataStructureLabel = tracerData?.metadata?.dataStructureLabel || 'Queue';

  const [nodePositions, updateNodePositions] = useState({});
  const [dragState, setDragState] = useState({ nodeId: null, offset: [0, 0] });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [graphState, resetGraphState] = useState(false);
  const [autoFit, setAutoFit] = useState(false);
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);

  const radius = 150;
  const centerX = 200; // Center of 400x400 viewBox
  const centerY = 200;

  const viewBox = useMemo(() => ({
    minX: 0,
    minY: 0,
    width: 400,
    height: 400
  }), []);

  // Function to calculate initial positions in a circle layout
  const calculateInitialPositions = useCallback((nodeCount) => {
    if (nodeCount === 0) return {};

    const positions = {};
    for (let i = 0; i < nodeCount; i++) {
      const angle = (i * 2 * Math.PI) / nodeCount - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positions[i] = { x, y };
    }
    return positions;
  }, []);

  // Initialize/update node positions
  useEffect(() => {
    const nodeCount = graphData.length;
    updateNodePositions((prev) => {
      if (graphState) {
        resetGraphState(false);
        return calculateInitialPositions(nodeCount);
      }

      const prevNodeIds = new Set(Object.keys(prev).map((id) => parseInt(id)));
      const newNodeIds = new Set(Array.from({ length: nodeCount }, (_, i) => i));
      const hasNewNodes = Array.from(newNodeIds).some((id) => !prevNodeIds.has(id));

      if (hasNewNodes || Object.keys(prev).length === 0) {
        if (hasNewNodes) {
          setAutoFit(true);
        }
        return calculateInitialPositions(nodeCount);
      }

      const cleaned = { ...prev };
      Object.keys(cleaned).forEach((nodeId) => {
        if (!newNodeIds.has(parseInt(nodeId))) {
          delete cleaned[nodeId];
        }
      });
      return cleaned;
    });
  }, [graphData.length, calculateInitialPositions, graphState]);

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

  const onMouseDown = (e, nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    
    const svgCoords = getSVGCoordinates(e);
    const nodePos = nodePositions[nodeId] || { x: 0, y: 0 };
    const offset = [
      (svgCoords.x - panOffset.x) / zoom - nodePos.x,
      (svgCoords.y - panOffset.y) / zoom - nodePos.y
    ];
    
    setDragState({ nodeId, offset });
  };

  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || dragState.nodeId === null) return;
    
    const svgCoords = getSVGCoordinates(e);
    let newX = (svgCoords.x - panOffset.x) / zoom - dragState.offset[0];
    let newY = (svgCoords.y - panOffset.y) / zoom - dragState.offset[1];
    
    // Constrain nodes within viewBox bounds (accounting for zoom and pan)
    const nodeRadius = 20 * zoom;
    const minBoundX = (viewBox.minX + nodeRadius - panOffset.x) / zoom;
    const maxBoundX = (viewBox.width - nodeRadius - panOffset.x) / zoom;
    const minBoundY = (viewBox.minY + nodeRadius - panOffset.y) / zoom;
    const maxBoundY = (viewBox.height - nodeRadius - panOffset.y) / zoom;
    
    newX = Math.max(minBoundX, Math.min(maxBoundX, newX));
    newY = Math.max(minBoundY, Math.min(maxBoundY, newY));
    
    updateNodePositions(prev => {
      const newPositions = { ...prev };
      newPositions[dragState.nodeId] = { x: newX, y: newY };
      return newPositions;
    });
  }, [viewBox, dragState.nodeId, dragState.offset, panOffset.x, panOffset.y, zoom]);

  const onMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    setDragState({ nodeId: null, offset: [0, 0] });
  }, []);

  useEffect(() => {
    if (dragState.nodeId !== null) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
    }
  }, [dragState.nodeId, onMouseMove, onMouseUp]);

  // Pan handlers
  const onPanStart = (e) => {
    if (e.target.classList.contains('graph-svg') || 
        e.target.classList.contains('graph-edge')) {
      isPanningRef.current = true;
      setIsPanning(true);
      const svgCoords = getSVGCoordinates(e);
      setPanStart({ 
        x: svgCoords.x - panOffset.x, 
        y: svgCoords.y - panOffset.y 
      });
    }
  };

  const onPanMove = useCallback((e) => {
    if (!isPanningRef.current) return;
    
    const svgCoords = getSVGCoordinates(e);
    setPanOffset({
      x: svgCoords.x - panStart.x,
      y: svgCoords.y - panStart.y
    });
  }, [panStart.x, panStart.y]);

  const onPanEnd = useCallback(() => {
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', onPanMove);
      window.addEventListener('mouseup', onPanEnd);
      return () => {
        window.removeEventListener('mousemove', onPanMove);
        window.removeEventListener('mouseup', onPanEnd);
      };
    }
  }, [isPanning, onPanMove, onPanEnd]);

  // Zoom handler with cursor-centered zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    // Get mouse position in SVG coordinates
    const svgCoords = getSVGCoordinates(e);
    const mouseX = svgCoords.x;
    const mouseY = svgCoords.y;
    
    // Calculate new zoom level
    const delta = e.deltaY * -0.003;
    const newZoom = Math.min(Math.max(0.5, zoom + delta), 1.5); // 0.5x - 1.5x
    
    if (newZoom === zoom) return;
    
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - panOffset.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - panOffset.y) * zoomRatio;
    
    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [zoom, panOffset.x, panOffset.y]);

  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
      return () => svg.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const fitToScreen = useCallback(() => {
    const nodeIds = Object.keys(nodePositions);
    if (nodeIds.length === 0) return;
    
    // Bounding box of all nodes
    const padding = 50;
    const nodeRadius = 20;
    
    const xs = nodeIds.map(id => nodePositions[id].x);
    const ys = nodeIds.map(id => nodePositions[id].y);
    
    const minX = Math.min(...xs) - nodeRadius - padding;
    const maxX = Math.max(...xs) + nodeRadius + padding;
    const minY = Math.min(...ys) - nodeRadius - padding;
    const maxY = Math.max(...ys) + nodeRadius + padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Calculate zoom to fit
    const scaleX = viewBox.width / contentWidth;
    const scaleY = viewBox.height / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 3); 
    
    // Center of content
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    // Pan to center the content
    const viewBoxCenterX = viewBox.width / 2;
    const viewBoxCenterY = viewBox.height / 2;
    
    const newPanX = viewBoxCenterX - contentCenterX * newZoom;
    const newPanY = viewBoxCenterY - contentCenterY * newZoom;
    
    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [nodePositions, viewBox.height, viewBox.width]);

  // Expose resetPositions to parent component
  useImperativeHandle(ref, () => ({
    resetPositions: () => {
      resetGraphState(true);
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
    },
    fit: () => {
      fitToScreen();
    }
  }), [fitToScreen]);

  useEffect(() => {
    if (!autoFit) return;
    fitToScreen();
    setAutoFit(false);
  }, [nodePositions, autoFit, fitToScreen]);

  const getNodeClass = (nodeId) => {
    let classes = 'graph-node';
    
    if (processingNode === nodeId) {
      classes += ' graph-node-processing';
    } else if (discoveredNode === nodeId) {
      classes += ' graph-node-discovered';
    } else if (visited[nodeId]) {
      classes += ' graph-node-visited';
    }
    
    if (queue.includes(nodeId) || stack.includes(nodeId)) {
      classes += ' graph-node-queued';
    }
    return classes;
  };

  const renderGraph = () => {
    const nodeIds = Object.keys(nodePositions).map(id => parseInt(id));
    if (nodeIds.length === 0) return null;

    return (
      <svg 
        ref={svgRef}
        className="graph-svg" 
        viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onPanStart}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
        {/* ViewBox border */}
        <rect 
          x="0" 
          y="0" 
          width={viewBox.width}
          height={viewBox.height} 
          fill="none" 
          stroke="#ccc" 
          strokeWidth="2"
          pointerEvents="none"
        />
        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
          {graphData.map((row, i) =>
          // graphData is an adjacency matrix, check for edges between nodes
            row.map((connected, j) => {
              // For undirected graphs, only render edge once (i < j)
              if (connected === 1 && i < j && nodePositions[i] && nodePositions[j]) {
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
          
          {nodeIds.map((nodeId) => {
            const pos = nodePositions[nodeId];
            return (
              <g 
                key={`node-${nodeId}`}
                onMouseDown={(e) => onMouseDown(e, nodeId)}
                style={{ cursor: dragState.nodeId === nodeId ? 'grabbing' : 'grab' }}
              >
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={20}
                  className={getNodeClass(nodeId)}
                />
                <text
                  x={pos.x}
                  y={pos.y}
                  className="graph-node-text"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  pointerEvents="none"
                >
                  {nodeId}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  };

  return (
    <div className="visual-module-display">
      <div className="graph-visualization-wrapper">
        <div className='graph-visualization-container'>
          <div className="graph-visualization-left" style={{ position: 'relative' }}>
            <button 
              onClick={fitToScreen}
              className='fit-to-screen-button'
              title="Fit graph to screen"
            >
              <i className="fas fa-expand"></i>
            </button>
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

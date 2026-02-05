import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';

const TreeVisualization = forwardRef(({ currentState, tracerData }, ref) => {

  const treeData = useMemo(() => currentState?.tree || [], [currentState?.tree]);
  const visited = currentState?.visited || [];
  const current = currentState?.current;

  // Get data structure info from metadata
  const dataStructureLabel = tracerData?.metadata?.dataStructureLabel || 'Tree';

  const [nodePositions, setNodePositions] = useState([]);
  const [dragState, setDragState] = useState({ nodeIndex: null, offset: [0, 0] });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);

  const viewBox = useMemo(() => ({
    minX: 0,
    minY: 0,
    width: 400,
    height: 400
  }), []);

  // Constants for layout
  const LEVEL_HEIGHT = 80;
  const MIN_HORIZONTAL_SPACING = 60;

  // Tree layout algorithm
  const calculateTreePositions = useCallback((nodes) => {
    if (!nodes || nodes.length === 0) return [];

    // Build children map for quick lookup
    const childrenMap = {};
    const nodeMap = {};
    nodes.forEach(node => {
      childrenMap[node.id] = node.children || [];
      nodeMap[node.id] = node;
    });

    // Find root node
    const allChildren = new Set(nodes.flatMap(n => n.children || []));
    const root = nodes.find(n => !allChildren.has(n.id));

    if (!root) {
      // Fallback: use first node if no clear root
      return nodes.map((_, i) => ({ x: viewBox.width / 2, y: 50 + i * 80 }));
    }


    const subtreeWidths = {};

    const calculateWidth = (nodeId) => {
      const children = childrenMap[nodeId] || [];
      if (children.length === 0) {
        subtreeWidths[nodeId] = 1; // Leaf node has width of 1
        return 1;
      }
      // Sum widths of all children
      const width = children.reduce((sum, childId) => 
        sum + calculateWidth(childId), 0
      );
      subtreeWidths[nodeId] = width;
      return width;
    };

    calculateWidth(root.id);

    // Step 2: Assign x,y positions recursively
    const positions = {};

    const assignPositions = (nodeId, level, leftBound) => {
      const width = subtreeWidths[nodeId];

      // Center node in its allocated space
      const x = leftBound + (width * MIN_HORIZONTAL_SPACING) / 2;
      const y = 50 + level * LEVEL_HEIGHT; // Start from top with padding

      positions[nodeId] = { x, y };

      // Position children left-to-right under this node
      const children = childrenMap[nodeId] || [];
      let currentLeft = leftBound;

      children.forEach(childId => {
        assignPositions(childId, level + 1, currentLeft);
        currentLeft += subtreeWidths[childId] * MIN_HORIZONTAL_SPACING;
      });
    };

    // Calculate total tree width to center it
    const totalWidth = subtreeWidths[root.id] * MIN_HORIZONTAL_SPACING;
    const startX = (viewBox.width - totalWidth) / 2;

    assignPositions(root.id, 0, startX);

    // Map positions back to nodes array order
    return nodes.map(node => positions[node.id] || { x: viewBox.width / 2, y: 50 });
  }, [viewBox.width]);

  // Expose resetPositions to parent component
  useImperativeHandle(ref, () => ({
    resetPositions: () => {
      setNodePositions(calculateTreePositions(treeData));
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
    }
  }));

  // Initialize node positions when tree data changes
  useEffect(() => {
    if (treeData.length > 0) {
      setNodePositions(calculateTreePositions(treeData));
    }
  }, [treeData, treeData.length, calculateTreePositions]);

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
    e.stopPropagation();
    isDraggingRef.current = true;
    
    const svgCoords = getSVGCoordinates(e);
    const offset = [
      (svgCoords.x - panOffset.x) / zoom - nodePositions[nodeIndex].x,
      (svgCoords.y - panOffset.y) / zoom - nodePositions[nodeIndex].y
    ];
    
    setDragState({ nodeIndex, offset });
  };

  const onMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || dragState.nodeIndex === null) return;
    
    const svgCoords = getSVGCoordinates(e);
    let newX = (svgCoords.x - panOffset.x) / zoom - dragState.offset[0];
    let newY = (svgCoords.y - panOffset.y) / zoom - dragState.offset[1];
    
    // Constrain nodes within viewBox bounds
    const nodeRadius = 20 * zoom;
    const minBoundX = (viewBox.minX + nodeRadius - panOffset.x) / zoom;
    const maxBoundX = (viewBox.width - nodeRadius - panOffset.x) / zoom;
    const minBoundY = (viewBox.minY + nodeRadius - panOffset.y) / zoom;
    const maxBoundY = (viewBox.height - nodeRadius - panOffset.y) / zoom;
    
    newX = Math.max(minBoundX, Math.min(maxBoundX, newX));
    newY = Math.max(minBoundY, Math.min(maxBoundY, newY));
    
    setNodePositions(prev => {
      const newPositions = [...prev];
      newPositions[dragState.nodeIndex] = { x: newX, y: newY };
      return newPositions;
    });
  }, [viewBox, dragState.nodeIndex, dragState.offset, panOffset.x, panOffset.y, zoom]);

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

  // Pan handlers
  const onPanStart = (e) => {
    if (e.target.classList.contains('tree-svg') || 
        e.target.classList.contains('tree-edge')) {
      isPanningRef.current = true;
      setIsPanning(true);
      const svgCoords = getSVGCoordinates(e);
      setPanStart({ x: svgCoords.x - panOffset.x, y: svgCoords.y - panOffset.y });
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

  // Zoom handler
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    
    const svgCoords = getSVGCoordinates(e);
    const mouseX = svgCoords.x;
    const mouseY = svgCoords.y;
    
    const delta = e.deltaY * -0.003;
    const newZoom = Math.min(Math.max(0.5, zoom + delta), 2);
    
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

  const fitToScreen = () => {
    if (nodePositions.length === 0) return;
    
    const padding = 50;
    const nodeRadius = 20;
    
    const xs = nodePositions.map(pos => pos.x);
    const ys = nodePositions.map(pos => pos.y);
    
    const minX = Math.min(...xs) - nodeRadius - padding;
    const maxX = Math.max(...xs) + nodeRadius + padding;
    const minY = Math.min(...ys) - nodeRadius - padding;
    const maxY = Math.max(...ys) + nodeRadius + padding;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    const scaleX = viewBox.width / contentWidth;
    const scaleY = viewBox.height / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 2);
    
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    
    const viewBoxCenterX = viewBox.width / 2;
    const viewBoxCenterY = viewBox.height / 2;
    
    const newPanX = viewBoxCenterX - contentCenterX * newZoom;
    const newPanY = viewBoxCenterY - contentCenterY * newZoom;
    
    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const getNodeClass = (node) => {
    let classes = 'tree-node';
    
    if (current === node.id) {
      classes += ' tree-node-current';
    } else if (visited.includes(node.id)) {
      classes += ' tree-node-visited';
    }
    
    return classes;
  };

  const getNodeValueById = (nodeId) => {
    const node = treeData.find(n => n.id === nodeId);
    return node ? (node.value !== undefined ? node.value : node.id) : '-';
  };

  const renderTree = () => {
    if (nodePositions.length === 0 || treeData.length === 0) return null;

    try {
      // Build id to index map for quick lookup
      const idToIndex = {};
      treeData.forEach((node, index) => {
        idToIndex[node.id] = index;
      });

      // Render edges (parent to children)
      const edges = [];
      treeData.forEach((node, parentIndex) => {
        const children = node.children || [];
        children.forEach(childId => {
          const childIndex = idToIndex[childId];
          if (childIndex !== undefined && nodePositions[parentIndex] && nodePositions[childIndex]) {
            edges.push(
              <line
                key={`edge-${node.id}-${childId}`}
                x1={nodePositions[parentIndex].x}
                y1={nodePositions[parentIndex].y}
                x2={nodePositions[childIndex].x}
                y2={nodePositions[childIndex].y}
                className="tree-edge"
              />
            );
          }
        });
      });

      return (
        <svg 
          ref={svgRef}
          className="tree-svg" 
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={onPanStart}
          style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
        >
          <rect 
            x="0" 
            y="0" 
          width={viewBox.width}
          height={viewBox.height} 
          fill="none" 
          stroke="#ccc" 
          strokeWidth="1"
          pointerEvents="none"
        />
        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
          {/* Draw edges first (behind nodes) */}
          {edges}
          
          {/* Draw nodes */}
          {treeData.map((node, i) => {
            if (!nodePositions[i]) return null; // Skip if position not calculated yet
            return (
            <g 
              key={`node-${node.id}`}
              onMouseDown={(e) => onMouseDown(e, i)}
              style={{ cursor: dragState.nodeIndex === i ? 'grabbing' : 'grab' }}
            >
              <circle
                cx={nodePositions[i].x}
                cy={nodePositions[i].y}
                r={20}
                className={getNodeClass(node)}
              />
              <text
                x={nodePositions[i].x}
                y={nodePositions[i].y}
                className="tree-node-text"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {node.value !== undefined ? node.value : node.id}
              </text>
            </g>
            );
          })}
        </g>
      </svg>
      );
    } catch (error) {
      console.error('Error rendering tree:', error);
      return <div style={{ color: 'red', padding: '1rem' }}>Error rendering tree: {error.message}</div>;
    }
  };

  return (
    <div className="visual-module-display">
      <div className="tree-visualization-wrapper">
        <div className='tree-visualization-container'>
          <div className="tree-visualization-left" style={{ position: 'relative' }}>
            <button 
              onClick={fitToScreen}
              className='fit-to-screen-button'
              title="Fit tree to screen"
            >
              <i className="fas fa-expand"></i>
            </button>
            {renderTree()}
          </div>
          <div className="tree-visualization-right">
            <div className="tree-info-section">
              <h3 className="tree-info-title">Algorithm State</h3>
              <div className="tree-info-item">
                <div className="tree-info-label">Tree Type:</div>
                <div className="tree-info-value">{dataStructureLabel}</div>
              </div>
              <div className="tree-info-item">
                <div className="tree-info-label">Total Nodes:</div>
                <div className="tree-info-value">{treeData.length}</div>
              </div>
              <div className="tree-info-item">
                <div className="tree-info-label">Visited Nodes:</div>
                <div className="tree-info-value">
                  [{visited && visited.length > 0 ? visited.map(getNodeValueById).join(', ') : 'none'}]
                </div>
              </div>
              <div className="tree-info-item">
                <div className="tree-info-label">Current Node:</div>
                <div className="tree-info-value tree-info-current">
                  {current !== null && current !== undefined ? getNodeValueById(current) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="tree-legend">
          <div className="tree-legend-item">
            <span className="tree-legend-color tree-node-current"></span> Current
          </div>
          <div className="tree-legend-item">
            <span className="tree-legend-color tree-node-visited"></span> Visited
          </div>
        </div>
      </div>
    </div>
  );
});

export default TreeVisualization;

import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback, useMemo } from 'react';

const TreeVisualization = forwardRef(({ currentState }, ref) => {

  const treeData = useMemo(() => currentState?.tree || [], [currentState?.tree]);
  const visited = currentState?.visited || [];
  const current = currentState?.current || null;
  const depth = currentState.current !== null && currentState.current !== undefined ? currentState?.depth : null;
  const message = currentState?.message || '';

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
  const previousStructureSignatureRef = useRef('');

  console.log('Current State:', currentState);
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
    if (!nodes || nodes.length === 0) return {};

    // Build children map
    const childrenMap = {};
    const nodeMap = {};
    nodes.forEach(node => {
      childrenMap[node.id] = (node.children).filter(id => id !== null && id !== undefined);
      nodeMap[node.id] = node;
    });

    // Find root node
    const allChildren = new Set(
      nodes.flatMap(n => (n.children).filter(id => id !== null && id !== undefined))
    );
    const root = nodes.find(n => !allChildren.has(n.id));

    if (!root) {
      // use first node if no clear root
      const result = {};
      nodes.forEach((node, i) => {
        result[node.id] = { x: viewBox.width / 2, y: 50 + i * 80 };
      });
      return result;
    }


    const subtreeWidths = {};

    const calculateWidth = (nodeId) => {
      const children = childrenMap[nodeId];
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

    // Assign x,y positions recursively
    const positions = {};

    const assignPositions = (nodeId, level, leftBound) => {
      const width = subtreeWidths[nodeId];

      // center node in its allocated space
      const x = leftBound + (width * MIN_HORIZONTAL_SPACING) / 2;
      const y = 50 + level * LEVEL_HEIGHT;

      positions[nodeId] = { x, y };

      // Position children left-to-right under this node
      const children = childrenMap[nodeId];
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

    // Return positions by node ID
    // id: { x: number, y: number }
    return positions;
  }, [viewBox.width]);

  const treeStructure = useMemo(() => {
    return treeData.map(node => ({ 
        id: node.id, 
        children: (node.children).filter(childId => childId !== null && childId !== undefined)
      }))
  }, [treeData]);

  const treeStructureSignature = useMemo(() => {
    // Copy the tree structure and sort it to create a consistent signature string
    const normalized = [...treeStructure]
      .sort((a, b) => a.id - b.id)
      .map(node => {
        const children = [...node.children].sort((a, b) => a - b);
        return `${node.id}:${children.join(',')}`;
      });
    return normalized.join('|');
    // Output is a string like "1:2,3|2:4|3:5,6|4:|5:|6:" representing the tree structure
  }, [treeStructure]);

  useEffect(() => {
    updateNodePositions(prev => {
      if (graphState) {
        resetGraphState(false);
        previousStructureSignatureRef.current = treeStructureSignature;
        setAutoFit(true);

        return calculateTreePositions(treeStructure);
      }

      // Check if the structure of the tree changed
      const structureChanged = previousStructureSignatureRef.current !== treeStructureSignature;
      previousStructureSignatureRef.current = treeStructureSignature;

      const prevNodeIds = new Set(Object.keys(prev).map(id => parseInt(id)));
      const newNodeIds = new Set(treeStructure.map(n => n.id));
      
      // Check if any nodes were added
      const hasNewNodes = Array.from(newNodeIds).some(id => !prevNodeIds.has(id));
      
      if (hasNewNodes || structureChanged || Object.keys(prev).length === 0) {
        if (hasNewNodes) {
          setAutoFit(true);
        }
        // Structure changed/new nodes/first render - recalculate positions
        setAutoFit(true);
        return calculateTreePositions(treeStructure);
      } else {
        // Keep existing positions, just remove deleted nodes
        const cleaned = { ...prev };
        Object.keys(cleaned).forEach(nodeId => {
          if (!newNodeIds.has(parseInt(nodeId))) {
            delete cleaned[nodeId];
          }
        });
        return cleaned;
      }
    });
  }, [treeStructure, treeStructureSignature, calculateTreePositions, graphState]);

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
    
    // Constrain nodes within viewBox bounds
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

  const fitToScreen = useCallback(() => {
    const positions = Object.values(nodePositions);
    if (positions.length === 0) return;
    
    const padding = 50;
    const nodeRadius = 20;
    
    const xs = positions.map(pos => pos.x);
    const ys = positions.map(pos => pos.y);
    
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
  }, [nodePositions, viewBox.height, viewBox.width]);

  // Expose resetPositions to parent component
  useImperativeHandle(ref, () => ({
    resetPositions: () => {
      resetGraphState(true);
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

  const getNodeClass = (node) => {
    let classes = 'tree-node';
    
    const isVisited = visited.includes(node.id);
    const isCurrent = current === node.id;
    
    if (isCurrent && isVisited) {
      classes += ' tree-node-current tree-node-visited';
    } else if (isCurrent) {
      classes += ' tree-node-current';
    } else if (isVisited) {
      classes += ' tree-node-visited';
    }
    
    return classes;
  };

  const getNodeValueById = (nodeId) => {
    const node = treeData.find(n => n.id === nodeId);
    return node ? (node.value !== undefined ? node.value : node.id) : null;
  };

  // Build a list of visited node values for display
  const buildVisitedList = () => {
    if (!visited || visited.length === 0) return [];
    
    // Remove duplicates and filter out deleted nodes
    const uniqueVisited = [...new Set(visited)];
    return uniqueVisited
      .map(nodeId => getNodeValueById(nodeId))
      .filter(value => value !== null);
  };

  const renderTree = () => {
    if (Object.keys(nodePositions).length === 0 || treeData.length === 0) return null;

    try {
      // Render edges (parent to children)
      const edges = [];
      treeData.forEach((node) => {
        const children = node.children;
        children.forEach(childId => {
          if (childId && nodePositions[node.id] && nodePositions[childId]) {
            // Draw edge from node to child
            edges.push(
              <line
                key={`edge-${node.id}-${childId}`}
                x1={nodePositions[node.id].x}
                y1={nodePositions[node.id].y}
                x2={nodePositions[childId].x}
                y2={nodePositions[childId].y}
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
          pointerEvents="none"
        />
        <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
          {/* Draw edges first*/}
          {edges}
          
          {/* Draw nodes */}
          {treeData.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null; // Skip if position not calculated yet
            return (
            <g 
              key={`node-${node.id}`}
              onMouseDown={(e) => onMouseDown(e, node.id)}
              style={{ cursor: dragState.nodeId === node.id ? 'grabbing' : 'grab' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={20}
                className={getNodeClass(node)}
              />
              <text
                x={pos.x}
                y={pos.y}
                className="tree-node-text"
                textAnchor="middle"
                // Align text vertically centered
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
            {renderTree()}
          </div>
          <div className="tree-visualization-right">
            <div className="tree-info-section">
              {/* <h3 className="tree-info-title">Algorithm State</h3> */}
              {/* <div className="tree-info-item">
                <div className="tree-info-label">Tree Type:</div>
                <div className="tree-info-value">{dataStructureLabel}</div>
              </div> */}
              <div className="tree-info-item">
                <div className="tree-info-label">Total Nodes:</div>
                <div className="tree-info-value">{treeData.length}</div>
              </div>
              <div className="tree-info-item">
                <div className="tree-info-label">Current Node:</div>
                <div className="tree-info-value tree-info-current">
                  {current !== null && current !== undefined ? getNodeValueById(current) : '-'}
                </div>
              </div>
              {/* {message && ( */}
              <div className="tree-info-item">
                <div className="tree-info-label">Status:</div>
                <div className="tree-info-value message" style={{ fontStyle: 'italic', color: '#ffa500' }}>
                  {message || '-'}
                </div>
              </div>
              {/* )} */}
              <div className="tree-info-item">
                <div className="tree-info-label">Depth:</div>
                <div className="tree-info-value">{depth !== null && depth !== undefined ? depth : '-'}</div>
              </div>
              <div className="tree-info-item">
                <div className="tree-info-label">Visited Nodes:</div>
                <div className="tree-info-value tree-info-visited">
                  [{buildVisitedList().length > 0 ? buildVisitedList().join(', ') : 'none'}]
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

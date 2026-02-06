import React, { useMemo, useEffect, useRef } from 'react';

const SortingVisualization = ({ currentState }) => {
  const arrayData = useMemo(() => currentState?.data || [], [currentState]);
  const comparing = useMemo(() => currentState?.comparing || [], [currentState]);
  const swapped = useMemo(() => currentState?.swapped || [], [currentState]);
  const inserted = useMemo(() => currentState?.inserted || [], [currentState]);
  const selected = useMemo(() => currentState?.selected || [], [currentState]);
  const variables = useMemo(() => currentState?.variables || {}, [currentState]);
  const pivot = useMemo(() => currentState?.pivot, [currentState]);
  
  // Convert arrays to Sets for O(1)
  const comparingSet = useMemo(() => new Set(comparing), [comparing]);
  const swappedSet = useMemo(() => new Set(swapped), [swapped]);
  const insertedSet = useMemo(() => new Set(inserted), [inserted]);

  const canvasRef = useRef(null);
  const THRESHOLD = 30; // Switch to canvas for arrays larger than this
  const useCanvas = arrayData.length > THRESHOLD;

  // Canvas rendering for large arrays
  useEffect(() => {
    if (!useCanvas || !canvasRef.current || arrayData.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate dimensions
    const padding = 20;
    const barWidth = Math.max(2, (width - padding * 2) / arrayData.length);
    const maxValue = Math.max(...arrayData);
    const minValue = Math.min(...arrayData);
    const valueRange = maxValue - minValue || 1;

    // Draw bars
    arrayData.forEach((value, index) => {
      const barHeight = ((value - minValue) / valueRange) * (height - padding * 2);
      const x = padding + index * barWidth;
      const y = height - padding - barHeight;

      // Determine bar color based on state (using Sets for O(1) lookup)
      let color = '#4a90e2'; // Default blue
      
      if (swappedSet.has(index)) {
        color = '#27ae60'; // Green for swapped
      } else if (insertedSet.has(index)) {
        color = '#27ae60'; // Green for inserted
      } else if (comparingSet.has(index)) {
        color = '#f39c12'; // Orange for comparing
      }

      // Draw bar
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw legend
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const legendY = 15;
    
    ctx.fillStyle = '#4a90e2';
    ctx.fillRect(10, legendY - 8, 12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Default', 25, legendY);
    
    ctx.fillStyle = '#f39c12';
    ctx.fillRect(90, legendY - 8, 12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Comparing', 105, legendY);
    
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(190, legendY - 8, 12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Swapped/Inserted', 205, legendY);
  }, [arrayData, comparingSet, swappedSet, insertedSet, useCanvas]);

  const getBlockClass = (index) => {
    let classes = 'visual-module-block';
    // Priority: comparing (temp) > swapped > selected (persistent) > inserted > default
    if (pivot === index) {
      classes += ' visual-module-block-pivot';
    } else if(comparing.includes(index)) {
      classes += ' visual-module-block-comparing';
    } else if (swapped.includes(index)) {
      classes += ' visual-module-block-swapped';
    } else if (selected.includes(index)) {
      classes += ' visual-module-block-selected';
    } else if (inserted.includes(index)) {
      classes += ' visual-module-block-inserted';
    }
    return classes;
  };

  // Calculate array statistics for large arrays
  const arrayStats = useMemo(() => {
    if (arrayData.length === 0) return null;
    const min = Math.min(...arrayData);
    const max = Math.max(...arrayData);
    return { min, max, size: arrayData.length };
  }, [arrayData]);

  return (
    <>
      <div className="visual-module-display">
        {useCanvas ? (
          <div style={{ width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              style={{ 
                maxWidth: '100%',
                height: 'auto',
                padding: '10px'
              }}
            />
          </div>
        ) : (
          <div className="visual-module-blocks">
            {arrayData.map((value, index) => {
              // Get all variables pointing to this index
              const variablesAtIndex = Object.entries(variables)
                .filter(([, val]) => val === index)
                .map(([varName, val]) => `${varName}=${val}`);
              
              const indexDisplay = variablesAtIndex.length > 0 
                ? variablesAtIndex.join(', ')
                : '';
              
              return (
                <div key={index} className={getBlockClass(index)}>
                  <div className="visual-module-block-value">{value}</div>
                  {indexDisplay && <div className="visual-module-block-index">{indexDisplay}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="visual-module-array-display">
        {useCanvas && arrayData.length > 50 ? (
          <>
            <div className="visual-module-array-label">Array Statistics:</div>
            <div className="visual-module-array-content">
              Size: {arrayStats?.size} | Min: {arrayStats?.min} | Max: {arrayStats?.max}
            </div>
          </>
        ) : (
          <>
            <div className="visual-module-array-label">Current Array:</div>
            <div className="visual-module-array-content">
              [{arrayData.join(', ')}]
            </div>
          </>
        )}
        
        {/* Always show variables */}
        {Object.keys(variables).length > 0 && (
          <>
            <div className="visual-module-array-label" style={{ marginTop: '12px' }}>Variables:</div>
            <div className="visual-module-array-content">
              {Object.entries(variables).map(([key, val]) => `${key} = ${val}`).join(', ')}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SortingVisualization;

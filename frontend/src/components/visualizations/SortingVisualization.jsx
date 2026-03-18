import React, { useMemo } from 'react';

const SortingVisualization = ({ currentState }) => {
  const arrayData = useMemo(() => currentState?.data || [], [currentState]);
  const comparing = useMemo(() => currentState?.comparing || [], [currentState]);
  const swapped = useMemo(() => currentState?.swapped || [], [currentState]);
  const inserted = useMemo(() => currentState?.inserted || [], [currentState]);
  const selected = useMemo(() => currentState?.selected || [], [currentState]);
  const variables = useMemo(() => currentState?.variables || {}, [currentState]);
  const indexVars = useMemo(() => currentState?.indexVars || null, [currentState]);
  const pivot = useMemo(() => currentState?.pivot, [currentState]);
  const range = useMemo(() => currentState?.range || null, [currentState]);

  // Bucket support
  const buckets = useMemo(() => currentState?.buckets || null, [currentState]);
  
  // Convert arrays to Sets for O(1)
  const comparingSet = useMemo(() => new Set(comparing), [comparing]);
  const swappedSet = useMemo(() => new Set(swapped), [swapped]);
  const insertedSet = useMemo(() => new Set(inserted), [inserted]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const getBlockClass = (index) => {
    let classes = 'visual-module-block';

    // Dim blocks outside the active partition range
    if (range && (index < range[0] || index > range[1])) {
      classes += ' visual-module-block-dimmed';
    }

    // Action highlights are mutually exclusive (background color)
    if (comparingSet.has(index)) {
      classes += ' visual-module-block-comparing';
    } else if (swappedSet.has(index)) {
      classes += ' visual-module-block-swapped';
    } else if (selectedSet.has(index)) {
      classes += ' visual-module-block-selected';
    } else if (insertedSet.has(index)) {
      classes += ' visual-module-block-inserted';
    }

    return classes;
  };

  return (
    <>
      <div className="visual-module-display">
        {buckets ? (
          <div className="visual-module-dual-container">
            {/* Array row */}
            <div className="visual-module-dual-section">
              <div className="visual-module-dual-label">Array</div>
              <div className="visual-module-blocks">
                {arrayData.map((value, index) => {
                  const isEmpty = value === null || value === undefined;
                  const variablesAtIndex = Object.entries(variables)
                    .filter(([key, val]) => val === index && (!indexVars || indexVars.includes(key)))
                    .map(([varName, val]) => `${varName}=${val}`);
                  const indexDisplay = variablesAtIndex.length > 0
                    ? variablesAtIndex.join(', ') : '';
                  return (
                    <div key={index} className={`${getBlockClass(index)}${isEmpty ? ' visual-module-block-dimmed' : ''}`}>
                      {range && index === range[0] && <div className="visual-module-block-range-label visual-module-block-low-label">Low</div>}
                      {range && index === range[1] && <div className="visual-module-block-range-label visual-module-block-high-label">High</div>}
                      <div className="visual-module-block-value">{isEmpty ? '·' : value}</div>
                      {indexDisplay && <div className="visual-module-block-index">{indexDisplay}</div>}
                      {pivot === index && <div className="visual-module-block-pivot-label">Pivot</div>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buckets row */}
            <div className="visual-module-dual-section">
              <div className="visual-module-dual-label">Buckets (by digit)</div>
              <div className="visual-module-buckets-row">
                {buckets.map((bucket, digit) => (
                  <div key={digit} className="visual-module-bucket">
                    <div className="visual-module-bucket-label">{digit}</div>
                    <div className="visual-module-bucket-items">
                      {bucket.length === 0 ? (
                        <div className="visual-module-bucket-empty">—</div>
                      ) : (
                        bucket.map((val, i) => (
                          <div key={i} className={`visual-module-bucket-item`}>
                            {val}
                          </div>
                        ))
                      )}
                    </div>
                    {bucket.length > 1 && (
                      <div className="visual-module-bucket-count">{bucket.length} items</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="visual-module-blocks">
            {arrayData.map((value, index) => {
              // Get all variables pointing to this index
              const variablesAtIndex = Object.entries(variables)
                .filter(([key, val]) => val === index && (!indexVars || indexVars.includes(key)))
                .map(([varName, val]) => `${varName}=${val}`);
              
              const indexDisplay = variablesAtIndex.length > 0 
                ? variablesAtIndex.join(', ')
                : '';
              
              return (
                <div key={index} className={getBlockClass(index)}>
                  {range && index === range[0] && <div className="visual-module-block-range-label visual-module-block-low-label">Low</div>}
                  {range && index === range[1] && <div className="visual-module-block-range-label visual-module-block-high-label">High</div>}
                  <div className="visual-module-block-value">{value}</div>
                  {indexDisplay && <div className="visual-module-block-index">{indexDisplay}</div>}
                  {pivot === index && <div className="visual-module-block-pivot-label">Pivot</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="visual-module-array-display">
        <div className="visual-module-array-label">Current Array:</div>
        <div className="visual-module-array-content">
          [{arrayData.join(', ')}]
        </div>
        
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

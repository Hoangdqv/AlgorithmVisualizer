import React from 'react';

const SortingVisualization = ({ currentState }) => {
  const arrayData = currentState?.data || [];
  const comparing = currentState?.comparing || [];
  const swapped = currentState?.swapped || [];

  const getBlockClass = (index) => {
    let classes = 'visual-module-block';
    if (comparing.includes(index)) {
      classes += ' visual-module-block-comparing';
    } else if (swapped.includes(index)) {
      classes += ' visual-module-block-swapped';
    }
    return classes;
  };

  return (
    <>
      <div className="visual-module-display">
        <div className="visual-module-blocks">
          {arrayData.map((value, index) => (
            <div key={index} className={getBlockClass(index)}>
              <div className="visual-module-block-value">{value}</div>
              <div className="visual-module-block-index">[{index}]</div>
            </div>
          ))}
        </div>
      </div>

      <div className="visual-module-array-display">
        <div className="visual-module-array-label">Current Array:</div>
        <div className="visual-module-array-content">
          [{arrayData.join(', ')}]
        </div>
      </div>
    </>
  );
};

export default SortingVisualization;

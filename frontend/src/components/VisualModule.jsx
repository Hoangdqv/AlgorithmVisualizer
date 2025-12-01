import React, { useState, useEffect, useRef } from 'react';
import SortingVisualization from './visualizations/SortingVisualization';
import GraphVisualization from './visualizations/GraphVisualization';

const VisualModule = ({ tracerData, isRunning, selectedLanguage }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.5x to 5x
  const graphVisualizationRef = useRef(null);

  const [displayData, setDisplayData] = useState(tracerData);
  const displayStates = displayData?.states || [];
  const displayTotalSteps = displayStates.length;
  
  // Convert speed multiplier
  const playSpeed = 1000 / speedMultiplier;

  useEffect(() => {
    // Reset visualization when language changes
    setDisplayData(null);
    setCurrentStep(0);
    setIsPlaying(false);
  }, [selectedLanguage]);

  useEffect(() => {
      if (tracerData && tracerData.states && tracerData.states.length > 0) {
        setDisplayData(tracerData);
        setCurrentStep(0);
        setIsPlaying(false);
      }
  }, [tracerData]);

  useEffect(() => {
    let interval;
    if (isPlaying && currentStep < displayTotalSteps - 1) {
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= displayTotalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, playSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, displayTotalSteps, playSpeed]);

  const handleNext = () => {
    if (currentStep < displayTotalSteps - 1) {
      setCurrentStep(currentStep + 1);
      setIsPlaying(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    // Reset graph node positions if necessary
    if (graphVisualizationRef.current) {
      graphVisualizationRef.current.resetPositions();
    }
  };

  const togglePlay = () => {
    if (currentStep >= displayTotalSteps - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  if (isRunning) {
    return (
      <div className="visual-module-empty">
        Code is running...
      </div>
    );
  }

  if (!displayData || displayStates.length === 0) {
    return (
      <div className="visual-module-empty">
        Run code to see visualization
      </div>
    );
  }

  const currentState = displayStates[currentStep];
  const category = currentState?.category || 'sorting';

  const renderVisualization = () => {
    if (category === 'graphs') {
      return <GraphVisualization ref={graphVisualizationRef} currentState={currentState} />;
    } else if (category === 'sorting') {
      return <SortingVisualization currentState={currentState} />;
    }
    // Default
    return <SortingVisualization currentState={currentState} />;
  };

  return (
    <div className="visual-module-container">
      {/* Header */}
      <div className="visual-module-header">
        <div className="visual-module-header-top">
          <div className="visual-module-title-section">
            <h2 className="visual-module-title">Algorithm Visualization</h2>
            {/* Playback Controls */}
            <div className="visual-module-controls-section">
                <div className="visual-module-controls">
                <button
                    onClick={handleReset}
                    className="visual-module-button"
                >
                    ⟲ Reset
                </button>
                <button
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="visual-module-button"
                >
                    ← Prev
                </button>
                <button
                    onClick={togglePlay}
                    className="visual-module-button visual-module-button-primary"
                >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>
                <button
                    onClick={handleNext}
                    disabled={currentStep === displayTotalSteps - 1}
                    className="visual-module-button"
                >
                    Next →
                </button>
                </div>
            {/* Speed Control */}
                <div className="visual-module-speed-control">
                    <label className="visual-module-speed-label">Speed:</label>
                    <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.25"
                    value={speedMultiplier}
                    onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                    className="visual-module-speed-slider"
                    />
                    <span className="visual-module-speed-value">
                    {speedMultiplier.toFixed(2)}x
                    </span>
                </div>
            </div>
          </div>   
        </div>
        
        {/* Progress Bar */}
        <p className="visual-module-step-info">
          Step {currentStep + 1} of {displayTotalSteps}
        </p>
        <div className="visual-module-progress">
          <div className="visual-module-progress-bar">
            <div
              className="visual-module-progress-fill"
              style={{ width: `${((currentStep + 1) / displayTotalSteps) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Visualization on Category */}
      {renderVisualization()}
    </div>
  );
};

export default VisualModule;

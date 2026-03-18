import { useState, useEffect, useRef } from 'react';
import SortingVisualization from './visualizations/SortingVisualization';
import GraphVisualization from './visualizations/GraphVisualization';
import TreeVisualization from './visualizations/TreeVisualization';

const VisualModule = ({ tracerData, isRunning, currentLanguage }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.5x to 2x
  const graphVisualizationRef = useRef(null);

  const [displayData, setDisplayData] = useState(tracerData);
  console.log('Current displayData:', displayData);
  const displayStates = displayData?.states || [];
  const displayTotalSteps = displayStates.length;
  
  // Calculate play speed based on total steps
  let baseDuration = 10000; // Default 10s
  if (displayTotalSteps > 5000) baseDuration = 25000;      // Very large: 25s
  else if (displayTotalSteps > 1000) baseDuration = 20000; // Large: 20s
  else if (displayTotalSteps > 500) baseDuration = 15000;  // Medium: 15s
  
  const playSpeed = displayTotalSteps > 100 
    ? (baseDuration / displayTotalSteps) / speedMultiplier // Scale duration by steps, adjusted by multiplier
    : 1000 / speedMultiplier;

  useEffect(() => {
    // Reset visualization when language changes
    setDisplayData(null);
    setCurrentStep(0);
    setIsPlaying(false);
  }, [currentLanguage]);

  useEffect(() => {
      if (tracerData && tracerData.states && tracerData.states.length > 0) {
        setDisplayData(tracerData);
        setCurrentStep(0);
        setIsPlaying(false);
      } else if (!tracerData || (tracerData && (!tracerData.states || tracerData.states.length === 0))) {
        // Clear display data when tracerData is empty/null
        setDisplayData(null);
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



  const handleNextManual = () => {
    if (currentStep < displayTotalSteps - 1) {
      setCurrentStep(currentStep + 1);
      setIsPlaying(false);
    }
  };

  const handlePrevManual = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    // Reset graph node positions
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

  const handleStepJump = (stepIndex) => {
    setCurrentStep(stepIndex);
    setIsPlaying(false);
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
      return <GraphVisualization ref={graphVisualizationRef} currentState={currentState} tracerData={displayData} />;
    } else if (category === 'sorting') {
      return <SortingVisualization currentState={currentState} />;
    } else if (category === 'trees') {
      return <TreeVisualization ref={graphVisualizationRef} currentState={currentState} />;
    }
  };

  return (
    <div className="visual-module-container">
      <div className="visual-module-header">
        <div className="visual-module-header-top">
          <div className="visual-module-title-section">
            <h2 className="visual-module-title">Algorithm Visualization</h2>
            <div className="visual-module-controls-section">
                <div className="visual-module-controls">
                <button
                    onClick={handleReset}
                    className="visual-module-button"
                >
                    ⟲ Reset
                </button>
                <button
                    onClick={handlePrevManual}
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
                    onClick={handleNextManual}
                    disabled={currentStep === displayTotalSteps - 1}
                    className="visual-module-button"
                >
                    Next →
                </button>
                </div>
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
                      style={{
                        background: `linear-gradient(to right, #4167ff 0%, #4167ff ${((speedMultiplier - 0.5) / (2 - 0.5)) * 100}%, #3a3a3a ${((speedMultiplier - 0.5) / (2 - 0.5)) * 100}%, #3a3a3a 100%)`
                      }}
                    />
                    <span className="visual-module-speed-value">
                    {speedMultiplier.toFixed(2)}x
                    </span>
                </div>
            </div>
          </div>   
        </div>
        
        <p className="visual-module-step-info">
          Step {currentStep + 1} of {displayTotalSteps}
        </p>
        <div className="visual-module-progress">
          <div className="visual-module-progress-container">
            {/* Slider input */}
            <input
              type="range"
              min="0"
              max={displayTotalSteps - 1}
              value={currentStep}
              onChange={(e) => handleStepJump(Number(e.target.value))}
              className="visual-module-progress-slider"
              style={{
                background: `linear-gradient(to right, #4167ff 0%, #4167ff ${(currentStep / (displayTotalSteps - 1)) * 100}%, #3a3a3a ${(currentStep / (displayTotalSteps - 1)) * 100}%, #3a3a3a 100%)`
              }}
            />
          </div>
        </div>
      </div>

      {/* Visualization on Category */}
      {renderVisualization()}
    </div>
  );
};

export default VisualModule;

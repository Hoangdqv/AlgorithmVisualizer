import { useState, useEffect, useRef } from 'react';
import SortingVisualization from './visualizations/SortingVisualization';
import GraphVisualization from './visualizations/GraphVisualization';
import TreeVisualization from './visualizations/TreeVisualization';
import {
  captureVisualizationFrame,
  saveVisualizationCapture,
  waitForCaptureStability,
} from '../script_utils/visualCapture';

const VisualModule = ({ tracerData, isRunning, currentLanguage, suppressRunningOverlay = false, onSaveVisualizationCapture }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.5x to 2x
  const [isCapturing, setIsCapturing] = useState(false);
  const [batchCaptureCount, setBatchCaptureCount] = useState("1");
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);
  const graphVisualizationRef = useRef(null);
  const visualModuleContainerRef = useRef(null);
  const captureMenuRef = useRef(null);

  const [displayData, setDisplayData] = useState(tracerData);
  // console.log('Current displayData:', displayData);
  const displayStates = displayData?.states || [];
  const displayTotalSteps = displayStates.length;
  const currentState = displayStates[currentStep];
  const category = currentState?.category || 'sorting';
  
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
        // If is waiting for append
        if (tracerData.__append) {
          // Start from the step where new states begin
          const appendStart = Number.isInteger(tracerData.__appendStart)
            ? tracerData.__appendStart
            : 0;
          setCurrentStep(Math.max(0, appendStart));
        } else {
          setCurrentStep(0);
        }
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

  useEffect(() => {
    if (!isCaptureMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (captureMenuRef.current && !captureMenuRef.current.contains(event.target)) {
        setIsCaptureMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsCaptureMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCaptureMenuOpen]);



  const handleNextManual = () => {
    if (currentStep < displayTotalSteps - 1) {
      setCurrentStep(currentStep + 1);
      // handleFitToScreen();
      setIsPlaying(false);
    }
  };

  const handlePrevManual = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // handleFitToScreen();
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
    // Reset graph/tree node positions for visualizations that expose resetPositions.
    if (graphVisualizationRef.current) {
      graphVisualizationRef.current.resetPositions();
    }
  };

  const handleFitToScreen = () => {
    if (graphVisualizationRef.current.fit) {
      graphVisualizationRef.current.fit();
    }
  };

  const handleRandomizeLayout = () => {
    if (graphVisualizationRef.current.random) {
      graphVisualizationRef.current.random();
    }
  }

  const togglePlay = () => {
    if (currentStep >= displayTotalSteps - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleStepJump = (stepIndex) => {
    setCurrentStep(stepIndex);
    // handleFitToScreen();
    setIsPlaying(false);
  };

  const captureSingleStep = async (stepIndex, stepCurrentState) => {
    return captureVisualizationFrame({
      moduleElement: visualModuleContainerRef.current,
      stepIndex,
      totalSteps: displayTotalSteps,
      statusMessage: stepCurrentState.message || '',
    });
  };

  const saveCaptureBlob = async ({ blob, stepIndex, message }) => {
    await saveVisualizationCapture({
      blob,
      stepIndex,
      totalSteps: displayTotalSteps,
      message,
      category,
      onSaveVisualizationCapture,
    });
  };

  const captureSelectedSteps = async (stepIndices) => {
    if (!visualModuleContainerRef.current || isCapturing || displayTotalSteps === 0 || stepIndices.length === 0) {
      return;
    }

    const validStepIndices = Array.from(
      new Set(stepIndices.filter((stepIndex) => stepIndex >= 0 && stepIndex < displayTotalSteps)),
    );

    if (validStepIndices.length === 0) {
      return;
    }

    const shouldResumePlayback = isPlaying;
    const previousStepIndex = currentStep;

    setIsCapturing(true);
    setIsPlaying(false);
    // Close capture menu while batch capture is running.
    setIsCaptureMenuOpen(false);

    try {
      for (const stepIndex of validStepIndices) {
        setCurrentStep(stepIndex);
        const stepCurrentState = displayStates[stepIndex];
        const { blob, message } = await captureSingleStep(stepIndex, stepCurrentState);
        await saveCaptureBlob({ blob, stepIndex, message });
      }
    } catch (error) {
      console.error('Failed to capture visualization:', error);
      alert('Failed to capture visualization snapshot.');
    } finally {
      setCurrentStep(previousStepIndex);
      await waitForCaptureStability();
      setIsCapturing(false);
      if (shouldResumePlayback) {
        setIsPlaying(true);
      }
    }
  };

  const handleCaptureAll = async () => {
    const allStepIndices = Array.from({ length: displayTotalSteps }, (_, stepIndex) => stepIndex);
    await captureSelectedSteps(allStepIndices);
  };

  const handleCaptureCount = async () => {
    // Handle range input selection
    if (batchCaptureCount.includes('-')) {
      const [startRange, endRange] = batchCaptureCount.split('-').map(str => str.trim());
      const startIdx = parseInt(startRange, 10);
      const endIdx = parseInt(endRange, 10);
      if (startIdx >= 1 && endIdx >= startIdx) {
        const stepIndices = Array.from({ length: endIdx - startIdx + 1 }, (_, i) => startIdx - 1 + i).filter(
          index => index < displayTotalSteps
        );
        await captureSelectedSteps(stepIndices);
        return;
      }

    // If not range, handle single step input
    } else {
      const selectedStepToCapture = parseInt(batchCaptureCount, 10);
      if (Number.isInteger(selectedStepToCapture) && selectedStepToCapture >= 1 && selectedStepToCapture <= displayTotalSteps) {
        await captureSelectedSteps([selectedStepToCapture - 1]);
        return;
      }
    }
    alert('Please enter a valid number of steps to capture (e.g. "1" or "2-5").');
  };

  const toggleCaptureMenu = () => {
    setIsCaptureMenuOpen((prev) => !prev);
  };

  if (isRunning && !suppressRunningOverlay) {
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
    <div
      ref={visualModuleContainerRef}
      className={`visual-module-container ${isCapturing ? 'is-capturing' : ''}`}
    >
      <div className="visual-module-header">
        <div className="visual-module-header-top">
          <div className="visual-module-title-section">
            <h2 className="visual-module-title">Algorithm Visualization</h2>
            <div className="visual-module-controls-section">
                <div className="visual-module-controls">
                  {category === 'graphs' && (
                    <button
                      type="button"
                      className="visual-module-button"
                      onClick={handleRandomizeLayout}
                      title="Randomize node placement"
                      data-html2canvas-ignore="true"
                    >
                      ⇄ 
                    </button>
                  )}
                <button
                    onClick={handleReset}
                    className="visual-module-button"
                >
                    ⟲ Reset
                </button>
                {(category === 'graphs' || category === 'trees') && (
                  <button
                    onClick={handleFitToScreen}
                    className="visual-module-button"
                    title="Fit visualization to screen"
                  >
                    <i className="fas fa-expand"></i> Fit
                  </button>
                )}
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
                <div className="visual-module-capture-menu-container" ref={captureMenuRef}>
                  <button
                    type="button"
                    onClick={toggleCaptureMenu}
                    disabled={isCapturing || displayTotalSteps === 0}
                    className="visual-module-button visual-module-button-capture"
                    title="Capture options"
                  >
                    📸 Capture
                  </button>

                  {isCaptureMenuOpen && !isCapturing && (
                    <div className="visual-module-capture-context-menu" role="menu" aria-label="Capture options">
                      <button
                        type="button"
                        className="visual-module-capture-context-item"
                        onClick={handleCaptureAll}
                      >
                        Capture all steps
                      </button>
                      <div className="visual-module-capture-context-divider" />
                      <div className="visual-module-capture-context-row">
                        <label htmlFor="capture-step-count" className="visual-module-capture-context-label">
                          Capture N steps
                        </label>
                        <input
                          id="capture-step-count"
                          type="text"
                          value={batchCaptureCount}
                          onChange={(event) => setBatchCaptureCount(event.target.value)}
                          className="visual-module-capture-count-input"
                          title="Number of steps to capture from the current step"
                        />
                        <button
                          type="button"
                          className="visual-module-capture-context-cta"
                          onClick={handleCaptureCount}
                          title="Capture selected number of consecutive steps"
                        >
                          Capture
                        </button>
                      </div>
                      <div className="visual-module-capture-context-hint">
                        N can be a single number (e.g. "1") or a range (e.g. "1-10") to capture a relative range of steps.
                      </div>
                    </div>
                  )}
                </div>
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

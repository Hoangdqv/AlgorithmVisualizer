import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import SortingVisualization from './visualizations/SortingVisualization';
import GraphVisualization from './visualizations/GraphVisualization';
import TreeVisualization from './visualizations/TreeVisualization';

const VisualModule = ({ tracerData, isRunning, currentLanguage, suppressRunningOverlay = false, onSaveVisualizationCapture }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 0.5x to 2x
  const [isCapturing, setIsCapturing] = useState(false);
  const [batchCaptureCount, setBatchCaptureCount] = useState(5);
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);
  const graphVisualizationRef = useRef(null);
  const captureSurfaceRef = useRef(null);
  const captureMenuRef = useRef(null);

  const [displayData, setDisplayData] = useState(tracerData);
  console.log('Current displayData:', displayData);
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
    setIsPlaying(false);
  };

  const wrapTextByWidth = (context, text, maxWidth) => {
    if (!text) return [''];

    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${currentLine} ${words[i]}`;
      if (context.measureText(candidate).width <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }

    lines.push(currentLine);
    return lines;
  };

  const triggerDownload = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  };

  const waitForNextPaint = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const waitForDelay = (delayMs) => new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

  // Give state highlight transitions enough time to settle before rasterizing.
  const CAPTURE_SETTLE_MS = 340;

  // Convert the canvas section to blob object
  const canvasToBlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Unable to encode snapshot image'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });

  const captureSingleStep = async (stepIndex, stepState) => {
    if (!captureSurfaceRef.current) {
      throw new Error('Capture surface is not available');
    }

    // Let the current visualization frame settle before rasterizing.
    await waitForNextPaint();
    // Delay accounts for highlight transitions so captures reflect final visual state.
    await waitForDelay(CAPTURE_SETTLE_MS);
    await waitForNextPaint();
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    // Read current visible capture-surface bounds in CSS pixels.
    const targetRect = captureSurfaceRef.current.getBoundingClientRect();
    // Device pixel ratio of the current display.
    const dpr = window.devicePixelRatio || 1;
    // Use integer scaling for consistent edge rasterization.
    const captureScale = dpr >= 2 ? 2 : 1;

    // Canvas snapshot of the live visualization surface.
    const renderedCanvas = await html2canvas(captureSurfaceRef.current, {
      // Force a consistent background so transparent areas don't export as black.
      backgroundColor: '#1e1e1e',
      // Use an integer scale (1x/2x) to avoid subpixel border artifacts.
      scale: captureScale,
      // Allow external assets (icons/fonts/images) to be included when CORS permits.
      useCORS: true,
      // Disable verbose html2canvas logging in production.
      logging: false,
      // Remove the temporary cloned container after capture to avoid DOM buildup.
      removeContainer: true,
      onclone: (clonedDoc) => {
        // Target the cloned capture area so we can lock layout deterministically.
        const clonedSurface = clonedDoc.querySelector('.visual-module-capture-surface');
        if (clonedSurface) {
          // Freeze transitions/animations in the clone for deterministic screenshots.
          clonedSurface.classList.add('visual-capture-freeze');
          // Lock clone dimensions to the live element dimensions to prevent relayout shifts.
          clonedSurface.style.width = `${Math.round(targetRect.width)}px`;
          clonedSurface.style.height = `${Math.round(targetRect.height)}px`;
          // Clip overflowing children so export bounds match the visible panel.
          clonedSurface.style.overflow = 'hidden';
          // Ensure width/height include padding/border exactly like the live layout.
          clonedSurface.style.boxSizing = 'border-box';
        }
      },
    });

    // Step message shown in the footer.
    const message = (stepState?.message || '').toString();
    // Human-readable progress label.
    const stepSummary = `Step ${stepIndex + 1} of ${displayTotalSteps}`;
    // 2D context used to measure wrapped text width.
    const ctxForMeasure = renderedCanvas.getContext('2d');

    // Wrapped lines for the message block in the capture footer.
    let wrappedLines = [message];
    if (ctxForMeasure) {
      ctxForMeasure.font = `${Math.max(20, Math.floor(renderedCanvas.width * 0.015))}px sans-serif`;
      wrappedLines = wrapTextByWidth(ctxForMeasure, message, renderedCanvas.width - 80);
    }

    // Text line height used for footer layout.
    const lineHeight = Math.max(12, Math.floor(renderedCanvas.width * 0.015));
    // Vertical padding above and below footer text.
    const footerPadding = 18;
    // Total footer height based on line count and padding.
    const footerHeight = footerPadding * 2 + lineHeight * (wrappedLines.length + 1);

    // Output canvas that includes visualization + footer annotation.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = renderedCanvas.width;
    exportCanvas.height = renderedCanvas.height + footerHeight;

    // 2D drawing context for final export composition.
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) {
      throw new Error('Unable to build snapshot image context');
    }

    exportCtx.drawImage(renderedCanvas, 0, 0);
    exportCtx.fillStyle = '#141414';
    exportCtx.fillRect(0, renderedCanvas.height, exportCanvas.width, footerHeight);

    // Center all footer text vertically so the step label is not pinned at the top edge.
    const totalFooterLines = wrappedLines.length + 1;
    const textBlockHeight = lineHeight * totalFooterLines;
    const firstLineCenterY = renderedCanvas.height + (footerHeight - textBlockHeight) / 2 + lineHeight / 2;

    exportCtx.textBaseline = 'middle';
    exportCtx.fillStyle = '#f8d775';
    exportCtx.font = `600 ${Math.max(20, Math.floor(renderedCanvas.width * 0.017))}px sans-serif`;
    exportCtx.fillText(stepSummary, 24, firstLineCenterY);

    exportCtx.fillStyle = '#d9d9d9';
    exportCtx.font = `${Math.max(18, Math.floor(renderedCanvas.width * 0.014))}px sans-serif`;
    wrappedLines.forEach((line, index) => {
      exportCtx.fillText(line, 24, firstLineCenterY + lineHeight * (index + 1));
    });

    const blob = await canvasToBlob(exportCanvas);
    return { blob, message };
  };

  const saveCaptureBlob = async ({ blob, stepIndex, message }) => {
    // Timestamp token
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    // Default filename
    const fallbackName = `visual-step-${stepIndex + 1}-${stamp}.png`;

    if (onSaveVisualizationCapture) {
      const saved = await onSaveVisualizationCapture({
        // Image binary payload
        blob,
        step: stepIndex + 1,
        totalSteps: displayTotalSteps,
        message,
        category,
        fileName: fallbackName,
      });

      if (!saved) {
        triggerDownload(blob, fallbackName);
      }
      return;
    }

    triggerDownload(blob, fallbackName);
  };

  const runCaptureForSteps = async (stepIndices) => {
    if (!captureSurfaceRef.current || isCapturing || displayTotalSteps === 0 || stepIndices.length === 0) {
      return;
    }

    const normalizedStepIndices = Array.from(
      new Set(stepIndices.filter((stepIndex) => stepIndex >= 0 && stepIndex < displayTotalSteps)),
    );

    if (normalizedStepIndices.length === 0) {
      return;
    }

    const wasPlaying = isPlaying;
    const previousStep = currentStep;

    setIsCapturing(true);
    setIsPlaying(false);
    // Close capture menu while batch capture is running.
    setIsCaptureMenuOpen(false);

    try {
      for (const stepIndex of normalizedStepIndices) {
        setCurrentStep(stepIndex);
        const stepState = displayStates[stepIndex];
        const { blob, message } = await captureSingleStep(stepIndex, stepState);
        await saveCaptureBlob({ blob, stepIndex, message });
      }
    } catch (error) {
      console.error('Failed to capture visualization:', error);
      alert('Failed to capture visualization snapshot.');
    } finally {
      setCurrentStep(previousStep);
      await waitForNextPaint();
      setIsCapturing(false);
      if (wasPlaying) {
        setIsPlaying(true);
      }
    }
  };

  const handleCaptureAll = async () => {
    const allStepIndices = Array.from({ length: displayTotalSteps }, (_, stepIndex) => stepIndex);
    await runCaptureForSteps(allStepIndices);
  };

  const handleCaptureCount = async () => {
    const parsedCount = Number(batchCaptureCount);
    const clampedCount = Number.isFinite(parsedCount)
      ? Math.min(Math.max(Math.floor(parsedCount), 1), displayTotalSteps)
      : 1;
    const lastExclusive = Math.min(currentStep + clampedCount, displayTotalSteps);
    const stepIndices = Array.from({ length: lastExclusive - currentStep }, (_, offset) => currentStep + offset);
    await runCaptureForSteps(stepIndices);
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
    <div className="visual-module-container">
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
                    {isCapturing ? 'Capturing...' : '📸 Capture'}
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
                          type="number"
                          min="1"
                          max={Math.max(displayTotalSteps, 1)}
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
                        Use N = 1 to capture only the current step.
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
      <div
        ref={captureSurfaceRef}
        className={`visual-module-capture-surface ${isCapturing ? 'is-capturing' : ''}`}
      >
        {renderVisualization()}
      </div>
    </div>
  );
};

export default VisualModule;

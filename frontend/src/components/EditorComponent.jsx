import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import Sidebar from './layouts/Sidebar';
import VisualModule from './VisualModule';
import MinimalModePanel from './MinimalModePanel';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/editor.api';
import CompileBtn from './buttons/CompileBtn';
import ToggleDropdownBtn from './buttons/ToggleDropdownBtn';
import ToggleSideBarBtn from './buttons/ToggleSideBarBtn';
import BackBtn from './buttons/BackBtn';

const EditorComponent = ({
  // Core props
  code,
  handleEditorChange,
  currentLanguage,
  languageSelectionKey,
  languages,
  handleLanguageSelect,
  output,
  runCode,
  stopExecution,

  // UI state props
  showSidebar,
  toggleSidebar,
  isOpen,
  toggleDropdown,
  loading,
  isRunning,
  suppressRunningOverlay,

  // File/content handling
  handleFileSelect,
  apiCache,

  // Playground-specific props
  handleUserFileSelect,
  selectedUserFile,
  selectedUserFileId,
  selectedImageUrl,
  selectedImageName,
  onImagePreviewPrev,
  onImagePreviewNext,
  hasPrevImagePreview,
  hasNextImagePreview,
  autoSaving,
  initialSidebarTab,
  onSaveVisualizationCapture,

  // Interactive stdin props
  awaitConsoleInput,
  containerReady,
  stdinValue,
  setStdinValue,
  sendStdin,

  // Algorithm-specific props
  category,
  selectedAlgorithmKey,
  selectedAlgorithmName,
  viewMode,
  setViewMode,
  runMinimal,
  runMinimalContinue,
  hasTreeSession,
  explanation,
  tracerData,
  tracerGuide,
  showTracerGuide,
  toggleTracerGuide,
  onBack,
}) => {
  const resolvedLanguageKey =
    languageSelectionKey || (category ? `${category}_${currentLanguage}` : currentLanguage);
  const TRACER_GUIDE_ANIMATION_MS = 350;
  const [isTracerGuideRendered, setIsTracerGuideRendered] = useState(showTracerGuide);
  const [isTracerGuideClosing, setIsTracerGuideClosing] = useState(false);
  const [metadataTooltip, setMetadataTooltip] = useState(null);
  const [metadataTooltipPos, setMetadataTooltipPos] = useState({ x: 0, y: 0 });
  const editorInstanceRef = useRef(null);


  const handleCopySnippet = async (snippet) => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // no-op fallback; snippet remains selectable for manual copy
    }
  };

  // Auto-scroll the console output to the bottom when new output arrives
  const consoleScrollRef = useRef(null);
  useEffect(() => {
    const autoScroll = consoleScrollRef.current;
    if (autoScroll) {
      autoScroll.scrollTop = autoScroll.scrollHeight;
    }
  }, [output, isRunning, containerReady]);

  // Tracer guide effects and animation
  useEffect(() => {
    if (showTracerGuide) {
      setIsTracerGuideRendered(true);
      setIsTracerGuideClosing(false);
      return undefined;
    }

    if (!isTracerGuideRendered) {
      return undefined;
    }

    setIsTracerGuideClosing(true);
    const closeTimer = window.setTimeout(() => {
      setIsTracerGuideRendered(false);
      setIsTracerGuideClosing(false);
    }, TRACER_GUIDE_ANIMATION_MS);

    return () => window.clearTimeout(closeTimer);
  }, [showTracerGuide, isTracerGuideRendered, TRACER_GUIDE_ANIMATION_MS]);

  useEffect(() => {
    if (selectedImageUrl || viewMode === 'minimal') {
      return undefined;
    }

    const editorInstance = editorInstanceRef.current;
    if (!editorInstance) {
      return undefined;
    }

    // Layout the editor when the component mounts or when the selected image URL changes
    const rafId = window.requestAnimationFrame(() => {
      editorInstance.layout();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [selectedImageUrl, viewMode]);

  const getCurrentEditorRef = (editor) => {
    editorInstanceRef.current = editor;
  };

  const handleMetadataMouseMove = (event) => {
    setMetadataTooltipPos({ x: event.clientX, y: event.clientY });
  };

  const handleMetadataMouseLeave = () => {
    setMetadataTooltip(null);
  };

  return (
  <div className="layout-editor">
    <div className='topnav'>
      <BackBtn
        onBack={onBack} />
      <ToggleSideBarBtn
        toggleSidebar={toggleSidebar}
        showSidebar={showSidebar} />
      <div className="select-menu">
        <ToggleDropdownBtn
          toggleDropdown={toggleDropdown}
          isOpen={isOpen}
          loading={loading}
          currentLanguage={currentLanguage} />
        <ul className={`select-dropdown ${isOpen ? '' : 'hidden'}`}>
          {languages.map((language) => (
            <li
              key={language}
              onClick={() => handleLanguageSelect(language)}
              className={currentLanguage === language ? 'selected' : ''}
            >
              {language}
            </li>
          ))}
        </ul>
      </div>
      {viewMode && setViewMode && (
        <div className="mode-toggle">
          <button
            className={viewMode === 'minimal' ? 'active' : ''}
            onClick={() => {
              setViewMode('minimal');
              if (showTracerGuide) {
                toggleTracerGuide();
              }
            }}
          >
            Minimal
          </button>
          <button
            className={viewMode === 'detailed' ? 'active' : ''}
            onClick={() => setViewMode('detailed')}
          >
            Detailed
          </button>
        </div>
      )}
      {viewMode !== 'minimal' && !selectedImageUrl && (
        <>
          <CompileBtn
            runCode={runCode}
            isRunning={isRunning}
            loading={loading} />
          {tracerGuide && toggleTracerGuide && (
            <button
              onClick={toggleTracerGuide}
              className='compile-button tracer-guide-button'
              title='Open tracer guide'
            >
              Tracer Guide
            </button>
          )}
          {isRunning && stopExecution && (
            <button
              onClick={stopExecution}
              className='compile-button'
              style={{ backgroundColor: '#d32f2f', cursor: 'pointer', marginLeft: '0.4rem' }}
            >
              ■ Stop
            </button>
          )}
        </>
      )}
      {selectedUserFile && (
        <div className="autosave-indicator">
          {autoSaving && <span style={{ color: '#4CAF50' }}>Saving in progress...</span>}
        </div>
      )}
    </div>

    <div className="editor-container">
      <PanelGroup direction="horizontal">
        {/* Sidebar Panel */}
        {showSidebar && (
          <>
            <Panel minSize={15} maxSize={15} className='panel-border-white' id='sidebar-panel' order={1}>
              <Sidebar
                onFileSelect={handleFileSelect}
                onUserFileSelect={handleUserFileSelect}
                selectedLanguage={resolvedLanguageKey}
                initialTab={initialSidebarTab}
                // Propagates selection state so tree highlight follows image arrow navigation.
                selectedUserFileId={selectedUserFileId}
                apiCache={apiCache} />
            </Panel>
            <PanelResizeHandle className='resizable-handle-horizontal' />
          </>
        )}

        {/* Code Editor / Minimal Mode Panel */}
        <Panel minSize={30} defaultSize={39} className='panel-border-white' id='code-editor-panel' order={2}>
          <div className="code-editor">
            <PanelGroup direction="vertical">
              {/* Top Panel: Editor or Minimal Form */}
              <Panel minSize={30}>
                {viewMode === 'minimal' ? (
                  <MinimalModePanel
                    category={category}
                    algorithmKey={selectedAlgorithmKey}
                    algorithmName={selectedAlgorithmName}
                    onRun={runMinimal}
                    onRunContinue={runMinimalContinue}
                    hasTreeSession={hasTreeSession}
                    isRunning={isRunning}
                  />
                ) : (
                  <div className='editor-preview-stack'>
                    <div
                      className={`editor-surface${selectedImageUrl ? ' is-hidden' : ' is-visible'}`}
                      aria-hidden={Boolean(selectedImageUrl)}
                    >
                      <Editor
                        height="100%"
                        theme="vs-dark"
                        language={currentLanguage.toLowerCase()}
                        value={code}
                        onMount={getCurrentEditorRef}
                        onChange={handleEditorChange}
                        options={{
                          fontSize: 14,
                          minimap: { enabled: false },
                          automaticLayout: true,
                          suggestOnTriggerCharacters: true,
                          quickSuggestions: true,
                          parameterHints: { enabled: true },
                          hover: { enabled: true },
                          "semanticHighlighting.enabled": true,
                          "autoClosingBrackets": "always",
                          "autoClosingComments": "always",
                        }} />
                    </div>
                    <div
                      className={`image-preview-surface${selectedImageUrl ? ' is-visible' : ' is-hidden'}`}
                      aria-hidden={!selectedImageUrl}
                    >
                      {selectedImageUrl && (
                        <div className='image-preview-panel'>
                          <div className='image-preview-header'>
                            <div className='image-preview-header-main'>
                              <span>Previewing image</span>
                              {selectedImageName && <span className='image-preview-filename'>{selectedImageName}</span>}
                            </div>
                            <div className='image-preview-nav-controls'>
                              <button
                                type='button'
                                className='image-preview-nav-button'
                                onClick={onImagePreviewPrev}
                                disabled={!hasPrevImagePreview}
                                title='Previous image (Left Arrow)'
                              >
                                ←
                              </button>
                              <button
                                type='button'
                                className='image-preview-nav-button'
                                onClick={onImagePreviewNext}
                                disabled={!hasNextImagePreview}
                                title='Next image (Right Arrow)'
                              >
                                →
                              </button>
                            </div>
                          </div>
                          <div className='image-preview-body'>
                            <img src={selectedImageUrl} alt={selectedImageName || 'User image file'} className='image-preview-content' />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className='resizable-handle-vertical' />

              {/* Console Panel */}
              <Panel defaultSize={30} minSize={15} id='console-panel' order={3}>
                <div className='console-output'>
                  <div className='console-scroll' ref={consoleScrollRef}>
                  {explanation ? (
                    <>
                      <div className='console-text'>Algorithm Explanation:</div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                        {explanation}
                      </pre>
                      {output && (
                        <>
                          <div className='console-text' style={{ marginTop: '1.5rem' }}>Console Output:</div>
                          {output}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className='console-text'>Console Output:</div>
                      <pre className='console-pre'>
                        {output
                          ? output
                          : isRunning
                            ? 'Running...'
                            : 'Click "Run Code" to see output...'}
                      </pre>
                    </>
                  )}
                  </div>

                  {/* Stdin input — awaits user input */}
                  {isRunning && sendStdin && awaitConsoleInput && containerReady && (
                    <div className='stdin-row'>
                      <span className='stdin-caret'>&gt;</span>
                      <input
                        type='text'
                        className='stdin-input'
                        value={stdinValue ?? ''}
                        onChange={e => setStdinValue && setStdinValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && stdinValue !== undefined) {
                            sendStdin(stdinValue);
                            setStdinValue && setStdinValue('');
                          }
                        }}
                        placeholder='Type input and press Enter…'
                        autoFocus
                        spellCheck={false}
                      />
                    </div>
                  )}
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </Panel>

        {/* Visualization Panel - Only show if tracerData is provided */}
        {tracerData !== undefined && (
          <>
            <PanelResizeHandle className='resizable-handle-horizontal' />
            <Panel minSize={35} defaultSize={46} className='panel-border-white' id='visualization-panel' order={3}>
              <VisualModule
                tracerData={tracerData}
                isRunning={isRunning}
                currentLanguage={currentLanguage}
                suppressRunningOverlay={suppressRunningOverlay}
                onSaveVisualizationCapture={onSaveVisualizationCapture}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>

    {isTracerGuideRendered && tracerGuide && (
      <>
        <aside className={`tracer-guide-drawer${isTracerGuideClosing ? ' is-closing' : ' is-open'}`} role='dialog' aria-label='Tracer guide panel'>
          <div className='tracer-guide-header'>
            <span>{tracerGuide.title} ({tracerGuide.languageLabel})</span>
            <button
              type='button'
              className='tracer-guide-close-btn'
              onClick={toggleTracerGuide}
              title='Close tracer guide'
            >
              ✕
            </button>
          </div>

          <div className='tracer-guide-section'>
            <div className='tracer-guide-label'>Add tracer calls at these key moments:</div>
            <ul className='tracer-guide-list'>
              {tracerGuide.moments.map((moment) => (
                <li key={moment}>{moment}</li>
              ))}
            </ul>
          </div>

          <div className='tracer-guide-section'>
            <div className='tracer-guide-label'>Detected tracer lines for this code:</div>
            <ol className='tracer-guide-line-list'>
              {tracerGuide.detectedLines.map((line) => (
                <li key={line.id} className='tracer-guide-line-item'>
                  {(() => {
                    return (
                      <>
                  <div className='tracer-guide-line-title'>{line.title}</div>
                  <div className='tracer-guide-line-row'>
                    <textarea
                      className='tracer-guide-line-snippet'
                      readOnly
                      value={line.snippet}
                      rows={Math.max(2, (line.snippet.match(/\n/g) || []).length + 1)}
                      onFocus={(event) => event.target.select()}
                      draggable={true}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', line.snippet);
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      style={{ resize: 'none' }}
                    />
                    <button
                      type='button'
                      className='tracer-guide-line-copy-btn'
                      onClick={() => handleCopySnippet(line.snippet)}
                    >
                      📋
                    </button>
                  </div>
                      </>
                    );
                  })()}
                </li>
              ))}
            </ol>
          </div>

          <div className='tracer-guide-section'>
            <div className='tracer-guide-label'>Common tracer metadata:</div>
            <div className='tracer-guide-metadata-list'>
              {tracerGuide.metadata.map((metaKey) => {
                const hint = tracerGuide.metadataHints?.[metaKey];
                const tooltipText = hint ? `${metaKey}: ${hint}` : metaKey;
                return (
                  <span
                    key={metaKey}
                    className='tracer-guide-metadata-chip'
                    onMouseEnter={(event) => {
                      setMetadataTooltip(tooltipText);
                      setMetadataTooltipPos({ x: event.clientX, y: event.clientY });
                    }}
                    onMouseMove={handleMetadataMouseMove}
                    onMouseLeave={handleMetadataMouseLeave}
                  >
                    {metaKey}
                  </span>
                );
              })}
            </div>
            <div className='tracer-guide-label' style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
              Hover a metadata key to see possible values.
            </div>
          </div>

          <div className='tracer-guide-section'>
            <div className='tracer-guide-label'>State API:</div>
            <pre className='tracer-guide-inline'>
              {`tracer.${tracerGuide.tracerMethod}(stateData, {...metadata})`}
            </pre>
          </div>

        </aside>
        {metadataTooltip && (
          <div
            className='tracer-guide-floating-tooltip'
            style={{ left: `${metadataTooltipPos.x}px`, top: `${metadataTooltipPos.y}px` }}
          >
            {metadataTooltip}
          </div>
        )}
      </>
    )}
  </div>
  );
}

export default EditorComponent;

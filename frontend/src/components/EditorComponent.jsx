import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import Sidebar from './layouts/Sidebar';
import VisualModule from './VisualModule';
import MinimalModePanel from './MinimalModePanel';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/editor.api';
import CompileBtn from './buttons/CompileBtn';
import ToggleDropdownBtn from './ToggleDropdownBtn';
import ToggleSideBarBtn from './buttons/ToggleSideBarBtn';
import BackBtn from './buttons/BackBtn';

const EditorComponent = ({
  // Core props
  code,
  handleEditorChange,
  currentLanguage,
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

  // File/content handling
  handleFileSelect,
  apiCache,

  // Playground-specific props
  handleUserFileSelect,
  currentFile,
  autoSaving,

  // Interactive stdin props
  awaitConsoleInput,
  containerReady,
  stdinValue,
  setStdinValue,
  sendStdin,

  // Algorithm-specific props
  category,
  selectedAlgorithmKey,
  viewMode,
  setViewMode,
  runMinimal,
  explanation,
  tracerData,
  onBack,
}) => {
  const sidebarLanguageKey = category ? `${category}_${currentLanguage}` : currentLanguage;

  // Auto-scroll the console output to the bottom when new output arrives
  const consoleScrollRef = useRef(null);
  useEffect(() => {
    const el = consoleScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [output, isRunning, containerReady]);

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
            onClick={() => setViewMode('minimal')}
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
      {viewMode !== 'minimal' && (
        <>
          <CompileBtn
            runCode={runCode}
            isRunning={isRunning}
            loading={loading} />
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
      {currentFile && (
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
                selectedLanguage={sidebarLanguageKey || currentLanguage}
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
                    onRun={runMinimal}
                    isRunning={isRunning}
                  />
                ) : (
                  <div style={{ height: '100%' }}>
                    <Editor
                      height="100%"
                      theme="vs-dark"
                      language={currentLanguage.toLowerCase()}
                      value={code}
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

                  {/* Stdin input — only shown for code that explicitly awaits user input */}
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
              <VisualModule tracerData={tracerData} isRunning={isRunning} currentLanguage={currentLanguage} />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  </div>
  );
}

export default EditorComponent;

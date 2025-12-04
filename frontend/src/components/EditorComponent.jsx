import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import Sidebar from './Sidebar';
import VisualModule from './VisualModule';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/editor.api';
import CompileBtn from './CompileBtn';
import ToggleDropdownBtn from './ToggleDropdownBtn';
import ToggleSideBarBtn from './ToggleSideBarBtn';
import BackBtn from './BackBtn';

const EditorComponent = ({
  toggleSidebar, 
  showSidebar, 
  toggleDropdown, 
  isOpen, 
  loading, 
  selectedLanguage,
  languages, 
  handleLanguageSelect, 
  runCode, 
  isRunning, 
  handleFileSelect, 
  handleUserFileSelect,
  samplesCache, 
  code, 
  handleEditorChange, 
  output, 
  explanation, 
  sidebarLanguageKey, 
  tracerData, 
  onBack,
  currentFile,
  autoSaving
}) => (
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
          selectedLanguage={selectedLanguage} />
        <ul className={`select-dropdown ${isOpen ? '' : 'hidden'}`}>
          {languages.map((language) => (
            <li
              key={language}
              onClick={() => handleLanguageSelect(language)}
              className={selectedLanguage === language ? 'selected' : ''}
            >
              {language}
            </li>
          ))}
        </ul>
      </div>
      <CompileBtn
        runCode={runCode}
        isRunning={isRunning}
        loading={loading} />
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
            <Panel minSize={15} maxSize={20} className='panel-border-white' id='sidebar-panel' order={1}>
              <Sidebar
                onFileSelect={handleFileSelect}
                onUserFileSelect={handleUserFileSelect}
                selectedLanguage={sidebarLanguageKey || selectedLanguage}
                samplesCache={samplesCache} />
            </Panel>
            <PanelResizeHandle className='resizable-handle-horizontal' />
          </>
        )}

        {/* Code Editor Panel */}
        <Panel minSize={30} className='panel-border-white' id='code-editor-panel' order={2}>
          <div className="code-editor">
            <PanelGroup direction="vertical">
              {/* Editor Panel */}
              <Panel minSize={30}>
                <div style={{ height: '100%' }}>
                  <Editor
                    height="100%"
                    theme="vs-dark"
                    language={selectedLanguage.toLowerCase()}
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
              </Panel>

              {/* Resize Handle */}
              <PanelResizeHandle className='resizable-handle-vertical' />

              {/* Console Panel */}
              <Panel defaultSize={30} minSize={15} id='console-panel' order={3}>
                <div className='console-output'>
                  {explanation ? (
                    <>
                      <div className='console-text'>
                        📚 Algorithm Explanation:
                      </div>
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                        {explanation}
                      </pre>
                      {output && (
                        <>
                          <div className='console-text' style={{ marginTop: '1.5rem' }}>
                            Console Output:
                          </div>
                          {output}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className='console-text'>
                        Console Output:
                      </div>
                      {output || 'Click "Run Code" to see output...'}
                    </>
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
            <Panel minSize={25} defaultSize={35} className='panel-border-white' id='visualization-panel' order={3}>
              <VisualModule tracerData={tracerData} isRunning={isRunning} selectedLanguage={selectedLanguage} />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  </div>
)

export default EditorComponent;

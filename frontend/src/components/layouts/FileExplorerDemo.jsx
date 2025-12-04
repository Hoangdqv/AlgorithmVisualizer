// FileExplorerDemo.jsx - Demo page for file explorer functionality
import { useState, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Editor from '@monaco-editor/react';
import FileExplorerSidebar from '../FileExplorerSidebar';
import { useAuth } from '../../context/useAuth';

const FileExplorerDemo = () => {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [code, setCode] = useState('// Select a file to edit');
  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [showSidebar, setShowSidebar] = useState(true);
  const [output, setOutput] = useState('Ready to run code...');
  const [isRunning, setIsRunning] = useState(false);
  
  const samplesCache = useRef({});

  const handleFileSelect = async (file) => {
    setSelectedFile(file);
    setCode(file.content || '');
    
    // Set language based on file
    if (file.language === 'python') {
      setSelectedLanguage('Python');
    } else if (file.language === 'javascript') {
      setSelectedLanguage('JavaScript');
    }
  };

  const handleSampleSelect = async (sampleKey) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/sample-code/${selectedLanguage.toLowerCase()}/${sampleKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCode(data.code || '');
        setSelectedFile(null); // Clear user file selection
      }
    } catch (error) {
      console.error('Error loading sample:', error);
    }
  };

  const handleCodeChange = async (value) => {
    setCode(value || '');
    
    // Auto-save if it's a user file
    if (selectedFile && user) {
      // Debounced save would go here
      // For now, we'll save on explicit action
    }
  };

  const handleSaveFile = async () => {
    if (!selectedFile || !user) {
      alert('Please select a file to save');
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/user/files/${selectedFile.file_id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: code })
        }
      );

      if (response.ok) {
        setOutput('✓ File saved successfully');
        // Update the selected file's content
        setSelectedFile({ ...selectedFile, content: code });
      } else {
        const error = await response.json();
        setOutput(`✗ Save failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving file:', error);
      setOutput(`✗ Save failed: ${error.message}`);
    }
  };

  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('Running...');
    
    try {
      const response = await fetch('http://localhost:5000/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: selectedLanguage.toLowerCase(),
          code: code
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const outputText = data.output || 'No output';
        const errorText = data.stderr ? `\nErrors:\n${data.stderr}` : '';
        setOutput(outputText + errorText);
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      setOutput(`Failed to run code: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="layout-editor">
      <div className="topnav">
        <button onClick={() => setShowSidebar(!showSidebar)} className="showfile-button">
          {showSidebar ? '✕ Close' : '☰ Files'}
        </button>
        
        <div className="file-info">
          {selectedFile ? (
            <span style={{ color: '#ccc', fontSize: '14px' }}>
              📄 {selectedFile.file_name || selectedFile.path}
            </span>
          ) : (
            <span style={{ color: '#666', fontSize: '14px' }}>
              No file selected
            </span>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          {selectedFile && user && (
            <button onClick={handleSaveFile} className="save-button">
              💾 Save
            </button>
          )}
          <button 
            onClick={handleRunCode} 
            disabled={isRunning}
            className="compile-button"
            style={{ backgroundColor: isRunning ? '#666' : '#28a745' }}
          >
            {isRunning ? '⏳ Running...' : '▶️ Run'}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <PanelGroup direction="horizontal">
          {/* Sidebar */}
          {showSidebar && (
            <>
              <Panel minSize={15} maxSize={30} className="panel-border-white" defaultSize={20}>
                <FileExplorerSidebar
                  onFileSelect={handleFileSelect}
                  selectedFileId={selectedFile?.file_id}
                  onSampleSelect={handleSampleSelect}
                  selectedLanguage={selectedLanguage}
                  samplesCache={samplesCache}
                />
              </Panel>
              <PanelResizeHandle className="resizable-handle-horizontal" />
            </>
          )}

          {/* Editor */}
          <Panel minSize={30}>
            <PanelGroup direction="vertical">
              {/* Code Editor */}
              <Panel minSize={40}>
                <Editor
                  height="100%"
                  theme="vs-dark"
                  language={selectedLanguage.toLowerCase()}
                  value={code}
                  onChange={handleCodeChange}
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    automaticLayout: true,
                  }}
                />
              </Panel>

              <PanelResizeHandle className="resizable-handle-vertical" />

              {/* Output Console */}
              <Panel minSize={20} defaultSize={30}>
                <div className="console-output">
                  <div className="console-text">Output:</div>
                  <pre>{output}</pre>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

export default FileExplorerDemo;

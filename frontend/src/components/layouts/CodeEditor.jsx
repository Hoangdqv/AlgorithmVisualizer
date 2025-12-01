import { useState, useEffect, useRef } from 'react';
import EditorComponent from '../EditorComponent';

const CodeEditor = () => {
  const [code, setCode] = useState('// Loading...');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('Loading console...');
  const [isRunning, setIsRunning] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const samplesCache = useRef({});

  const languages = ['Python', 'JavaScript'];

  useEffect(() => {
    loadSampleCode(selectedLanguage);
  }, [selectedLanguage]);

  const loadSampleCode = async (language) => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/sample-code/${language.toLowerCase()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code) {
        setCode(data.code);
        setOutput('');
      } else {
        console.error('Error loading sample code:', data.error);
        setCode(`// Error loading ${language} sample code`);
      }
    } catch (error) {
      console.error('Failed to fetch sample code:', error);
      setCode(`// Failed to load ${language} sample code\n// Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runCode = async () => {
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

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleLanguageSelect = (language) => {
    setSelectedLanguage(language);
    setIsOpen(false);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleFileSelect = async (sampleKey) => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/sample-code/${selectedLanguage.toLowerCase()}/${sampleKey}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.code) {
        setCode(data.code);
        setOutput('');
      } else {
        console.error('Failed to load sample:', data.error);
        setCode(`// Error loading sample: ${data.error}`);
      }
    } catch (error) {
      console.error('Error loading sample:', error);
      setCode(`// Failed to load sample: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <EditorComponent
      toggleSidebar={toggleSidebar}
      showSidebar={showSidebar}
      code={code}
      handleEditorChange={handleEditorChange}
      languages={languages}
      selectedLanguage={selectedLanguage}
      handleLanguageSelect={handleLanguageSelect}
      isOpen={isOpen}
      toggleDropdown={toggleDropdown}
      loading={loading}
      runCode={runCode}
      isRunning={isRunning}
      output={output}
      samplesCache={samplesCache}
      handleFileSelect={handleFileSelect}
    />
  );
};

export default CodeEditor;
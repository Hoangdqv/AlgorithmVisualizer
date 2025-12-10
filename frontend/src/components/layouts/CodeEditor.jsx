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
  const [currentFile, setCurrentFile] = useState(null); // Track currently opened user file
  const [autoSaving, setAutoSaving] = useState(false);
  const [languages, setLanguages] = useState(['Python', 'JavaScript']); // Default fallback

  const samplesCache = useRef({});
  const autoSaveTimeout = useRef(null);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/languages`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          const langNames = data.languages.map(lang => {
            const name = lang.language;
            return name.charAt(0).toUpperCase() + name.slice(1);
          });
          setLanguages(langNames);
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };
    fetchLanguages();
  }, []);

  useEffect(() => {
    if (currentFile) return;
    loadSampleCode(selectedLanguage);
  }, [selectedLanguage, currentFile]);

  const loadSampleCode = async (language) => {
    setLoading(true);
    try {
      // Get list of samples first
      const listResponse = await fetch(`${import.meta.env.VITE_API_URL}/samples/${language.toLowerCase()}`);
      
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch samples: ${listResponse.status}`);
      }
      
      const listData = await listResponse.json();
      const firstSampleKey = listData.samples?.[0]?.key;
      
      if (!firstSampleKey) {
        setCode('// No samples available');
        return;
      }
      
      // Get the first sample code
      const response = await fetch(`${import.meta.env.VITE_API_URL}/samples/${language.toLowerCase()}/${firstSampleKey}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sample code: ${response.status}`);
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
      const response = await fetch(`${import.meta.env.VITE_API_URL}/execute`, {
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
    // Auto-save for user files
    if (currentFile) {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
      
      autoSaveTimeout.current = setTimeout(() => {
        saveUserFile(value || '');
      }, 2000); // Auto-save after 2 seconds of no typing
    }
  };

  const saveUserFile = async (content) => {
    if (!currentFile) return;
    
    setAutoSaving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/files/${currentFile.file_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content })
      });
      
      if (response.ok) {
        console.log('File auto-saved');
      }
    } catch (error) {
      console.error('Error auto-saving file:', error);
    } finally {
      setTimeout(() => setAutoSaving(false), 1500);
    }
  };

  const handleUserFileSelect = (file) => {
    setCurrentFile(file);
    setCode(file.content || '');
    setOutput('');
    
    const langMap = {
      1: 'Python',
      2: 'JavaScript'
    };
    const fileLang = langMap[file.lang_id] || 'Python';
    setSelectedLanguage(fileLang);
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
    setCurrentFile(null); // Clear current user file when selecting a sample
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/samples/${selectedLanguage.toLowerCase()}/${sampleKey}`
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
      handleUserFileSelect={handleUserFileSelect}
      currentFile={currentFile}
      autoSaving={autoSaving}
    />
  );
};

export default CodeEditor;

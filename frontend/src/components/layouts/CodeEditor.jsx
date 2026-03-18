import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EditorComponent from '../EditorComponent';

const CodeEditor = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const hasPendingIncomingFile = Boolean(location.state?.openUserFile);

  // State declarations
  const [currentLanguage, setCurrentLanguage] = useState('Python');
  const [output, setOutput] = useState('Loading console...');
  const [code, setCode] = useState('// Loading...');
  const [isRunning, setIsRunning] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedUserFile, setSelectedUserFile] = useState(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [languageData, setLanguageData] = useState([]);
  const [stdinValue, setStdinValue] = useState('');
  const [awaitConsoleInput, setAwaitConsoleInput] = useState(false);
  const [containerReady, setContainerReady] = useState(false);

  const languages = useMemo(() => {
    return languageData.map(lang => {
      const name = lang.language;
      return name.charAt(0).toUpperCase() + name.slice(1);
    });
  }, [languageData]);

  const apiCache = useRef({
    lists: {},
    code: {},
    inputFlags: {}
  });
  const autoSaveTimeout = useRef(null);
  const runIdRef = useRef(null);
  const eventSourceRef = useRef(null);
  
  const activeRunRef = useRef(false);

  const API_URL = import.meta.env.VITE_API_URL;

  // Auto-detect whether user file code reads from stdin
  const _codeNeedsInput = (src, lang) => {
    if (lang === 'python') return /\binput\s*\(/.test(src);
    return /readline|process\.stdin|prompt\s*\(/.test(src);
  };

  // SSE Cleanup check
  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  // Silent stop used on file/language change
  const forceStopExecution = useCallback(() => {
    if (!activeRunRef.current) return;
    const rid = runIdRef.current;
    activeRunRef.current = false;
    setIsRunning(false);
    setStdinValue('');
    setContainerReady(false);
    closeStream();
    if (rid) {
      fetch(`${API_URL}/execute/${rid}/stop`, { method: 'POST' }).catch(() => {});
      runIdRef.current = null;
    }
  }, [API_URL, closeStream]);

  // File selection handlers
  const handleFileSelect = useCallback(async (sampleKey) => {
    forceStopExecution();
    setSelectedUserFile(null);
    const codeKey = `${currentLanguage}_${sampleKey}`;

    if (apiCache.current.code[codeKey]) {
      setCode(apiCache.current.code[codeKey]);
      setAwaitConsoleInput(apiCache.current.inputFlags[codeKey] ?? false);
      setOutput('');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/samples/${currentLanguage.toLowerCase()}/${sampleKey}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.code) {
        apiCache.current.code[codeKey] = data.code;
        apiCache.current.inputFlags[codeKey] = data.await_console_input ?? false;
        setCode(data.code);
        setOutput('');
        setAwaitConsoleInput(data.await_console_input ?? false);
      } else {
        setCode(`// Error loading sample: ${data.error}`);
      }
    } catch (error) {
      setCode(`// Failed to load sample: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentLanguage, API_URL, forceStopExecution]);

  const handleUserFileSelect = useCallback((file) => {
    forceStopExecution();
    setSelectedUserFile(file);
    setCode(file.content || '');
    setOutput('');
    const langObj = languageData.find(lang => lang.lang_id === file.lang_id);
    const langName = langObj
      ? langObj.language.charAt(0).toUpperCase() + langObj.language.slice(1)
      : 'Python';
    setCurrentLanguage(langName);
    setAwaitConsoleInput(_codeNeedsInput(file.content || '', langObj?.language ?? 'python'));
  }, [forceStopExecution, languageData]);

  // Effects
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${API_URL}/languages`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setLanguageData(data.languages || []);
          if (data.languages && data.languages.length > 0) {
            const firstLang = data.languages[0].language;
            setCurrentLanguage(firstLang.charAt(0).toUpperCase() + firstLang.slice(1));
          }
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };
    fetchLanguages();
  }, [API_URL]);

  useEffect(() => {
    const incomingFile = location.state?.openUserFile;
    if (!incomingFile || languageData.length === 0) return;

    handleUserFileSelect(incomingFile);
    // Clear one-time route state after applying it to avoid re-opening on rerender.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, languageData, navigate, handleUserFileSelect]);

  // Load sample code when language changes
  useEffect(() => {
    // If a user file is selected, skip samples loading
    if (selectedUserFile || hasPendingIncomingFile) return;

    const cacheKey = currentLanguage;

    // Check if sample list is cached
    if (apiCache.current.lists[cacheKey]) {
      const cached = apiCache.current.lists[cacheKey];
      if (cached.length > 0) handleFileSelect(cached[0].key);
      return;
    }
    setLoading(true);
    const fetchSampleCode = async (language) => {
      try {
        const response = await fetch(`${API_URL}/samples/${language.toLowerCase()}`);
        if (!response.ok) throw new Error(`Failed to fetch samples: ${response.status}`);
        const listData = await response.json();
        if (listData.samples && listData.samples.length > 0) {
          apiCache.current.lists[cacheKey] = listData.samples;
          handleFileSelect(listData.samples[0].key);
        } else {
          apiCache.current.lists[cacheKey] = [];
          setCode(`// No ${language} samples available`);
        }
      } catch (error) {
        setCode(`// Failed to load ${language} sample code\n// Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSampleCode(currentLanguage);
  }, [currentLanguage, selectedUserFile, hasPendingIncomingFile, handleFileSelect, API_URL]);

  // Editor change handler
  const handleEditorChange = (value) => {
    setCode(value || '');
    setAwaitConsoleInput(_codeNeedsInput(value || '', currentLanguage.toLowerCase()));

    if (selectedUserFile) {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = setTimeout(() => saveUserFile(value || ''), 10000);
    }
  };

  // Code execution handler
  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    setStdinValue('');
    setContainerReady(false);

    if (awaitConsoleInput) {
      // Interactive mode — use SSE streaming so stdin can be sent
      activeRunRef.current = true;
      try {
        const res = await fetch(`${API_URL}/execute/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: currentLanguage.toLowerCase(), code }),
        });
        const body = await res.json();

        if (!res.ok) {
          activeRunRef.current = false;
          setIsRunning(false);
          setOutput(`Error: ${body.error || 'Unknown error'}`);
          return;
        }

        const rid = body.run_id;
        runIdRef.current = rid;

        // Open SSE stream — native browser API
        const source = new EventSource(`${API_URL}/execute/${rid}/stream`);
        eventSourceRef.current = source;

        source.onmessage = (event) => {
          if (!activeRunRef.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.output) {
              setContainerReady(true);
              setOutput(prev => prev + data.output);
            }
          } catch { /* ignore */ }
        };

        source.addEventListener('done', (event) => {
          if (!activeRunRef.current) { closeStream(); return; }
          activeRunRef.current = false;
          setIsRunning(false);
          setContainerReady(false);
          closeStream();
          try {
            const data = JSON.parse(event.data);
            if (data.exit_code !== 0 && data.exit_code !== null) {
              setOutput(prev => prev + `\n[Process exited with code ${data.exit_code}]`);
            }
          } catch { /* ignore */ }
        });

        source.onerror = () => {
          if (!activeRunRef.current) closeStream();
        };
      } catch (err) {
        activeRunRef.current = false;
        setIsRunning(false);
        setOutput(`Error: ${err.message}`);
      }
    } else {
      // Non-interactive mode — simple POST
      try {
        const res = await fetch(`${API_URL}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: currentLanguage.toLowerCase(), code }),
        });
        const body = await res.json();
        setIsRunning(false);

        if (!res.ok || !body.success) {
          setOutput(body.error || body.stderr || 'Execution failed');
          return;
        }

        let result = body.output || '';
        if (body.stderr) result += (result ? '\n' : '') + body.stderr;
        setOutput(result || '(no output)');
      } catch (err) {
        setIsRunning(false);
        setOutput(`Error: ${err.message}`);
      }
    }
  };

  const stopExecution = () => {
    const rid = runIdRef.current;
    activeRunRef.current = false;
    setIsRunning(false);
    setContainerReady(false);
    setOutput(prev => prev + '\n[Execution stopped by user]');
    closeStream();
    if (rid) {
      fetch(`${API_URL}/execute/${rid}/stop`, { method: 'POST' }).catch(() => {});
      runIdRef.current = null;
    }
  };

  // Send a line of stdin to the running container
  const sendStdin = (text) => {
    const rid = runIdRef.current;
    if (!rid || !isRunning) return;
    setOutput(prev => prev + text + '\n');
    fetch(`${API_URL}/execute/${rid}/stdin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: text }),
    }).catch(() => {});
  };

  // Auto-save
  const saveUserFile = async (content) => {
    if (!selectedUserFile) return;
    setAutoSaving(true);
    try {
      const response = await fetch(`${API_URL}/user/files/${selectedUserFile.file_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content })
      });
      if (response.ok) console.log('File auto-saved');
    } catch (error) {
      console.error('Error auto-saving file:', error);
    } finally {
      setTimeout(() => setAutoSaving(false), 1500);
    }
  };

  // UI toggle handlers
  const toggleSidebar = () => setShowSidebar(prev => !prev);
  const toggleDropdown = () => setIsOpen(prev => !prev);

  // Language change handler
  const handleLanguageSelect = (lang) => {
    setCurrentLanguage(lang);
    setIsOpen(false);
  };

  return (
    <EditorComponent
      // Core editor props
      code={code}
      handleEditorChange={handleEditorChange}
      currentLanguage={currentLanguage}
      languages={languages}
      handleLanguageSelect={handleLanguageSelect}
      output={output}
      runCode={runCode}
      stopExecution={stopExecution}

      // UI state props
      showSidebar={showSidebar}
      toggleSidebar={toggleSidebar}
      isOpen={isOpen}
      toggleDropdown={toggleDropdown}
      loading={loading}
      isRunning={isRunning}

      // File/content handling
      handleFileSelect={handleFileSelect}
      apiCache={apiCache}

      // Playground-specific props
      handleUserFileSelect={handleUserFileSelect}
      selectedUserFile={selectedUserFile}
      autoSaving={autoSaving}
      initialSidebarTab={hasPendingIncomingFile || selectedUserFile ? 'myfiles' : 'samples'}

      // Interactive stdin props
      awaitConsoleInput={awaitConsoleInput}
      containerReady={containerReady}
      stdinValue={stdinValue}
      setStdinValue={setStdinValue}
      sendStdin={sendStdin}
    />
  );
};

export default CodeEditor;

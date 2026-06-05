import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EditorComponent from '../EditorComponent';
import { consoleErrorHandling, stripAnsi } from '../../script_utils/consoleErrorHandling';

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
  const [isBlankEditorMode, setIsBlankEditorMode] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [selectedImageName, setSelectedImageName] = useState('');
  const [imagePreviewIndex, setImagePreviewIndex] = useState(-1);
  const [imagePreviewList, setImagePreviewList] = useState([]);
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
  const AUTOSAVE_TIMEOUT_MS = 3000; // 3s
  const runIdRef = useRef(null);
  const eventSourceRef = useRef(null);
  const preferredSampleKeyRef = useRef(null);
  
  const activeRunRef = useRef(false);
  // Image preview performance/state refs:
  // - cache blob URLs so arrow navigation does not refetch previous images
  // - track latest request so stale async responses cannot override current selection
  const imageObjectUrlCacheRef = useRef(new Map());
  const imageSelectionRequestRef = useRef(0);
  const imageNavigationBusyRef = useRef(false);
  const queuedImageNavigationOffsetRef = useRef(0);

  const API_URL = import.meta.env.VITE_API_URL;

  const getLanguageTemplate = useCallback((language) => {
    const lang = (language || '').toLowerCase();
    if (lang === 'python') return '# Write your first line of code here!';
    else return '// Write your first line of code here!';
  }, []);

  const isImageFileName = useCallback((name) => {
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || '');
  }, []);


  const loadImageBlobUrl = useCallback(async (fileId) => {
    // Reuse object URLs for already-opened images to reduce navigation latency.
    const cachedUrl = imageObjectUrlCacheRef.current.get(fileId);
    if (cachedUrl) {
      return cachedUrl;
    }

    const response = await fetch(`${API_URL}/user/files/${fileId}/binary`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image blob (${response.status})`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    imageObjectUrlCacheRef.current.set(fileId, objectUrl);
    return objectUrl;
  }, [API_URL]);

  const clearImagePreview = useCallback(() => {
    setSelectedImageUrl(null);
    setSelectedImageName('');
    setImagePreviewIndex(-1);
    setImagePreviewList([]);
    // Increment request token so older async image loads are ignored.
    imageSelectionRequestRef.current += 1;
  }, []);

  const loadImagePreviewListForFile = useCallback(async (activeFile) => {
    if (!activeFile) {
      return { index: -1, list: [] };
    }

    let allFiles = apiCache.current.userFilesData?.files;
    if (!Array.isArray(allFiles) || allFiles.length === 0) {
      try {
        const filesResponse = await fetch(`${API_URL}/user/files`, {
          credentials: 'include'
        });
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          allFiles = filesData.files || [];
          apiCache.current.userFilesData = {
            ...(apiCache.current.userFilesData || {}),
            files: allFiles,
          };
        }
      } catch (error) {
        console.error('Error loading files for image navigation:', error);
      }
    }

    const activeFolderId = activeFile.parent_item_id ?? null;
    const imageFiles = (Array.isArray(allFiles) ? allFiles : [])
      .filter((file) => (file.parent_item_id ?? null) === activeFolderId)
      .filter((file) => Boolean(file.has_binary) || isImageFileName(file.item_name));

    let imageIndex = imageFiles.findIndex((file) => file.file_id === activeFile.file_id);

    if (imageIndex === -1 && (Boolean(activeFile.has_binary) || isImageFileName(activeFile.item_name))) {
      const mergedFiles = [...imageFiles, activeFile];
      imageIndex = mergedFiles.findIndex((file) => file.file_id === activeFile.file_id);
      return { index: imageIndex, list: mergedFiles };
    }

    return { index: imageIndex, list: imageFiles };
  }, [API_URL, apiCache, isImageFileName]);

  // Auto-detect whether user file code reads from stdin
  const _codeNeedsInput = (src, lang) => {
    if (lang === 'python') return /\binput\s*\(/.test(src);
    return /readline|process\.stdin|prompt\s*\(/.test(src);
  };

  const getDefaultExeFileName = useCallback(() => {
    const ext = currentLanguage.toLowerCase() === 'python' ? 'py' : 'js';
    return `playground.${ext}`;
  }, [currentLanguage]);

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
    preferredSampleKeyRef.current = sampleKey;
    forceStopExecution();
    setSelectedUserFile(null);
    setIsBlankEditorMode(false);
    clearImagePreview();
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
      setCode(`// Failed to load sample: ${consoleErrorHandling(error)}`);
    } finally {
      setLoading(false);
    }
  }, [currentLanguage, API_URL, forceStopExecution, clearImagePreview]);

  const handleUserFileSelect = useCallback(async (file) => {
    // Token for rejecting stale async loads if user navigates quickly.
    const requestId = imageSelectionRequestRef.current + 1;
    imageSelectionRequestRef.current = requestId;
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = null;
    }
    forceStopExecution();

    if (!file) {
      setSelectedUserFile(null);
      setIsBlankEditorMode(true);
      clearImagePreview();
      setCode(getLanguageTemplate(currentLanguage));
      setOutput('');
      setAwaitConsoleInput(false);
      return;
    }

    setIsBlankEditorMode(false);
    setSelectedUserFile(file);
    const langObj = languageData.find(lang => lang.lang_id === file.lang_id);
    const langName = langObj
      ? langObj.language.charAt(0).toUpperCase() + langObj.language.slice(1)
      : 'Python';

    const fileContent = typeof file.content === 'string' ? file.content : '';
    const imageMode = Boolean(file.has_binary) || isImageFileName(file.item_name);

    if (imageMode) {
      if (file.has_binary) {
        try {
          const objectUrl = await loadImageBlobUrl(file.file_id);
          if (requestId !== imageSelectionRequestRef.current) {
            return;
          }
          setSelectedImageUrl(objectUrl);
        } catch (error) {
          console.error('Failed to load image blob preview:', error);
          if (requestId !== imageSelectionRequestRef.current) {
            return;
          }
          setOutput(consoleErrorHandling(error));
          setSelectedImageUrl(null);
        }
      } else {
        setSelectedImageUrl(null);
        setOutput(consoleErrorHandling(new Error('Image file detected but no binary blob is available. Please re-capture to regenerate this file.')));
      }
      setSelectedImageName(file.item_name || 'snapshot.png');
      setCode('');
      if (file.has_binary) {
        setOutput('Image preview mode');
      }
      setAwaitConsoleInput(false);
      return;
    }

    clearImagePreview();

    setCode(fileContent.trim().length > 0 ? fileContent : getLanguageTemplate(langName));
    setOutput('');
    setCurrentLanguage(langName);
  }, [forceStopExecution, languageData, getLanguageTemplate, currentLanguage, isImageFileName, clearImagePreview, loadImageBlobUrl]);

  useEffect(() => {
    const imageUrlCache = imageObjectUrlCacheRef.current;
    return () => {
      // Revoke all cached object URLs to avoid leaking browser memory.
      imageUrlCache.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      imageUrlCache.clear();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!selectedUserFile || !selectedImageUrl) {
      setImagePreviewIndex(-1);
      setImagePreviewList([]);
      return undefined;
    }

    const hydrateImageNavigation = async () => {
      const { index, list } = await loadImagePreviewListForFile(selectedUserFile);
      if (!isCancelled) {
        setImagePreviewIndex(index);
        setImagePreviewList(list);
      }
    };

    hydrateImageNavigation();

    return () => {
      isCancelled = true;
    };
  }, [selectedUserFile, selectedImageUrl, loadImagePreviewListForFile]);

  useEffect(() => {
    if (!selectedImageUrl || imagePreviewList.length === 0 || imagePreviewIndex < 0) {
      return;
    }

    // Preload neighbors so next/prev arrow feels instant in common cases.
    const neighborIndices = [imagePreviewIndex - 1, imagePreviewIndex + 1]
      .filter((index) => index >= 0 && index < imagePreviewList.length);

    neighborIndices.forEach((index) => {
      const neighborFile = imagePreviewList[index];
      if (neighborFile?.has_binary) {
        loadImageBlobUrl(neighborFile.file_id).catch(() => {});
      }
    });
  }, [selectedImageUrl, imagePreviewList, imagePreviewIndex, loadImageBlobUrl]);

  const navigateImagePreview = useCallback(async (offset) => {
    if (!selectedImageUrl || imagePreviewList.length === 0) {
      return;
    }

    if (imageNavigationBusyRef.current) {
      // Keep only the latest requested direction while current navigation is running.
      queuedImageNavigationOffsetRef.current = offset;
      return;
    }

    imageNavigationBusyRef.current = true;

    try {
      const currentIndexFromSelectedFile = selectedUserFile
        ? imagePreviewList.findIndex((file) => file.file_id === selectedUserFile.file_id)
        : -1;
      const currentIndex = currentIndexFromSelectedFile >= 0 ? currentIndexFromSelectedFile : imagePreviewIndex;

      if (currentIndex < 0) {
        return;
      }

      if (imagePreviewList.length <= 1) {
        return;
      }
      // Loop when the last index is reached in either direction.

      let targetIndex = currentIndex + offset;
      if (targetIndex < 0) {
        targetIndex = imagePreviewList.length - 1;
      } else if (targetIndex >= imagePreviewList.length) {
        targetIndex = 0;
      }

      const targetFile = imagePreviewList[targetIndex];
      if (!targetFile) {
        return;
      }

      await handleUserFileSelect(targetFile);
    } finally {
      imageNavigationBusyRef.current = false;
      const queuedOffset = queuedImageNavigationOffsetRef.current;
      if (queuedOffset !== 0) {
        queuedImageNavigationOffsetRef.current = 0;
        // Process one queued navigation request after the current move settles.
        navigateImagePreview(queuedOffset);
      }
    }
  }, [selectedImageUrl, imagePreviewList, imagePreviewIndex, selectedUserFile, handleUserFileSelect]);

  useEffect(() => {
    if (!selectedImageUrl) {
      return undefined;
    }

    const handleImageArrowKeys = (event) => {
      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName;
      const isTypingTarget = Boolean(
        activeElement?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT',
      );

      if (isTypingTarget) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateImagePreview(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateImagePreview(1);
      }
    };

    window.addEventListener('keydown', handleImageArrowKeys);
    return () => window.removeEventListener('keydown', handleImageArrowKeys);
  }, [selectedImageUrl, navigateImagePreview]);

  useEffect(() => {
    if (!isBlankEditorMode) return;
    setCode(getLanguageTemplate(currentLanguage));
  }, [isBlankEditorMode, currentLanguage, getLanguageTemplate]);

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

    setShowSidebar(true);
    handleUserFileSelect(incomingFile);
    // Clear one-time route state after applying it to avoid re-opening on rerender.
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, languageData, navigate, handleUserFileSelect]);

  useEffect(() => {
    if (!selectedUserFile) return;
    setAwaitConsoleInput(_codeNeedsInput(code || '', currentLanguage.toLowerCase()));
  }, [selectedUserFile, code, currentLanguage]);

  // Load sample code when language changes
  useEffect(() => {
    // If a user file is selected, skip samples loading
    if (selectedUserFile || hasPendingIncomingFile || isBlankEditorMode) return;

    const cacheKey = currentLanguage;
    const preferredSampleKey = preferredSampleKeyRef.current;

    // Check if sample list is cached
    if (apiCache.current.lists[cacheKey]) {
      const cached = apiCache.current.lists[cacheKey];
      if (cached.length > 0) {
        const preferredSample = preferredSampleKey
          ? cached.find((item) => item.key === preferredSampleKey)
          : null;
        handleFileSelect((preferredSample || cached[0]).key);
      }
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
          const preferredSample = preferredSampleKey
            ? listData.samples.find((item) => item.key === preferredSampleKey)
            : null;
          handleFileSelect((preferredSample || listData.samples[0]).key);
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
  }, [currentLanguage, selectedUserFile, hasPendingIncomingFile, isBlankEditorMode, handleFileSelect, API_URL]);

  // Editor change handler
  const handleEditorChange = (value) => {
    if (selectedImageUrl) {
      return;
    }
    setCode(value || '');
    setAwaitConsoleInput(_codeNeedsInput(value || '', currentLanguage.toLowerCase()));

    if (selectedUserFile) {
      const targetFileId = selectedUserFile.file_id;
      const contentSnapshot = value || '';
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      autoSaveTimeout.current = setTimeout(
        () => saveUserFile(targetFileId, contentSnapshot),
        AUTOSAVE_TIMEOUT_MS
      );
    }
  };

  // Code execution handler
  const runCode = async () => {
    setIsRunning(true);
    setOutput('');
    setStdinValue('');
    setContainerReady(false);
    const executionFileName = getDefaultExeFileName();

    if (awaitConsoleInput) {
      // Interactive mode — use SSE streaming so stdin can be sent
      activeRunRef.current = true;
      try {
        const res = await fetch(`${API_URL}/execute/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: currentLanguage.toLowerCase(),
            code,
            file_name: executionFileName,
          }),
        });
        const body = await res.json();

        if (!res.ok) {
          activeRunRef.current = false;
          setIsRunning(false);
          setOutput(consoleErrorHandling(body.stderr || body.error));
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
              setOutput(prev => prev + stripAnsi(data.output));
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
        setOutput(consoleErrorHandling(err.message));
      }
    } else {
      // Non-interactive mode — simple POST
      try {
        const res = await fetch(`${API_URL}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: currentLanguage.toLowerCase(),
            code,
            file_name: selectedUserFile?.item_name ?? executionFileName,
          }),
        });
        const body = await res.json();
        console.log('Execution response:', body);
        setIsRunning(false);
        if (!body.success) {
          setOutput(consoleErrorHandling(body.stderr || body.error));
          return;
        }

        setOutput(stripAnsi(body.output));
      } catch (err) {
        setIsRunning(false);
        setOutput(consoleErrorHandling(err.message));
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
  const saveUserFile = async (fileId, content) => {
    if (!fileId) return;
    setAutoSaving(true);
    try {
      const response = await fetch(`${API_URL}/user/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content })
      });
      if (response.ok){
        console.log('File auto-saved');
        if (!apiCache.current.userFileContent) {
          apiCache.current.userFileContent = {};
        }
        const cached = apiCache.current.userFileContent[fileId];
        if (cached) {
          apiCache.current.userFileContent[fileId] = { ...cached, content };
        }
        setSelectedUserFile(prev => (
          prev && prev.file_id === fileId
            ? { ...prev, content }
            : prev
        ));
      }
    } catch (error) {
      setOutput(consoleErrorHandling('Error auto-saving file'));
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

  const languageSelectionKey = currentLanguage;
  const hasImageNavigation = imagePreviewIndex >= 0 && imagePreviewList.length > 1;

  return (
    <EditorComponent
      // Core editor props
      code={code}
      handleEditorChange={handleEditorChange}
      currentLanguage={currentLanguage}
      languageSelectionKey={languageSelectionKey}
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
      // Keep tree highlight in sync when image nav changes selected file.
      selectedUserFileId={selectedUserFile?.file_id ?? null}
      selectedImageUrl={selectedImageUrl}
      selectedImageName={selectedImageName}
      onImagePreviewPrev={() => navigateImagePreview(-1)}
      onImagePreviewNext={() => navigateImagePreview(1)}
      hasPrevImagePreview={hasImageNavigation}
      hasNextImagePreview={hasImageNavigation}
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

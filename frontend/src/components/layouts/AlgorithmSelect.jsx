import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import EditorComponent from '../EditorComponent';
import { buildParamsBlock } from '../../data/algorithmParams';
import { getTracerGuideWithDetection } from '../../data/tracerGuideTemplates';
import { consoleErrorHandling } from '../../script_utils/consoleErrorHandling';

const AlgorithmSelect = () => {
  // Router hooks
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') || 'sorting';

  // State declarations
  const [currentLanguage, setCurrentLanguage] = useState('Python');
  const [output, setOutput] = useState('Select an algorithm to run...');
  const [code, setCode] = useState('// Loading algorithms...');
  const [explanation, setExplanation] = useState(''); // Store algorithm explanation
  const [tracerData, setTracerData] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showTracerGuide, setShowTracerGuide] = useState(false);
  const [viewMode, setViewMode] = useState('detailed');
  const [selectedAlgorithmKey, setSelectedAlgorithmKey] = useState(null);
  const [selectedAlgorithmName, setSelectedAlgorithmName] = useState('Loading...');
  const [languageData, setLanguageData] = useState([]);
  const [treeSession, setTreeSession] = useState(null);
  const [isLiveAppendingRun, setIsLiveAppendingRun] = useState(false);

  // Fetch languages
  const languages = useMemo(() => {
    return languageData.map(lang => {
      const name = lang.language;
      return name.charAt(0).toUpperCase() + name.slice(1);
    });
  }, [languageData]);

  const apiCache = useRef({
    lists: {},  // Cache by category+language
    code: {}    // Cache by algorithmKey
  });

  const tracerGuide = useMemo(() => {
    return getTracerGuideWithDetection(category, currentLanguage.toLowerCase(), code);
  }, [category, currentLanguage, code]);

  // File selection handlers
  const handleFileSelect = useCallback(async (algorithmKey) => {
    setSelectedAlgorithmKey((prevKey) => {
      if (prevKey && prevKey !== algorithmKey) {
        setTreeSession(null);
      }
      return algorithmKey;
    });
    // codeKey example format: "sorting_python_quicksort" or "graphs_javascript_dfs"
    const codeKey = `${category}_${currentLanguage}_${algorithmKey}`;
    
    if (apiCache.current.code[codeKey]) {
      // If found, load from cache
      const cached = apiCache.current.code[codeKey];
      setCode(cached.code);
      setExplanation(cached.explanation || '');
      setSelectedAlgorithmName(cached.name || 'Loading...');
      setOutput('');
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/algorithms/${category}/${currentLanguage}/${algorithmKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.code) {
        // Cache the code and explanation
        apiCache.current.code[codeKey] = {
          code: data.code,
          explanation: data.explanation || '',
          name: data.name || 'Loading...'
        };
        
        setCode(data.code);
        setOutput('');
        setExplanation(data.explanation || '');
        setSelectedAlgorithmName(data.name || 'Loading...');
      } else {
        console.error('Error loading algorithm code:', data.error);
        setCode(`// Error loading algorithm code`);
      }
    } catch (error) {
      console.error('Failed to fetch algorithm code:', error);
      setCode(`// Failed to load algorithm: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [category, currentLanguage]);

  const handleViewModeChange = useCallback((newMode) => {
    // When switching to minimal mode, restore original code from cache
    if (newMode === 'minimal' && selectedAlgorithmKey) {
      const codeKey = `${category}_${currentLanguage}_${selectedAlgorithmKey}`;
      const cached = apiCache.current.code[codeKey];
      if (cached) {
        setCode(cached.code);
      }
    }
    setViewMode(newMode);
  }, [category, currentLanguage, selectedAlgorithmKey]);

  // Fetch languages ONCE on mount
  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/languages`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setLanguageData(data.languages || []);
          if (data.languages && data.languages.length > 0) {
            const langNames = data.languages.map(lang => {
              const name = lang.language;
              return name.charAt(0).toUpperCase() + name.slice(1);
            });
            if (!langNames.includes(currentLanguage)) {
              setCurrentLanguage(langNames[0]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching languages:', error);
      }
    };
    fetchLanguages();
  }, [currentLanguage]); // Run once on mount or if currentLanguage changes

  useEffect(() => {
    // example cacheKey format is "sorting_python" or "graphs_javascript"
    const cacheKey = `${category}_${currentLanguage}`;

    setSelectedAlgorithmName('Loading...');
    setSelectedAlgorithmKey(null);

    // Check if algorithm list is cached
    if (apiCache.current.lists[cacheKey]) {
      const cached = apiCache.current.lists[cacheKey];
      if (cached.length > 0) {
        handleFileSelect(cached[0].key);
      }
      return;
    }

    setLoading(true);
    const fetchAlgorithms = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/algorithms/${category}/${currentLanguage}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.algorithms && data.algorithms.length > 0) {
          // Cache the algorithm list
          apiCache.current.lists[cacheKey] = data.algorithms;
          // Auto-load first algorithm
          handleFileSelect(data.algorithms[0].key);
        } else {
          apiCache.current.lists[cacheKey] = [];
          setCode(`// No ${currentLanguage} algorithms available in ${category} category`);
        }
      } catch (error) {
        console.error('Failed to fetch algorithms:', error);
        setCode(`// Failed to load algorithms: ${consoleErrorHandling(error.message)}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAlgorithms();
  }, [category, currentLanguage, handleFileSelect]);

  useEffect(() => {
    // Reset session when language/category context changes.
    setTreeSession(null);
  }, [category, currentLanguage]);

  const handleEditorChange = (value) => {
    const cleaned = (value || '').replace(/\\?\$\{?0\}?/g, '');
    setCode(cleaned);
  };

  const inferRootId = useCallback((nodes, fallback = 1) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return fallback;

    const allIds = new Set(nodes.map(node => node.id));
    const childIds = new Set();

    nodes.forEach(node => {
      (node.children || []).forEach(childId => {
        if (childId !== null && childId !== undefined) {
          childIds.add(childId);
        }
      });
    });

    const rootCandidate = [...allIds].find(id => !childIds.has(id));
    return rootCandidate ?? fallback;
  }, []);

  const getLatestTreeSnapshot = useCallback((statesPayload) => {
    const states = statesPayload?.states || [];
    for (let i = states.length - 1; i >= 0; i -= 1) {
      if (Array.isArray(states[i]?.tree) && states[i].tree.length > 0) {
        return states[i].tree;
      }
    }
    return null;
  }, []);

  // Code execution
  const runCode = useCallback(async () => {
    setIsRunning(true);
    setOutput('Running...');
    // Keep non-tree categories stateless; tree can seed minimal continuation.
    if (category !== 'trees') setTreeSession(null);
    setTracerData(null);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/execute/algorithm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language: currentLanguage.toLowerCase(),
          code: code
        })
      });

      const data = await response.json();

      if (data.success) {
        setOutput(data.output);
        
        // Store tracer data for visualization
        if (data.states) {
          setTracerData(data.states);

          if (category === 'trees') {
            const latestTree = getLatestTreeSnapshot(data.states);
            if (latestTree) {
              setTreeSession({
                nodes: latestTree,
                rootId: inferRootId(latestTree, 1),
              });
            } else {
              setTreeSession(null);
            }
          }
        } else if (category === 'trees') {
          setTreeSession(null);
        }
      } else {
        console.log('Execution error:', data.stderr);
        setOutput(consoleErrorHandling(data.stderr));
      }
    } catch (error) {
      setOutput(consoleErrorHandling(error.message));
    } finally {
      setIsRunning(false);
    }
  }, [currentLanguage, code, category, getLatestTreeSnapshot, inferRootId]);

  const runMinimalInternal = useCallback(async (params, continueSession = false) => {
    const baseTreeNodes = treeSession?.nodes?.length ? treeSession.nodes : null;
    const baseRootId = treeSession?.rootId || 1;

    const useTreeSession = continueSession
      && category === 'trees'
      && baseTreeNodes
      && baseTreeNodes.length > 0;

    const effectiveParams = useTreeSession
      ? {
          ...params,
          existingTreeNodes: baseTreeNodes,
          existingRootId: baseRootId,
        }
      : params;

    const paramsBlock = buildParamsBlock(category, currentLanguage.toLowerCase(), effectiveParams);
    setIsLiveAppendingRun(useTreeSession);
    setIsRunning(true);
    setOutput('Running...');
    if (!useTreeSession) {
      setTracerData(null);
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/execute/algorithm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: currentLanguage.toLowerCase(),
          code: code,
          params_block: paramsBlock,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOutput(data.output);

        if (data.states) {
          const previousStates = tracerData?.states || [];
          const nextStates = data.states.states || [];

          if (useTreeSession && previousStates.length > 0 && nextStates.length > 0) {
            const mergedStatesPayload = {
              ...data.states,
              metadata: data.states.metadata || tracerData.metadata,
              states: [...previousStates, ...nextStates],
              // Expecting append?
              __append: true,
              // Append to what step? Final step before new states start
              __appendStart: previousStates.length,
            };
            setTracerData(mergedStatesPayload);
          } else {
            setTracerData(data.states);
          }

          if (category === 'trees') {
            const latestTree = getLatestTreeSnapshot(data.states);
            if (latestTree) {
              setTreeSession({
                nodes: latestTree,
                rootId: inferRootId(latestTree, baseRootId),
              });
            }
          }
        }
      } else {
        setOutput(consoleErrorHandling(data.stderr));
      }
    } catch (error) {
      setOutput(consoleErrorHandling(error.message));
    } finally {
      setIsRunning(false);
      setIsLiveAppendingRun(false);
    }
  }, [code, category, currentLanguage, treeSession, tracerData, getLatestTreeSnapshot, inferRootId]);

  const runMinimal = useCallback(async (params) => {
    await runMinimalInternal(params, false);
  }, [runMinimalInternal]);

  const runMinimalContinue = useCallback(async (params) => {
    await runMinimalInternal(params, true);
  }, [runMinimalInternal]);

  // UI toggle handlers
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleLanguageSelect = (language) => {
    setCurrentLanguage(language);
    setIsOpen(false);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const downloadCapture = useCallback((blob, filename) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  }, []);

  const handleSaveVisualizationCapture = useCallback(async (capture) => {
    if (!capture?.blob) {
      return false;
    }

    const now = new Date();
    const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const rawAlgoName = (selectedAlgorithmName || 'algorithm').toString();
    const sanitizedAlgoName = rawAlgoName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'algorithm';
    const stepNumber = capture.step || 1;
    // Zero-pad step index so file listings and image navigation keep numeric order.
    const totalSteps = Math.max(capture.totalSteps || stepNumber, stepNumber);
    const paddedStep = String(stepNumber).padStart(String(totalSteps).length, '0');
    const filename = `${sanitizedAlgoName}-step-${paddedStep}-${stamp}.png`;

    const languageMatch = languageData.find((lang) => lang.language?.toLowerCase() === currentLanguage.toLowerCase());
    const fallbackLanguageId = languageData[0]?.lang_id;
    const languageId = languageMatch?.lang_id || fallbackLanguageId;

    if (!languageId) {
      downloadCapture(capture.blob, filename);
      setOutput('Could not resolve a language id for file storage, snapshot downloaded locally instead.');
      return false;
    }

    try {
      const formData = new FormData();
      formData.append('file', capture.blob, filename);
      formData.append('file_name', filename);
      formData.append('language_id', String(languageId));

      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/files/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        setOutput(`Saved snapshot to My Files: ${filename}`);
        return true;
      }

      if (response.status === 401) {
        downloadCapture(capture.blob, filename);
        setOutput('You are not logged in, so the snapshot was downloaded locally.');
        return false;
      }

      const errorData = await response.json().catch(() => ({}));
      setOutput(`Failed to save snapshot to My Files (${errorData.error || response.statusText}). Downloaded locally instead.`);
      downloadCapture(capture.blob, filename);
      return false;
    } catch (error) {
      console.error('Failed to persist visualization capture:', error);
      setOutput(`Failed to save snapshot online (${error.message}). Downloaded locally instead.`);
      downloadCapture(capture.blob, filename);
      return false;
    }
  }, [currentLanguage, languageData, downloadCapture, selectedAlgorithmName]);

  // Navigation handlers
  const handleBack = () => {
    navigate('/algorithms');
  };

  const languageSelectionKey = `${category}_${currentLanguage}`;

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
      
      // UI state props
      showSidebar={showSidebar}
      toggleSidebar={toggleSidebar}
      isOpen={isOpen}
      toggleDropdown={toggleDropdown}
      loading={loading}
      isRunning={isRunning}
      suppressRunningOverlay={isLiveAppendingRun}
      
      // File/content handling
      handleFileSelect={handleFileSelect}
      apiCache={apiCache}
      
      // Algorithm-specific props
      category={category}
      selectedAlgorithmKey={selectedAlgorithmKey}
      selectedAlgorithmName={selectedAlgorithmName}
      viewMode={viewMode}
      setViewMode={handleViewModeChange}
      runMinimal={runMinimal}
      runMinimalContinue={runMinimalContinue}
      hasTreeSession={Boolean(treeSession?.nodes?.length)}
      explanation={explanation}
      tracerData={tracerData}
      tracerGuide={tracerGuide}
      showTracerGuide={showTracerGuide}
      toggleTracerGuide={() => setShowTracerGuide(prev => !prev)}
      onSaveVisualizationCapture={handleSaveVisualizationCapture}
      onBack={handleBack}
    />
  );
};

export default AlgorithmSelect;

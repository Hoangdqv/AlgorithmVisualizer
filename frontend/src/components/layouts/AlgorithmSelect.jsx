import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import EditorComponent from '../EditorComponent';
import { buildParamsBlock } from '../../data/algorithmParams';
import { getTracerGuideWithDetection } from '../../data/tracerGuideTemplates';

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
  const [selectedAlgorithmName, setSelectedAlgorithmName] = useState('N/A');
  const [languageData, setLanguageData] = useState([]);
  const [treeSession, setTreeSession] = useState(null);
  const [isLiveAppendingRun, setIsLiveAppendingRun] = useState(false);
  const preferredAlgorithmKeyRef = useRef(null);

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
    const codeKey = `${category}_${currentLanguage}_${algorithmKey}`;
    
    if (apiCache.current.code[codeKey]) {
      // If found, load from cache
      const cached = apiCache.current.code[codeKey];
      setCode(cached.code);
      setExplanation(cached.explanation || '');
      setSelectedAlgorithmName(cached.name || 'N/A');
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
          name: data.name || 'N/A'
        };
        
        setCode(data.code);
        setOutput('');
        setExplanation(data.explanation || '');
        setSelectedAlgorithmName(data.name || 'N/A');
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

  useEffect(() => {
    preferredAlgorithmKeyRef.current = selectedAlgorithmKey;
  }, [selectedAlgorithmKey]);

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
    const cacheKey = `${category}_${currentLanguage}`;

    setSelectedAlgorithmName('N/A');

    // Check if algorithm list is cached
    if (apiCache.current.lists[cacheKey]) {
      const cached = apiCache.current.lists[cacheKey];
      if (cached.length > 0) {
        const preferredKey = preferredAlgorithmKeyRef.current;
        const preferredItem = preferredKey
          ? cached.find((item) => item.key === preferredKey)
          : null;
        handleFileSelect((preferredItem || cached[0]).key);
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
          // Keep the current algorithm selected if it exists in the new language list.
          const preferredKey = preferredAlgorithmKeyRef.current;
          const preferredItem = preferredKey
            ? data.algorithms.find((item) => item.key === preferredKey)
            : null;
          handleFileSelect((preferredItem || data.algorithms[0]).key);
        } else {
          apiCache.current.lists[cacheKey] = [];
          setSelectedAlgorithmKey(null);
          setCode(`// No ${currentLanguage} algorithms available in ${category} category`);
        }
      } catch (error) {
        console.error('Failed to fetch algorithms:', error);
        setCode(`// Failed to load algorithms: ${error.message}`);
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
    // Keep non-tree categories stateless; tree category can seed minimal continuation.
    if (category !== 'trees') {
      setTreeSession(null);
    }
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
        setOutput(data.output || 'No output');
        
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
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      setOutput(`Failed to run code: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [currentLanguage, code, category, getLatestTreeSnapshot, inferRootId]);

  const runMinimalInternal = useCallback(async (params, continueFromTreeSession = false) => {
    const baseTreeNodes = treeSession?.nodes?.length ? treeSession.nodes : null;
    const baseRootId = treeSession?.rootId || 1;

    const canUseTreeSession = continueFromTreeSession
      && category === 'trees'
      && baseTreeNodes
      && baseTreeNodes.length > 0;

    const effectiveParams = canUseTreeSession
      ? {
          ...params,
          existingTreeNodes: baseTreeNodes,
          existingRootId: baseRootId,
        }
      : params;

    const paramsBlock = buildParamsBlock(category, currentLanguage.toLowerCase(), effectiveParams);
    setIsLiveAppendingRun(continueFromTreeSession);
    setIsRunning(true);
    setOutput('Running...');
    if (!continueFromTreeSession) {
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
        setOutput(data.output || 'No output');

        if (data.states) {
          const previousStates = tracerData?.states || [];
          const nextStates = data.states.states || [];

          if (continueFromTreeSession && previousStates.length > 0 && nextStates.length > 0) {
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
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      setOutput(`Failed to run code: ${error.message}`);
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

  // Navigation handlers
  const handleBack = () => {
    navigate('/algorithms');
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
      onBack={handleBack}
    />
  );
};

export default AlgorithmSelect;

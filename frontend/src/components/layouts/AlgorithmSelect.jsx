import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import EditorComponent from '../EditorComponent';
import { buildParamsBlock } from '../../data/algorithmParams';

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
  const [viewMode, setViewMode] = useState('detailed');
  const [selectedAlgorithmKey, setSelectedAlgorithmKey] = useState(null);
  const [languageData, setLanguageData] = useState([]);

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

  // File selection handlers
  const handleFileSelect = useCallback(async (algorithmKey) => {
    setSelectedAlgorithmKey(algorithmKey);
    const codeKey = `${category}_${currentLanguage}_${algorithmKey}`;
    
    if (apiCache.current.code[codeKey]) {
      // If found, load from cache
      const cached = apiCache.current.code[codeKey];
      setCode(cached.code);
      setExplanation(cached.explanation || '');
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
          explanation: data.explanation || ''
        };
        
        setCode(data.code);
        setOutput('');
        setExplanation(data.explanation || '');
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
    const cacheKey = `${category}_${currentLanguage}`;

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
        setCode(`// Failed to load algorithms: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAlgorithms();
  }, [category, currentLanguage, handleFileSelect]);

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  // Code execution
  const runCode = useCallback(async () => {
    setIsRunning(true);
    setOutput('Running...');
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
        const outputText = data.output || 'No output';
        const errorText = data.stderr ? `\nErrors:\n${data.stderr}` : '';
        setOutput(outputText + errorText);
        
        // Store tracer data for visualization
        if (data.states) {
          setTracerData(data.states);
        }
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      setOutput(`Failed to run code: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [currentLanguage, code]);

  const runMinimal = useCallback(async (params) => {
    const paramsBlock = buildParamsBlock(category, currentLanguage.toLowerCase(), params);

    setIsRunning(true);
    setOutput('Running...');
    setTracerData(null);

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
        const outputText = data.output || 'No output';
        const errorText = data.stderr ? `\nErrors:\n${data.stderr}` : '';
        setOutput(outputText + errorText);

        if (data.states) {
          setTracerData(data.states);
        }
      } else {
        setOutput(`Error: ${data.error}`);
      }
    } catch (error) {
      setOutput(`Failed to run code: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [code, category, currentLanguage]);

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
      
      // File/content handling
      handleFileSelect={handleFileSelect}
      apiCache={apiCache}
      
      // Algorithm-specific props
      category={category}
      selectedAlgorithmKey={selectedAlgorithmKey}
      viewMode={viewMode}
      setViewMode={handleViewModeChange}
      runMinimal={runMinimal}
      explanation={explanation}
      tracerData={tracerData}
      onBack={handleBack}
    />
  );
};

export default AlgorithmSelect;

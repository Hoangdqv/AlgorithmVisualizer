import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import EditorComponent from '../EditorComponent';
const AlgorithmSelect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category') || 'sorting';

  const [selectedLanguage, setSelectedLanguage] = useState('Python');
  const [output, setOutput] = useState('Select an algorithm to run...');
  const [code, setCode] = useState('// Loading algorithms...');
  const [explanation, setExplanation] = useState(''); // Store algorithm explanation
  const [tracerData, setTracerData] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const samplesCache = useRef({});
  const languages = ['Python', 'JavaScript'];

  const handleFileSelect = useCallback(async (algorithmKey) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/algorithms/${category}/${selectedLanguage}/${algorithmKey}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.code) {
        setCode(data.code);
        setOutput('');
        // Set explanation if available
        if (data.explanation) {
          setExplanation(data.explanation);
        } else {
          setExplanation('');
        }
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
  }, [category, selectedLanguage]);

  // Fetch algorithms for the category
  const loadCategoryAlgorithms = useCallback(async () => {
    const cacheKey = `${category}_${selectedLanguage}`;

    if (samplesCache.current[cacheKey]) {
      const cached = samplesCache.current[cacheKey];
      if (cached.length > 0) {
        handleFileSelect(cached[0].key);
      }
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/algorithms/${category}/${selectedLanguage}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.algorithms && data.algorithms.length > 0) {
        samplesCache.current[cacheKey] = data.algorithms;
        // Auto-load first algorithm
        handleFileSelect(data.algorithms[0].key);
      } else {
        samplesCache.current[cacheKey] = [];
        setCode(`// No ${selectedLanguage} algorithms available in ${category} category`);
      }
    } catch (error) {
      console.error('Failed to fetch algorithms:', error);
      setCode(`// Failed to load algorithms: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedLanguage, category, handleFileSelect]);

  useEffect(() => {
    loadCategoryAlgorithms();
  }, [loadCategoryAlgorithms]);

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleLanguageSelect = (language) => {
    setSelectedLanguage(language);
    setIsOpen(false);
  };

  const runCode = async () => {
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
          language: selectedLanguage.toLowerCase(),
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
  };

  const handleBack = () => {
    navigate('/algorithms');
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
      explanation={explanation}
      samplesCache={samplesCache}
      handleFileSelect={handleFileSelect}
      sidebarLanguageKey={`${category}_${selectedLanguage}`}
      tracerData={tracerData}
      onBack={handleBack}
    />
  );
};

export default AlgorithmSelect;

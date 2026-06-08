import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../auth/useAuth';
import Editor from '@monaco-editor/react';

export default function AdminPanel() {
  const { user } = useAuth();
  const [managementMode, setManagementMode] = useState('algorithms');
  const [algorithms, setAlgorithms] = useState([]);
  const [sampleCodeItems, setSampleCodeItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState(null);
  const [selectedSampleCode, setSelectedSampleCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [algorithmsLoading, setAlgorithmsLoading] = useState(true);
  const [sampleCodeLoading, setSampleCodeLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage('');
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);
  
  // Editing states
  const [creatingNew, setCreatingNew] = useState(false);
  const [creatingNewSampleCode, setCreatingNewSampleCode] = useState(false);
  const [editingExplanation, setEditingExplanation] = useState(false);
  // editingCode is based on database {langauge, item_name, content}
  // file(s) is based on frontend rendering name {language, filename, content}
  const [editingCode, setEditingCode] = useState(null);
  const [editingSampleCode, setEditingSampleCode] = useState(false);
  
  // Form states
  const [explanationText, setExplanationText] = useState('');
  const [newAlgoCategory, setNewAlgoCategory] = useState('');
  const [newAlgoName, setNewAlgoName] = useState('');
  const [newAlgoExplanation, setNewAlgoExplanation] = useState('');
  const [newSampleLanguage, setNewSampleLanguage] = useState('python');
  const [newSampleName, setNewSampleName] = useState('');
  const [newSampleDescription, setNewSampleDescription] = useState('');
  const [newSampleAwaitInput, setNewSampleAwaitInput] = useState(false);
  const [sampleCodeName, setSampleCodeName] = useState('');
  const [sampleCodeDescription, setSampleCodeDescription] = useState('');
  const [sampleCodeAwaitInput, setSampleCodeAwaitInput] = useState(false);
  const explanationUploadInputRef = useRef(null);
  const codeUploadInputRefs = useRef({});
  const sampleCodeUploadInputRef = useRef(null);

  // API cache
  const apiCache = useRef({
    algorithms: null,
    algorithmDetails: {},
    sampleCodeItems: null,
    sampleCodeDetails: {}
  });

  const filteredAlgorithms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return algorithms;
    }

    return algorithms.filter(algo =>
      algo.name.toLowerCase().includes(query) ||
      algo.display_name.toLowerCase().includes(query) ||
      algo.category.toLowerCase().includes(query)
    );
  }, [algorithms, searchQuery]);

  const filteredSampleCodeItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return sampleCodeItems;
    }

    return sampleCodeItems.filter(sample =>
      sample.name.toLowerCase().includes(query) ||
      sample.key.toLowerCase().includes(query) ||
      sample.language.toLowerCase().includes(query) ||
      (sample.description && sample.description.toLowerCase().includes(query))
    );
  }, [sampleCodeItems, searchQuery]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadCategories(), loadAlgorithms(), loadSampleCodeItems()]);
      } catch {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    if (user && user.role === 'admin') {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    setSearchQuery('');
    setError('');
    setMessage('');
  }, [managementMode]);


  const loadCategories = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/categories`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const loadAlgorithms = async () => {
    setAlgorithmsLoading(true);
    // Check cache first
    if (apiCache.current.algorithms) {
      setAlgorithms(apiCache.current.algorithms);
      setAlgorithmsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/algorithms`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        apiCache.current.algorithms = data.algorithms;
        setAlgorithms(data.algorithms);
      }
    } catch (err) {
      console.error('Failed to load algorithms:', err);
    } finally {
      setAlgorithmsLoading(false);
    }
  };

  const loadSampleCodeItems = async () => {
    setSampleCodeLoading(true);
    if (apiCache.current.sampleCodeItems) {
      setSampleCodeItems(apiCache.current.sampleCodeItems);
      setSampleCodeLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/admin/sample-code`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        apiCache.current.sampleCodeItems = data.samples;
        setSampleCodeItems(data.samples);
      }
    } catch (err) {
      console.error('Failed to load sample code:', err);
    } finally {
      setSampleCodeLoading(false);
    }
  };

  const loadAlgorithmDetails = async (category, name, bypassCache = false) => {
    const cacheKey = `${category}/${name}`;
    
    // Check cache first (unless bypassing)
    if (!bypassCache && apiCache.current.algorithmDetails[cacheKey]) {
      const cached = apiCache.current.algorithmDetails[cacheKey];
      setSelectedAlgorithm(cached);
      setExplanationText(cached.explanation || '');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/algorithms/${category}/${name}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (response.ok) {
        apiCache.current.algorithmDetails[cacheKey] = data;
        setSelectedAlgorithm(data);
        setExplanationText(data.explanation || '');
      } else {
        setError(data.error || 'Failed to load algorithm details');
      }
    } catch {
      setError('Failed to load algorithm details');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleCodeDetails = async (language, key, bypassCache = false) => {
    const cacheKey = `${language}/${key}`;

    if (!bypassCache && apiCache.current.sampleCodeDetails[cacheKey]) {
      const cached = apiCache.current.sampleCodeDetails[cacheKey];
      setSelectedSampleCode(cached);
      setSampleCodeName(cached.name || '');
      setSampleCodeDescription(cached.description || '');
      setSampleCodeAwaitInput(Boolean(cached.await_console_input));
      setEditingSampleCode(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/sample-code/${language}/${key}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (response.ok) {
        apiCache.current.sampleCodeDetails[cacheKey] = data;
        setSelectedSampleCode(data);
        setSampleCodeName(data.name || '');
        setSampleCodeDescription(data.description || '');
        setSampleCodeAwaitInput(Boolean(data.await_console_input));
        setEditingSampleCode(false);
      } else {
        setError(data.error || 'Failed to load sample code details');
      }
    } catch {
      setError('Failed to load sample code details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateExplanation = async () => {
    if (!selectedAlgorithm) return;
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/algorithms/${selectedAlgorithm.category}/${selectedAlgorithm.name}/explanation`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ explanation: explanationText }),
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setMessage('Explanation updated successfully!');
        setEditingExplanation(false);
        // Update the cached and displayed data immediately
        const cacheKey = `${selectedAlgorithm.category}/${selectedAlgorithm.name}`;
        const updatedAlgorithm = { ...selectedAlgorithm, explanation: explanationText };
        apiCache.current.algorithmDetails[cacheKey] = updatedAlgorithm;
        setSelectedAlgorithm(updatedAlgorithm);
      } else {
        setError(data.error || 'Failed to update explanation');
      }
    } catch {
      setError('Failed to update explanation');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCode = async (language, item_name) => {
    if (!selectedAlgorithm) return;
    
    // Fetch the code file content
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/algorithms/${selectedAlgorithm.category}/${selectedAlgorithm.name}/code/${language}/${item_name}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setEditingCode({ language, item_name, content: data.code });
      } else {
        setError('Failed to load code file');
      }
    } catch {
      setError('Error loading code file');
    }
  };

  const handleSaveCode = async () => {
    if (!selectedAlgorithm || !editingCode) return;
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/algorithms/${selectedAlgorithm.category}/${selectedAlgorithm.name}/code/${editingCode.language}/${editingCode.item_name}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ content: editingCode.content })
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setMessage('Code saved successfully!');
        setEditingCode(null);
        // Reload algorithm details to show updated content (bypass cache)
        await loadAlgorithmDetails(selectedAlgorithm.category, selectedAlgorithm.name, true);
      } else {
        setError(data.error || 'Failed to save code');
      }
    } catch {
      setError('Error saving code');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCodeEdit = () => {
    setEditingCode(null);
  };

  const handleSaveSampleCode = async () => {
    if (!selectedSampleCode) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/sample-code/${selectedSampleCode.language}/${selectedSampleCode.key}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: sampleCodeName,
            description: sampleCodeDescription,
            await_console_input: sampleCodeAwaitInput,
            content: selectedSampleCode.code
          })
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMessage('Sample code saved successfully!');
        setEditingSampleCode(false);
        const cacheKey = `${selectedSampleCode.language}/${selectedSampleCode.key}`;
        delete apiCache.current.sampleCodeDetails[cacheKey];
        apiCache.current.sampleCodeItems = null;
        await Promise.all([
          loadSampleCodeItems(),
          loadSampleCodeDetails(selectedSampleCode.language, selectedSampleCode.key, true)
        ]);
      } else {
        setError(data.error || 'Failed to save sample code');
      }
    } catch {
      setError('Error saving sample code');
    } finally {
      setLoading(false);
    }
  };

  const readUploadedText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result || ''));
      reader.onerror = () => reject(new Error('Failed to read uploaded file'));
      reader.readAsText(file);
    });
  };

  const handleExplanationFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setError('Explanation upload only accepts .txt files');
      return;
    }

    try {
      const text = await readUploadedText(file);
      setError('');
      setMessage(`Loaded explanation from ${file.name}. Click Save to persist.`);
      setExplanationText(text);
      setEditingExplanation(true);
    } catch {
      setError('Failed to read explanation file');
    }
  };

  const handleCodeFileUpload = async (event, language, item_name) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const expectedExt = language === 'python' ? '.py' : '.js';
    if (!file.name.toLowerCase().endsWith(expectedExt)) {
      setError(`Upload for ${language} must be a ${expectedExt} file`);
      return;
    }

    try {
      const text = await readUploadedText(file);
      setError('');
      setMessage(`Loaded ${file.name} into editor. Click Save to persist.`);
      setEditingCode({ language, item_name, content: text });
    } catch {
      setError('Failed to read uploaded code file');
    }
  };

  const handleSampleCodeFileUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !selectedSampleCode) return;

    const expectedExt = selectedSampleCode.language === 'python' ? '.py' : '.js';
    if (!file.name.toLowerCase().endsWith(expectedExt)) {
      setError(`Upload for ${selectedSampleCode.language} must be a ${expectedExt} file`);
      return;
    }

    try {
      const text = await readUploadedText(file);
      setError('');
      setMessage(`Loaded ${file.name} into editor. Click Save to persist.`);
      setSelectedSampleCode({ ...selectedSampleCode, code: text });
      setEditingSampleCode(true);
    } catch {
      setError('Failed to read uploaded code file');
    }
  };

  const handleCreateAlgorithm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/algorithms`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            category: newAlgoCategory,
            name: newAlgoName.toLowerCase().replace(/\s+/g, '_'),
            explanation: newAlgoExplanation,
          }),
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setMessage('Algorithm created successfully!');
        setCreatingNew(false);
        setNewAlgoCategory('');
        setNewAlgoName('');
        setNewAlgoExplanation('');
        // Invalidate cache and reload
        apiCache.current.algorithms = null;
        await loadAlgorithms();
      } else {
        setError(data.error || 'Failed to create algorithm');
      }
    } catch {
      setError('Failed to create algorithm');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSampleCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/sample-code`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            language: newSampleLanguage,
            name: newSampleName,
            description: newSampleDescription,
            await_console_input: newSampleAwaitInput,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMessage('Sample code created successfully!');
        setCreatingNewSampleCode(false);
        setNewSampleLanguage('python');
        setNewSampleName('');
        setNewSampleDescription('');
        setNewSampleAwaitInput(false);
        apiCache.current.sampleCodeItems = null;
        await loadSampleCodeItems();
        await loadSampleCodeDetails(data.sample.language, data.sample.key, true);
      } else {
        setError(data.error || 'Failed to create sample code');
      }
    } catch {
      setError('Failed to create sample code');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlgorithm = async (category, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/algorithms/${category}/${name}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        setMessage('Algorithm deleted successfully!');
        setSelectedAlgorithm(null);
        // Invalidate caches and reload
        apiCache.current.algorithms = null;
        const cacheKey = `${category}/${name}`;
        delete apiCache.current.algorithmDetails[cacheKey];
        await loadAlgorithms();
      } else {
        setError(data.error || 'Failed to delete algorithm');
      }
    } catch {
      setError('Failed to delete algorithm');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSampleCode = async (language, key, name) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/admin/sample-code/${language}/${key}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json();
      if (response.ok) {
        setMessage('Sample code deleted successfully!');
        setSelectedSampleCode(null);
        setEditingSampleCode(false);
        apiCache.current.sampleCodeItems = null;
        const cacheKey = `${language}/${key}`;
        delete apiCache.current.sampleCodeDetails[cacheKey];
        await loadSampleCodeItems();
      } else {
        setError(data.error || 'Failed to delete sample code');
      }
    } catch {
      setError('Failed to delete sample code');
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="admin-container">
        <div className="admin-card">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-card">
        <h2>Sample Management</h2>
        <div className="info-and-messages">
          <p>Use this panel to manage sample algorithms and sample code.</p>
        {message && <div className="success-alert">{message}</div>}
        {error && <div className="error-alert">{error}</div>}
        </div>

        <div className="admin-mode-toggle">
          <button
            type="button"
            className={`admin-mode-button ${managementMode === 'algorithms' ? 'active' : ''}`}
            onClick={() => setManagementMode('algorithms')}
          >
            Sample Algorithms
          </button>
          <button
            type="button"
            className={`admin-mode-button ${managementMode === 'sampleCode' ? 'active' : ''}`}
            onClick={() => setManagementMode('sampleCode')}
          >
            Sample Code
          </button>
        </div>

        <div className="admin-layout">
          {/* Sidebar - Algorithm List */}
          <div>
              <div className="sidebar-header">
                <h3>{managementMode === 'algorithms' ? 'Algorithms' : 'Code Samples'}</h3>
                {managementMode === 'algorithms' && (
                  <button
                    className="modal-button primary"
                    onClick={() => setCreatingNew(true)}
                  >
                    + New
                  </button>
                )}
                {managementMode === 'sampleCode' && (
                  <button
                    className="modal-button primary"
                    onClick={() => setCreatingNewSampleCode(true)}
                  >
                    + New
                  </button>
                )}
              </div>
              <div className="search-bar-container">
                  <input
                    name="search-bar-input"
                    className="search-bar-input"
                    type="text"
                    placeholder={managementMode === 'algorithms' ? 'Search algorithms...' : 'Search sample code...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </div>
            <div className="admin-sidebar">
              
              <div className="algorithm-list">
                {managementMode === 'algorithms' && algorithmsLoading ? (
                  <div className="sidebar-loading">Loading algorithm list...</div>
                ) : managementMode === 'algorithms' && filteredAlgorithms.length > 0 ? (
                  filteredAlgorithms.map((algo) => (
                    <div
                      key={`${algo.category}-${algo.name}`}
                      className={`algorithm-item ${
                        selectedAlgorithm?.category === algo.category && selectedAlgorithm?.name === algo.name ? 'active' : ''
                      }`}
                      onClick={() => loadAlgorithmDetails(algo.category, algo.name)}
                    >
                      <div className="algo-name">{algo.display_name}</div>
                      <div className="algo-category">{algo.category}</div>
                    </div>
                  ))
                ) : managementMode === 'sampleCode' && sampleCodeLoading ? (
                  <div className="sidebar-loading">Loading sample code list...</div>
                ) : managementMode === 'sampleCode' && filteredSampleCodeItems.length > 0 ? (
                  filteredSampleCodeItems.map((sample) => (
                    <div
                      key={`${sample.language}-${sample.key}`}
                      className={`algorithm-item ${
                        selectedSampleCode?.language === sample.language && selectedSampleCode?.key === sample.key ? 'active' : ''
                      }`}
                      onClick={() => loadSampleCodeDetails(sample.language, sample.key)}
                    >
                      <div className="algo-name">{sample.display_name}</div>
                      <div className="algo-category">{sample.language}</div>
                    </div>
                  ))
                ) : (
                  <div className="sidebar-message">
                    {managementMode === 'algorithms' ? 'No algorithms found.' : 'No sample code found.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Selected Item Details */}
          <div className="admin-content">
            {managementMode === 'algorithms' && selectedAlgorithm ? (
              <>
                <div className="algorithm-header">
                  <h3>{selectedAlgorithm.display_name}</h3>
                  <button
                    className="modal-button secondary"
                    onClick={() =>
                      handleDeleteAlgorithm(
                        selectedAlgorithm.category,
                        selectedAlgorithm.name
                      )
                    }
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>

                {/* Explanation Section */}
                <div className="admin-section">
                  <div className="section-header">
                    <h4>Explanation</h4>
                    {!editingExplanation && (
                      <div className="code-edit-actions">
                        <button
                          className="modal-button primary"
                          onClick={() => setEditingExplanation(true)}
                        >
                          Edit
                        </button>
                        <button
                          className="modal-button secondary"
                          onClick={() => explanationUploadInputRef.current?.click()}
                        >
                          Upload a file
                        </button>
                        <input
                          ref={explanationUploadInputRef}
                          type="file"
                          accept=".txt,text/plain"
                          style={{ display: 'none' }}
                          onChange={handleExplanationFileUpload}
                        />
                      </div>
                    )}
                    {editingExplanation && (
                      <div className="code-edit-actions">
                        <button
                          className="modal-button primary"
                          onClick={handleUpdateExplanation}
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          className="modal-button secondary"
                          onClick={() => {
                            setEditingExplanation(false);
                            setExplanationText(selectedAlgorithm.explanation || '');
                          }}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {editingExplanation ? (
                    <>
                      <textarea
                        className="admin-textarea"
                        value={explanationText}
                        onChange={(e) => setExplanationText(e.target.value)}
                        rows={25}
                      />
                    </>
                  ) : (
                    <pre className="explanation-preview">{selectedAlgorithm.explanation}</pre>
                  )}
                </div>

                {/* Code Files Section */}
                <div className="admin-section">
                  <h4>Code Files</h4>
                  
                  {Object.entries(selectedAlgorithm.languages).map(([language, files]) => (

                    <div key={language} className="language-section">
                      <h5>{language.charAt(0).toUpperCase() + language.slice(1)}</h5>
                      {files.map((file) => (
                        <div key={file.filename} className="code-file">
                          <div className="file-header">
                            <span className="file_name">{file.filename}</span>
                            {(() => {
                              const refKey = `${language}/${file.filename}`;
                              return (
                                <input
                                  ref={(element) => {
                                    if (element) {
                                      codeUploadInputRefs.current[refKey] = element;
                                    }
                                  }}
                                  type="file"
                                  accept={language === 'python' ? '.py,text/x-python' : '.js,text/javascript,application/javascript'}
                                  style={{ display: 'none' }}
                                  onChange={(event) => handleCodeFileUpload(event, language, file.filename)}
                                />
                              );
                            })()}
                            {editingCode && editingCode.language === language && editingCode.item_name === file.filename ? (
                              <div className="code-edit-actions">
                                <button
                                  className="modal-button primary"
                                  onClick={handleSaveCode}
                                  disabled={loading}
                                >
                                  {loading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  className="modal-button secondary"
                                  onClick={handleCancelCodeEdit}
                                  disabled={loading}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="modal-button secondary"
                                  onClick={() => codeUploadInputRefs.current[`${language}/${file.filename}`]?.click()}
                                  disabled={loading}
                                >
                                  Upload a file
                                </button>
                              </div>
                            ) : (
                              <div className="code-edit-actions">
                                <button
                                  className="modal-button primary"
                                  onClick={() => handleEditCode(language, file.filename)}
                                >
                                  Edit Code
                                </button>
                                <button
                                  className="modal-button secondary"
                                  onClick={() => codeUploadInputRefs.current[`${language}/${file.filename}`]?.click()}
                                >
                                  Upload a file
                                </button>
                              </div>
                            )}
                          </div>
                          {editingCode && editingCode.language === language && editingCode.item_name === file.filename ? (
                            <div className="code-editor-container">
                              <Editor
                                height="400px"
                                language={language}
                                value={editingCode.content}
                                onChange={(value) => setEditingCode({ ...editingCode, content: value || '' })}
                                theme="vs-dark"
                                options={{
                                  fontSize: 14,
                                  minimap: { enabled: false },
                                  automaticLayout: true,
                                }}
                              />
                            </div>
                          ) : (
                            <pre className="code-preview">{file.content}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : managementMode === 'sampleCode' && selectedSampleCode ? (
              <>
                <div className="algorithm-header">
                  <div>
                    <h3>{selectedSampleCode.display_name}</h3>
                    <div className="algo-category">
                      {selectedSampleCode.language}
                    </div>
                  </div>
                  {!editingSampleCode ? (
                    <div className="code-edit-actions">
                      <button
                        className="modal-button primary"
                        onClick={() => setEditingSampleCode(true)}
                      >
                        Edit
                      </button>
                      <button
                        className="modal-button secondary"
                        onClick={() => sampleCodeUploadInputRef.current?.click()}
                      >
                        Upload a file
                      </button>
                      <button
                        className="modal-button secondary"
                        onClick={() =>
                          handleDeleteSampleCode(
                            selectedSampleCode.language,
                            selectedSampleCode.key,
                            selectedSampleCode.display_name
                          )
                        }
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <div className="code-edit-actions">
                      <button
                        className="modal-button primary"
                        onClick={handleSaveSampleCode}
                        disabled={loading}
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="modal-button secondary"
                        onClick={() => loadSampleCodeDetails(selectedSampleCode.language, selectedSampleCode.key)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <input
                  ref={sampleCodeUploadInputRef}
                  type="file"
                  accept={selectedSampleCode.language === 'python' ? '.py,text/x-python' : '.js,text/javascript,application/javascript'}
                  style={{ display: 'none' }}
                  onChange={handleSampleCodeFileUpload}
                />

                <div className="admin-section">
                  {editingSampleCode ? (
                    <div className="sample-code-form">
                      <div className="form-group">
                        <label htmlFor="sample-code-name">Name:</label>
                        <input
                          id="sample-code-name"
                          className="modal-input"
                          value={sampleCodeName}
                          onChange={(e) => setSampleCodeName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="sample-code-description">Description:</label>
                        <input
                          id="sample-code-description"
                          className="modal-input"
                          value={sampleCodeDescription}
                          onChange={(e) => setSampleCodeDescription(e.target.value)}
                        />
                      </div>
                      <label className="sample-code-checkbox">
                        <input
                          type="checkbox"
                          checked={sampleCodeAwaitInput}
                          onChange={(e) => setSampleCodeAwaitInput(e.target.checked)}
                        />
                        Await console input
                      </label>
                    </div>
                  ) : (
                    <div className="sample-code-details">
                      <div><strong>Description:</strong> {selectedSampleCode.description || 'No description'}</div>
                      <div><strong>Await console input:</strong> {selectedSampleCode.await_console_input ? 'Yes' : 'No'}</div>
                    </div>
                  )}
                </div>

                <div className="admin-section">
                  <h4>Code</h4>
                  {editingSampleCode ? (
                    <div className="code-editor-container">
                      <Editor
                        height="500px"
                        language={selectedSampleCode.language}
                        value={selectedSampleCode.code}
                        onChange={(value) => setSelectedSampleCode({ ...selectedSampleCode, code: value || '' })}
                        theme="vs-dark"
                        options={{
                          fontSize: 14,
                          minimap: { enabled: false },
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  ) : (
                    <pre className="code-preview">{selectedSampleCode.code}</pre>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>
                  {managementMode === 'algorithms'
                    ? 'Select an algorithm to view and edit details'
                    : 'Select a code sample to view and edit details'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create New Algorithm Modal */}
      {creatingNew && (
        <div className="modal-overlay" onClick={() => setCreatingNew(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Algorithm</h3>
              <button className="modal-close" onClick={() => setCreatingNew(false)}>
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreateAlgorithm} className="modal-body">
              <div className="form-group">
                <label htmlFor="category">Category:</label>
                <select
                  id="category"
                  className="modal-select"
                  value={newAlgoCategory}
                  onChange={(e) => setNewAlgoCategory(e.target.value)}
                  required
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="name">Algorithm Name:</label>
                <input
                  type="text"
                  id="name"
                  className="modal-input"
                  value={newAlgoName}
                  onChange={(e) => setNewAlgoName(e.target.value)}
                  placeholder="e.g., merge_sort"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="explanation">Initial Explanation (optional):</label>
                <textarea
                  id="explanation"
                  className="modal-input"
                  value={newAlgoExplanation}
                  onChange={(e) => setNewAlgoExplanation(e.target.value)}
                  rows={7}
                />
              </div>
              
              <div className="modal-footer">
                <button
                  type="submit"
                  className="modal-button primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  className="modal-button secondary"
                  onClick={() => setCreatingNew(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Sample Code Modal */}
      {creatingNewSampleCode && (
        <div className="modal-overlay" onClick={() => setCreatingNewSampleCode(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Sample Code</h3>
              <button className="modal-close" onClick={() => setCreatingNewSampleCode(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateSampleCode} className="modal-body">
              <div className="form-group">
                <label htmlFor="sample-language">Language:</label>
                <select
                  id="sample-language"
                  className="modal-select"
                  value={newSampleLanguage}
                  onChange={(e) => setNewSampleLanguage(e.target.value)}
                  required
                >
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="sample-name">Name:</label>
                <input
                  type="text"
                  id="sample-name"
                  className="modal-input"
                  value={newSampleName}
                  onChange={(e) => setNewSampleName(e.target.value)}
                  placeholder="e.g., Matrix Multiply"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="sample-description">Description:</label>
                <input
                  type="text"
                  id="sample-description"
                  className="modal-input"
                  value={newSampleDescription}
                  onChange={(e) => setNewSampleDescription(e.target.value)}
                />
              </div>

              <label className="sample-code-checkbox">
                <input
                  type="checkbox"
                  checked={newSampleAwaitInput}
                  onChange={(e) => setNewSampleAwaitInput(e.target.checked)}
                />
                Await console input
              </label>

              <div className="modal-footer">
                <button
                  type="submit"
                  className="modal-button primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  className="modal-button secondary"
                  onClick={() => setCreatingNewSampleCode(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

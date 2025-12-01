// Sidebar.jsx
import { useState, useEffect, useMemo } from 'react';
import SearchBar from './SearchBar';

const Sidebar = ({ onFileSelect, selectedLanguage, samplesCache}) => {
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (samplesCache.current[selectedLanguage]) {
      setSamples(samplesCache.current[selectedLanguage]);
      setOpenDropdowns({ 'samples': true });
      return;
    }

    // Load samples if not cached
    const loadSamples = async () => {
      setLoading(true);
      try {
        // Check if this is a category-based request (format: "category_language")
        const isCategoryRequest = selectedLanguage.includes('_');
        let response;
        
        if (isCategoryRequest) {
          // Category-based algorithm loading (e.g., "sorting_python")
          const [category, language] = selectedLanguage.split('_');
          response = await fetch(
            `http://localhost:5000/api/category/${category}/algorithms/${language}`
          );
        } else {
          // Regular sample code loading
          response = await fetch(
            `http://localhost:5000/api/samples/${selectedLanguage.toLowerCase()}`
          );
        }
        
        const data = await response.json();

        if (response.ok) {
          // Handle both formats: { samples: [...] } or { algorithms: [...] }
          const items = data.samples || data.algorithms || [];
          setSamples(items);
          // Store in cache
          samplesCache.current[selectedLanguage] = items;
          // Auto-open the samples folder when language changes
          setOpenDropdowns({ 'samples': true });
        } else {
          console.error('Failed to load samples:', data.error);
          setSamples([]);
        }
      } catch (error) {
        console.error('Error fetching samples:', error);
        setSamples([]);
      } finally {
        setLoading(false);
      }
    };
    loadSamples();
  }, [selectedLanguage, samplesCache]);

  useEffect(() => {
    setSearchQuery('');
  }, [selectedLanguage]);

  const filteredSamples = useMemo(() => {
    if (!searchQuery.trim()) {
      return samples;
    }
    const query = searchQuery.toLowerCase();
    return samples.filter(sample => 
      sample.name.toLowerCase().includes(query) ||
      (sample.description && sample.description.toLowerCase().includes(query))
    );
  }, [samples, searchQuery]);

  const toggleFileDropdown = (folderName) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const handleFileClick = (sampleKey) => {
    if (onFileSelect) {
      onFileSelect(sampleKey);
    }
  };

  return (
    <div className="sidebar">
      <div className="file-explorer">
        <h3 style={{ color: 'white', marginBottom: '1rem', fontSize: '16px' }}>
          {selectedLanguage.includes('_') 
            ? `${selectedLanguage.split('_')[0].charAt(0).toUpperCase() + selectedLanguage.split('_')[0].slice(1)} Algorithms`
            : `${selectedLanguage} Samples`
          }
        </h3>
        <SearchBar 
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={`Search ${selectedLanguage.includes('_') ? 'algorithms' : 'samples'}...`}
        />
        <hr style={{ borderColor: '#333', margin: '1rem 0' }} />

        {loading ? (
          <div style={{ color: '#888', padding: '1rem' }}>Loading samples...</div>
        ) : (
          <div style={{ marginBottom: '0.5rem' }}>
            <button
              onClick={() => toggleFileDropdown('samples')}
              className='folder-button'
            >
              <span>
                📁 {selectedLanguage.includes('_') ? 'Algorithms' : 'Code Samples'} 
                ({filteredSamples.length}{searchQuery && samples.length !== filteredSamples.length ? ` of ${samples.length}` : ''})
              </span>
            </button>

            {openDropdowns['samples'] && (
              <div style={{
                marginTop: '0.25rem',
                marginLeft: '1rem',
                backgroundColor: '#1e1e1e',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                {filteredSamples.length === 0 ? (
                  <div style={{
                    padding: '0.5rem',
                    color: '#888',
                    fontSize: '14px'
                  }}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'No samples available'}
                  </div>
                ) : (
                  filteredSamples.map((sample) => (
                    <button
                      key={sample.key}
                      onClick={() => handleFileClick(sample.key)}
                      className='file-button'
                      title={sample.description}
                    >
                      <div>📄 {sample.name}</div>
                      {sample.description && (
                        <div style={{
                          fontSize: '12px',
                          color: '#888',
                          marginTop: '2px',
                          marginLeft: '20px'
                        }}>
                          {sample.description}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
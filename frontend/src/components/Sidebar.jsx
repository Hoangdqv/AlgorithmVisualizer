// Sidebar.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/useAuth';
import SearchBar from './SearchBar';
import FileTree from './FileTree';
import FileContextMenu from './FileContextMenu';
import NewItemModal from './NewItemModal';

const Sidebar = ({ onFileSelect, selectedLanguage, samplesCache, onUserFileSelect }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('samples'); // 'samples' or 'myfiles'
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [samples, setSamples] = useState([]);
  const [userFolders, setUserFolders] = useState([]);
  const [userFiles, setUserFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [languages, setLanguages] = useState([]);

  // Load available languages
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/languages', {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setLanguages(data.languages || []);
        }
      } catch (error) {
        console.error('Error loading languages:', error);
      }
    };
    loadLanguages();
  }, []);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const isCategoryRequest = selectedLanguage.includes('_');
      let response;
      
      if (isCategoryRequest) {
        const [category, language] = selectedLanguage.split('_');
        response = await fetch(
          `http://localhost:5000/api/algorithms/${category}/${language}`
        );
      } else {
        response = await fetch(
          `http://localhost:5000/api/samples/${selectedLanguage.toLowerCase()}`
        );
      }
      
      const data = await response.json();

      if (response.ok) {
        const items = data.samples || data.algorithms || [];
        setSamples(items);
        samplesCache.current[selectedLanguage] = items;
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
  }, [selectedLanguage, samplesCache]);

  const loadUserFiles = useCallback(async () => {
    setLoading(true);
    try {
      // Load all folders
      const foldersResponse = await fetch('http://localhost:5000/api/user/folders', {
        credentials: 'include'
      });
      
      let allFolders = [];
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        const rootFolders = foldersData.folders || [];
        
        // Get tree for each root folder
        const trees = await Promise.all(
          rootFolders.map(async (folder) => {
            try {
              const treeResponse = await fetch(
                `http://localhost:5000/api/user/folders/${folder.folder_id}/tree`,
                { credentials: 'include' }
              );
              
              if (treeResponse.ok) {
                const treeData = await treeResponse.json();
                return buildFolderHierarchy(treeData.tree);
              }
              return folder;
            } catch (error) {
              console.error('Error loading tree:', error);
              return folder;
            }
          })
        );
        
        // Filter out null values and flatten into array
        allFolders = trees.filter(t => t !== null);
      }
      
      setUserFolders(allFolders);

      // Load all files
      const filesResponse = await fetch('http://localhost:5000/api/user/files', {
        credentials: 'include'
      });
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        setUserFiles(filesData.files || []);
      }
    } catch (error) {
      console.error('Error loading user files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

    // Load samples when on samples tab
  useEffect(() => {
    if (activeTab === 'samples') {
      if (samplesCache.current[selectedLanguage]) {
        setSamples(samplesCache.current[selectedLanguage]);
        setOpenDropdowns({ 'samples': true });
        return;
      }
      loadSamples();
    }
  }, [selectedLanguage, activeTab, loadSamples, samplesCache]);

  // Load user files when on myfiles tab
  useEffect(() => {
    if (activeTab === 'myfiles' && user) {
      loadUserFiles();
    }
  }, [activeTab, user, loadUserFiles]);
  
  const buildFolderHierarchy = (treeNodes) => {
    if (!treeNodes || treeNodes.length === 0) return null;
    
    // Create a map of all nodes
    const nodeMap = {};
    treeNodes.forEach(node => {
      nodeMap[node.folder_id] = { 
        ...node, 
        children: [],
        files: node.files || [] // Ensure files array exists
      };
    });

    // Build parent-child relationships
    const roots = [];
    treeNodes.forEach(node => {
      if (node.depth === 0) {
        // This is a root folder
        roots.push(nodeMap[node.folder_id]);
      } else {
        // Find the parent (depth - 1)
        const parentNode = treeNodes.find(n => 
          n.depth === node.depth - 1 && 
          n.folder_id !== node.folder_id
        );
        
        if (parentNode && nodeMap[parentNode.folder_id]) {
          // Add this node as a child of the parent
          if (!nodeMap[parentNode.folder_id].children.includes(nodeMap[node.folder_id])) {
            nodeMap[parentNode.folder_id].children.push(nodeMap[node.folder_id]);
          }
        }
      }
    });

    return roots.length > 0 ? roots[0] : null;
  };

  useEffect(() => {
    setSearchQuery('');
  }, [selectedLanguage, activeTab]);

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

  // Filter user files and folders based on search query
  const filteredUserData = useMemo(() => {
    if (!searchQuery.trim()) {
      return { folders: userFolders, files: userFiles };
    }
    
    const query = searchQuery.toLowerCase();
    
    // Recursively filter folders and their nested content
    const filterFolder = (folder) => {
      const matchesSearch = folder.folder_name?.toLowerCase().includes(query) || 
                           folder.name?.toLowerCase().includes(query);
      
      // Filter files in this folder
      const filteredFiles = (folder.files || []).filter(file => 
        file.file_name?.toLowerCase().includes(query)
      );
      
      // Recursively filter children folders
      const filteredChildren = (folder.children || [])
        .map(child => filterFolder(child))
        .filter(child => child !== null);
      
      // Include folder if it matches, has matching files, or has matching children
      if (matchesSearch || filteredFiles.length > 0 || filteredChildren.length > 0) {
        return {
          ...folder,
          files: filteredFiles,
          children: filteredChildren
        };
      }
      
      return null;
    };
    
    const filteredFolders = userFolders
      .map(folder => filterFolder(folder))
      .filter(folder => folder !== null);
    
    const filteredFiles = userFiles.filter(file => 
      !file.folder_id && file.file_name?.toLowerCase().includes(query)
    );
    
    return { folders: filteredFolders, files: filteredFiles };
  }, [userFolders, userFiles, searchQuery]);

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

  const handleUserFileClick = async (fileId) => {
    setSelectedFileId(fileId);
    try {
      const response = await fetch(`http://localhost:5000/api/user/files/${fileId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (onUserFileSelect) {
          onUserFileSelect(data.file);
        }
      }
    } catch (error) {
      console.error('Error loading user file:', error);
    }
  };

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      type
    });
  };

  const handleCreateFolder = async (name, parentId = null) => {
    const checkDuplicateInFolder = (folders, targetParentId) => {
      if (!targetParentId) {
        // Check root level - compare by folder_name
        return folders.some(f => (f.folder_name) === name);
      }
      
      // Recursively search for the parent folder
      for (const folder of folders) {
        if (folder.folder_id === targetParentId) {
          return (folder.children || []).some(f => (f.folder_name) === name);
        }
        if (folder.children && folder.children.length > 0) {
          const found = checkDuplicateInFolder(folder.children, targetParentId);
          if (found !== null) return found;
        }
      }
      return false;
    };
    
    if (checkDuplicateInFolder(userFolders, parentId)) {
      alert(`A folder named "${name}" already exists in this location.`);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/user/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          folder_name: name, 
          parent_folder_id: parentId 
        })
      });
      
      if (response.ok) {
        loadUserFiles();
        setModal(null);
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to create folder'}`);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder. Please try again.');
    }
  };

  const handleCreateFile = async (name, languageId, folderId = null) => {
    // Check for duplicate file names in the same folder
    const filesInFolder = folderId
      ? userFiles.filter(f => f.folder_id === folderId)
      : userFiles.filter(f => !f.folder_id);
    
    if (filesInFolder.some(f => f.file_name === name)) {
      alert(`A file named "${name}" already exists in this location.`);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/user/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          file_name: name,
          folder_id: folderId,
          language_id: languageId,
          content: ''
        })
      });
      
      if (response.ok) {
        loadUserFiles();
        setModal(null);
      }
    } catch (error) {
      console.error('Error creating file:', error);
    }
  };

  const handleDelete = async () => {
    if (!contextMenu) return;
    
    try {
      const endpoint = contextMenu.type === 'folder'
        ? `http://localhost:5000/api/user/folders/${contextMenu.item.folder_id}`
        : `http://localhost:5000/api/user/files/${contextMenu.item.file_id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        loadUserFiles();
        setContextMenu(null);
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleRename = async (newName, item, itemType) => {
    if (!item || !itemType) {
      console.log('Missing item or itemType');
      return;
    }
    
    console.log('Renaming:', { newName, item, itemType });
    
    try {
      const endpoint = itemType === 'folder'
        ? `http://localhost:5000/api/user/folders/${item.folder_id}`
        : `http://localhost:5000/api/user/files/${item.file_id}`;
      
      const body = itemType === 'folder'
        ? { folder_name: newName }
        : { file_name: newName };
      
      console.log('Rename request:', { endpoint, body });
      
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      
      console.log('Rename response:', response.status, response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Rename success:', data);
        loadUserFiles();
        setModal(null);
      } else {
        const errorData = await response.json();
        console.error('Rename failed:', errorData);
        alert(`Error: ${errorData.error || 'Failed to rename'}`);
      }
    } catch (error) {
      console.error('Error renaming:', error);
      alert('Failed to rename. Please try again.');
    }
  };

  return (
    <div className="sidebar">
      <div className="file-explorer">
        {/* Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`tab-button ${activeTab === 'samples' ? 'active' : ''}`}
            onClick={() => setActiveTab('samples')}
          >
            Samples
          </button>
          {user && onUserFileSelect && (
            <button
              className={`tab-button ${activeTab === 'myfiles' ? 'active' : ''}`}
              onClick={() => setActiveTab('myfiles')}
            >
              My Files
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'samples' ? (
          // Samples Tab Content
          <>
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
          </>
        ) : (
          // My Files Tab Content
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}
            onContextMenu={handleContextMenu}>
              <h3 style={{ color: 'white', fontSize: '16px', margin: 0 }}>
                My Files
              </h3>
            </div>
            <SearchBar 
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search my files..."
            />

            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />
              <div className= "create-button-group">
                <button
                  className="icon-button"
                  onClick={() => setModal({ type: 'create-folder', parentId: null })}
                  title="New Folder"
                >
                  📁 New folder
                </button>
                <button
                  className="icon-button"
                  onClick={() => setModal({ type: 'create-file', folderId: null })}
                  title="New File"
                >
                  📄 New file
                </button>
              </div>
            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />

            {!user ? (
              <div style={{ color: '#888', padding: '1rem', textAlign: 'center' }}>
                Please log in to access your files
              </div>
            ) : loading ? (
              <div style={{ color: '#888', padding: '1rem' }}>Loading files...</div>
            ) : (
              <>
                <FileTree
                  folders={filteredUserData.folders}
                  files={filteredUserData.files.filter(f => !f.folder_id)}
                  onFileClick={handleUserFileClick}
                  onFolderClick={() => {}}
                  onContextMenu={handleContextMenu}
                  selectedFileId={selectedFileId}
                  languages={languages}
                  depth={0}
                />
                {filteredUserData.folders.length === 0 && filteredUserData.files.filter(f => !f.folder_id).length === 0 && (
                  <div style={{ color: '#888', padding: '1rem', textAlign: 'center' }}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'No files yet. Create a folder or file to get started!'}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          onClose={() => setContextMenu(null)}
          onNewFile={() => {
            setModal({
              type: 'create-file',
              folderId: contextMenu.type === 'folder' ? contextMenu.item.folder_id : null
            });
            setContextMenu(null);
          }}
          onNewFolder={() => {
            setModal({
              type: 'create-folder',
              parentId: contextMenu.type === 'folder' ? contextMenu.item.folder_id : null
            });
            setContextMenu(null);
          }}
          onRename={() => {
            setModal({
              type: 'rename',
              item: contextMenu.item,
              itemType: contextMenu.type
            });
            setContextMenu(null);
          }}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {modal && (
        <NewItemModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          onSubmit={(data) => {
            if (modal.type === 'create-folder') {
              handleCreateFolder(data.name || data, modal.parentId);
            } else if (modal.type === 'create-file') {
              handleCreateFile(data.name || data, data.language_id || data.languageId || 1, modal.folderId);
            } else if (modal.type === 'rename') {
              handleRename(data.name || data, modal.item, modal.itemType);
            }
          }}
          type={modal.type}
          title={modal.type === 'rename' ? `Rename ${modal.itemType === 'folder' ? 'Folder' : 'File'}` : undefined}
          initialValue={modal.type === 'rename' ? (modal.itemType === 'folder' ? (modal.item.folder_name || modal.item.name) : (modal.item.file_name || modal.item.filename)) : ''}
          languages={languages}
        />
      )}
    </div>
  );
};

export default Sidebar;

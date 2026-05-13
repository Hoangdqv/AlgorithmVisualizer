// Sidebar.jsx
import { useState, useEffect, useMemo, useCallback } from 'react';
import getFileExtension from '../../scripts/getFileExtension';
import { useAuth } from '../../context/useAuth';
import SearchBar from '../SearchBar';
import FileTree from '../FileTree';
import FileContextMenu from '../FileContextMenu';
import NewItemModal from '../NewItemModal';
import useFileTreeMoveHandlers from '../../hooks/useFileTreeMoveHandlers';

const Sidebar = ({ onFileSelect, selectedLanguage: currentLanguage, apiCache, onUserFileSelect, initialTab = 'samples', selectedUserFileId = null }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // 'samples' or 'myfiles'
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [samples, setSamples] = useState([]);
  const [userFolders, setUserFolders] = useState([]);
  const [userFiles, setUserFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [selectedSampleKey, setSelectedSampleKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const [languages, setLanguages] = useState([]);

  const [dragContext, setDragContext] = useState({
    dragOverTarget: null,
    isDragging: false,
    dragSource: null,
  });
  const API_URL = import.meta.env.VITE_API_URL;

  // Load available languages
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const response = await fetch(`${API_URL}/languages`, {
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
  }, [API_URL]);

  const loadSamples = useCallback(async () => {
    setLoading(true);
    try {
      const isCategoryRequest = currentLanguage.includes('_');
      let response;
      
      if (isCategoryRequest) {
        const [category, language] = currentLanguage.split('_');
        response = await fetch(
          `${API_URL}/algorithms/${category}/${language}`
        );
      } else {
        response = await fetch(
          `${API_URL}/samples/${currentLanguage.toLowerCase()}`
        );
      }
      
      const data = await response.json();

      if (response.ok) {
        const items = data.samples || data.algorithms || [];
        setSamples(items);
        apiCache.current.lists[currentLanguage] = items;
        setSelectedSampleKey((prevKey) => {
          if (prevKey && items.some((item) => item.key === prevKey)) {
            return prevKey;
          }
          return null;
        });
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
  }, [currentLanguage, apiCache, API_URL]);

  const loadUserFiles = useCallback(async (forceReload = false, silent = false) => {
    if (!apiCache.current.userFilesData) {
      apiCache.current.userFilesData = { folders: null, files: null };
    }

    if (!apiCache.current.userFileContent) {
      apiCache.current.userFileContent = {};
    }

    // Check shared cache first
    if (!forceReload && apiCache.current.userFilesData.folders && apiCache.current.userFilesData.files) {
      setUserFolders(apiCache.current.userFilesData.folders);
      setUserFiles(apiCache.current.userFilesData.files);
      return;
    }
    
    if (!silent) {
      setLoading(true);
    }
    try {
      // Load all folders
      const foldersResponse = await fetch(`${API_URL}/user/folders`, {
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
                `${API_URL}/user/folders/${folder.folder_id}/tree`,
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

        allFolders = trees.filter(t => t !== null);
      }
    

      // Load all files
      const filesResponse = await fetch(`${API_URL}/user/files`, {
        credentials: 'include'
      });
      
      let allFiles = [];
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        allFiles = filesData.files || [];

      }

      setUserFolders(allFolders);
      setUserFiles(allFiles);
      apiCache.current.userFilesData = {
        folders: allFolders,
        files: allFiles,
      };

    } catch (error) {
      console.error('Error loading user files:', error);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [apiCache, API_URL]);

    const isDragSourceTarget = useCallback(
    (targetType, targetId) => (
      dragContext.dragSource
      && dragContext.dragSource.type === targetType
      && dragContext.dragSource.id === targetId
    ),
    [dragContext.dragSource]
  );

  const isRootDropTarget = dragContext.dragOverTarget === 'root:root'
    && !isDragSourceTarget('folder', null);


    // Load samples when on samples tab
  useEffect(() => {
    if (activeTab === 'samples') {
      if (apiCache.current.lists[currentLanguage]) {
        //Cache the current list that was fetched for the selected lang
        const cachedItems = apiCache.current.lists[currentLanguage];
        setSamples(cachedItems);
        // If the previously selected sample still exists in the new list, keep it selected when lang changes
        setSelectedSampleKey((prevKey) => {
          if (prevKey && cachedItems.some((item) => item.key === prevKey)) {
            return prevKey;
          }
          return null;
        });
        setOpenDropdowns({ 'samples': true });
        return;
      }
      loadSamples();
    }
  }, [currentLanguage, activeTab, loadSamples, apiCache, API_URL]);

  // Load user files when on myfiles tab
  useEffect(() => {
    if (activeTab === 'myfiles' && user) {
      loadUserFiles();
    }
  }, [activeTab, user, loadUserFiles, API_URL]);

  const buildFolderHierarchy = (treeNodes) => {
    if (!treeNodes || treeNodes.length === 0) return null;
    
    // Create a map of all nodes
    const nodeMap = {};
    treeNodes.forEach(node => {
      nodeMap[node.folder_id] = { 
        ...node, 
        children: [],
        files: node.files || []
      };
    });

    // Build parent-child relationships using parent_item_id
    const roots = [];
    treeNodes.forEach(node => {
      if (node.depth === 0) {
        // Root folder
        roots.push(nodeMap[node.folder_id]);
      } else {
        // Find the parent using parent_item_id
        const parentId = node.parent_item_id;
        
        if (parentId && nodeMap[parentId]) {
          // Add this node as a child of the parent
          if (!nodeMap[parentId].children.includes(nodeMap[node.folder_id])) {
            nodeMap[parentId].children.push(nodeMap[node.folder_id]);
          }
        }
      }
    });

    return roots.length > 0 ? roots[0] : null;
  };

  useEffect(() => {
    setSearchQuery('');
  }, [currentLanguage, activeTab]);

  useEffect(() => {
    if (!selectedUserFileId) return;
    setActiveTab('myfiles');
    setSelectedFileId(selectedUserFileId);
    setOpenDropdowns(prev => ({ ...prev, samples: false }));
  }, [selectedUserFileId]);

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
  // File structure: file: { file_id, item_name, parent_item_id (nullable), lang_id }
  const filteredUserData = useMemo(() => {
    if (!searchQuery.trim()) {
      return { folders: userFolders, files: userFiles };
    }
    
    const query = searchQuery.toLowerCase();
    const matchesFileSearch = (file) => {
      const fileName = (file.item_name || '').toLowerCase();
      const languageName = (
        file.lang?.language ||
        languages.find(lang => lang.lang_id === file.lang_id)?.language ||
        ''
      ).toLowerCase();
      const extension = getFileExtension(languageName);
      const normalizedQuery = query.startsWith('.') ? query.slice(1) : query;

      return (
        fileName.includes(query) ||
        languageName.includes(query) ||
        (extension && (extension.includes(normalizedQuery) || `.${extension}`.includes(query)))
      );
    };
    
    // Recursively filter folders and their nested content
    // Folder structure: { folder_id, item_name, children: [subfolders], files: [files in this folder] }
    const filterFolder = (folder) => {
      const matchesSearch = folder.item_name?.toLowerCase().includes(query)
      
      // Filter files in this folder
      const filteredFiles = (folder.files || []).filter(file => 
        matchesFileSearch(file)
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
      !file.parent_item_id && matchesFileSearch(file)
    );
    
    return { folders: filteredFolders, files: filteredFiles };
  }, [userFolders, userFiles, searchQuery, languages]);

  const toggleFileDropdown = (folderName) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const handleFileClick = (sampleKey) => {
    setSelectedSampleKey(sampleKey);
    if (onFileSelect) {
      onFileSelect(sampleKey);
    }
  };

  const handleUserFileClick = useCallback(async (fileId) => {
    setSelectedFileId(fileId);

    const cachedFile = apiCache.current.userFileContent?.[fileId];
    if (cachedFile) {
      if (onUserFileSelect) {
        onUserFileSelect(cachedFile);
      }
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/files/${fileId}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (!apiCache.current.userFileContent) {
          apiCache.current.userFileContent = {};
        }
        apiCache.current.userFileContent[fileId] = data.file;
        if (onUserFileSelect) {
          onUserFileSelect(data.file);
        }
      }
    } catch (error) {
      console.error('Error loading user file:', error);
    }
  }, [API_URL, onUserFileSelect, apiCache]);

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
        // Check root level - compare by item_name
        return folders.some(f => (f.item_name) === name);
      }
      
      // Recursively search for the parent folder
      for (const folder of folders) {
        if (folder.folder_id === targetParentId) {
          return (folder.children || []).some(f => (f.item_name) === name);
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
      const response = await fetch(`${API_URL}/user/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_name: name, 
          parent_item_id: parentId 
        })
      });
      
      if (response.ok) {
        apiCache.current.userFilesData = { folders: null, files: null };
        loadUserFiles(true, true); // Force silent reload after creating
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
      ? userFiles.filter(f => f.parent_item_id === folderId)
      : userFiles.filter(f => !f.parent_item_id);
    
    if (filesInFolder.some(f => f.item_name === name)) {
      alert(`A file named "${name}" already exists in this location.`);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          item_name: name,
          parent_item_id: folderId,
          language_id: languageId,
          content: ''
        })
      });
      
      if (response.ok) {
        apiCache.current.userFilesData = { folders: null, files: null };
        loadUserFiles(true, true); // Force silent reload after creating
        setModal(null);
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to create file'}`);
      }
    } catch (error) {
      console.error('Error creating file:', error);
      alert('Failed to create file. Please try again.');
    }
  };

  const { handleMoveFile, handleMoveFolder } = useFileTreeMoveHandlers({
    API_URL,
    userFiles,
    userFolders,
    onAfterMove: async ({ type, fileId }) => {
      apiCache.current.userFilesData = { folders: null, files: null };
      if (type === 'file' && apiCache.current.userFileContent?.[fileId]) {
        delete apiCache.current.userFileContent[fileId];
      }
      // force reload + silent to avoid loading
      await loadUserFiles(true, true);
    },
  });

  const handleDelete = async () => {
    if (!contextMenu) return;

    const deletedFileId = contextMenu.type === 'file'
      ? contextMenu.item.file_id
      : null;

    const itemName = contextMenu.type === 'folder'
      ? (contextMenu.item.item_name || contextMenu.item.name || 'this folder')
      : (contextMenu.item.item_name || contextMenu.item.filename || 'this file');

    const confirmed = window.confirm(
      `Are you sure you want to delete ${itemName}?`
    );

    if (!confirmed) {
      setContextMenu(null);
      return;
    }
    
    try {
      const endpoint = contextMenu.type === 'folder'
        ? `${API_URL}/user/folders/${contextMenu.item.folder_id}`
        : `${API_URL}/user/files/${contextMenu.item.file_id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        apiCache.current.userFilesData = { folders: null, files: null };
        if (contextMenu.type === 'file' && contextMenu.item?.file_id && apiCache.current.userFileContent) {
          delete apiCache.current.userFileContent[contextMenu.item.file_id];
        }
        loadUserFiles(true, true); // Force silent reload after deleting
        if (deletedFileId && selectedFileId === deletedFileId) {
          setSelectedFileId(null);
          if (onUserFileSelect) {
            onUserFileSelect(null);
          }
        }
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
        ? `${API_URL}/user/folders/${item.folder_id}`
        : `${API_URL}/user/files/${item.file_id}`;
      
      const body = itemType === 'folder'
        ? { item_name: newName }
        : { item_name: newName };
      
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
        apiCache.current.userFilesData = { folders: null, files: null };
        if (itemType === 'file' && item.file_id && apiCache.current.userFileContent?.[item.file_id]) {
          apiCache.current.userFileContent[item.file_id] = {
            ...apiCache.current.userFileContent[item.file_id],
            item_name: newName,
          };
        }
        loadUserFiles(true, true); // Force silent reload after renaming
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
              {currentLanguage.includes('_') 
                ? `${currentLanguage.split('_')[0].charAt(0).toUpperCase() + currentLanguage.split('_')[0].slice(1)} Algorithms`
                : `${currentLanguage} Samples`
              }
            </h3>
            <SearchBar 
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={`Search ${currentLanguage.includes('_') ? 'algorithms' : 'samples'}...`}
            />
            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />

            {loading ? (
              <div style={{ color: '#888', padding: '1rem' }}>Loading samples...</div>
            ) : (
              <div style={{ marginBottom: '0.5rem', overflowY: 'auto'}}>
                <button
                  onClick={() => toggleFileDropdown('samples')}
                  className='folder-button'
                >
                  <span>
                    📁 {currentLanguage.includes('_') ? 'Algorithms' : 'Code Samples '} 
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
                        fontSize: '14px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {searchQuery ? `No results for "${searchQuery}"` : 'No samples available'}
                      </div>
                    ) : (
                      filteredSamples.map((sample) => (
                        <button
                          key={sample.key}
                          onClick={() => handleFileClick(sample.key)}
                          className={`file-button ${selectedSampleKey === sample.key ? 'selected' : ''}`}
                          title={`${sample.name}: ${sample.description}`}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center', marginBottom: '1rem' }}
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
                <div className={`file-tree-scroll-container hidden-scrollbar sidebar-bottom-padding ${isRootDropTarget ? 'drop-target' : ''}`}>
                  <FileTree
                    folders={filteredUserData.folders}
                    files={filteredUserData.files.filter(f => !f.parent_item_id)}
                    onFileClick={handleUserFileClick}
                    onFileSelect={setSelectedFileId}
                    onFolderClick={() => {}}
                    onContextMenu={handleContextMenu}
                    onMoveFile={handleMoveFile}
                    onMoveFolder={handleMoveFolder}
                    selectedFileId={selectedFileId}
                    languages={languages}
                    depth={0}
                    dragContext={dragContext}
                    setDragContext={setDragContext}
                  />
                </div>
                {filteredUserData.folders.length === 0 && filteredUserData.files.filter(f => !f.parent_item_id).length === 0 && (
                  <div style={{ color: '#888', padding: '1rem', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          initialValue={modal.type === 'rename' ? (modal.itemType === 'folder' ? (modal.item.item_name || modal.item.name) : (modal.item.item_name || modal.item.filename)) : ''}
          languages={languages}
        />
      )}
    </div>
  );
};

export default Sidebar;

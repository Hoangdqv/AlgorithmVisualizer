// FileExplorerSidebar.jsx - Enhanced sidebar with file explorer
import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import FileTree from './FileTree';
import FileContextMenu from './FileContextMenu';
import NewItemModal from './NewItemModal';
import SearchBar from './SearchBar';

const FileExplorerSidebar = ({ 
  onFileSelect,
  selectedFileId,
  onSampleSelect,
  selectedLanguage,
  samplesCache
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('samples'); // 'samples' or 'myfiles'
  const [userFolders, setUserFolders] = useState([]);
  const [userFiles, setUserFiles] = useState([]);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [modal, setModal] = useState(null);

  // Load samples
  useEffect(() => {
    if (activeTab === 'samples') {
      loadSamples();
    }
  }, [selectedLanguage, activeTab]);

  // Load user files
  useEffect(() => {
    if (activeTab === 'myfiles' && user) {
      loadUserFiles();
    }
  }, [activeTab, user]);

  const loadSamples = async () => {
    // Check cache first
    if (samplesCache?.current?.[selectedLanguage]) {
      setSamples(samplesCache.current[selectedLanguage]);
      return;
    }

    setLoading(true);
    try {
      const isCategoryRequest = selectedLanguage.includes('_');
      let response;
      
      if (isCategoryRequest) {
        const [category, language] = selectedLanguage.split('_');
        response = await fetch(
          `http://localhost:5000/api/category/${category}/algorithms/${language}`
        );
      } else {
        response = await fetch(
          `http://localhost:5000/api/samples/${selectedLanguage.toLowerCase()}`
        );
      }
      
      const data = await response.json();
      const items = data.samples || data.algorithms || [];
      setSamples(items);
      
      if (samplesCache?.current) {
        samplesCache.current[selectedLanguage] = items;
      }
    } catch (error) {
      console.error('Error loading samples:', error);
      setSamples([]);
    } finally {
      setLoading(false);
    }
  };

  const loadUserFiles = async () => {
    setLoading(true);
    try {
      // Load folders
      const foldersResponse = await fetch('http://localhost:5000/api/user/folders', {
        credentials: 'include'
      });
      
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        
        // Load tree for each root folder
        const foldersWithTree = await Promise.all(
          foldersData.folders.map(async (folder) => {
            try {
              const treeResponse = await fetch(
                `http://localhost:5000/api/user/folders/${folder.folder_id}/tree`,
                { credentials: 'include' }
              );
              
              if (treeResponse.ok) {
                const treeData = await treeResponse.json();
                return buildFolderHierarchy(treeData.tree);
              }
            } catch (error) {
              console.error('Error loading folder tree:', error);
            }
            return folder;
          })
        );
        
        setUserFolders(foldersWithTree);
      }

      // Load root-level files
      const filesResponse = await fetch('http://localhost:5000/api/user/files', {
        credentials: 'include'
      });
      
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        // Filter for root-level files (folder_id is null)
        const rootFiles = filesData.files.filter(f => !f.folder_id);
        setUserFiles(rootFiles);
      }
    } catch (error) {
      console.error('Error loading user files:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildFolderHierarchy = (treeItems) => {
    if (!treeItems || treeItems.length === 0) return null;

    const root = treeItems[0];
    const childFolders = treeItems.slice(1).filter(item => item.depth === 1);

    return {
      ...root,
      children: childFolders.map(child => ({
        ...child,
        children: [],
        files: child.files || []
      })),
      files: root.files || []
    };
  };

  const handleContextMenu = (e, item, type) => {
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      type
    });
  };

  const handleCreateFolder = async (data) => {
    try {
      const response = await fetch('http://localhost:5000/api/user/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          folder_name: data.name,
          parent_folder_id: modal?.parentFolderId || null
        })
      });

      if (response.ok) {
        loadUserFiles(); // Reload
        setModal(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create folder');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder');
    }
  };

  const handleCreateFile = async (data) => {
    try {
      const response = await fetch('http://localhost:5000/api/user/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          file_name: data.name,
          folder_id: modal?.parentFolderId || null,
          content: '',
          language: data.language
        })
      });

      if (response.ok) {
        const result = await response.json();
        loadUserFiles();
        setModal(null);
        // Auto-select the new file
        if (onFileSelect && result.file) {
          onFileSelect(result.file);
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create file');
      }
    } catch (error) {
      console.error('Error creating file:', error);
      alert('Failed to create file');
    }
  };

  const handleDelete = async () => {
    if (!contextMenu) return;

    const confirmMsg = contextMenu.type === 'folder' 
      ? `Delete folder "${contextMenu.item.folder_name}" and all its contents?`
      : `Delete file "${contextMenu.item.file_name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const endpoint = contextMenu.type === 'folder'
        ? `/api/user/folders/${contextMenu.item.folder_id}`
        : `/api/user/files/${contextMenu.item.file_id}`;

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        loadUserFiles();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete');
    }
  };

  const handleRename = async () => {
    if (!contextMenu) return;

    const currentName = contextMenu.type === 'folder' 
      ? contextMenu.item.folder_name 
      : contextMenu.item.file_name;

    setModal({
      type: contextMenu.type,
      action: 'rename',
      item: contextMenu.item,
      initialValue: currentName
    });
  };

  const handleRenameSubmit = async (data) => {
    try {
      const endpoint = modal.type === 'folder'
        ? `/api/user/folders/${modal.item.folder_id}`
        : `/api/user/files/${modal.item.file_id}`;

      const body = modal.type === 'folder'
        ? { folder_name: data.name }
        : { file_name: data.name };

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        loadUserFiles();
        setModal(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to rename');
      }
    } catch (error) {
      console.error('Error renaming:', error);
      alert('Failed to rename');
    }
  };

  const handleFileClick = async (file) => {
    if (activeTab === 'samples') {
      if (onSampleSelect) {
        onSampleSelect(file.key);
      }
    } else {
      // Load file content
      try {
        const response = await fetch(`http://localhost:5000/api/user/files/${file.file_id}`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (onFileSelect) {
            onFileSelect(data.file);
          }
        }
      } catch (error) {
        console.error('Error loading file:', error);
      }
    }
  };

  const filteredSamples = samples.filter(sample =>
    sample.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sample.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="sidebar file-explorer-sidebar">
      {/* Tabs */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'samples' ? 'active' : ''}`}
          onClick={() => setActiveTab('samples')}
        >
          📚 Samples
        </button>
        {user && (
          <button
            className={`sidebar-tab ${activeTab === 'myfiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('myfiles')}
          >
            📁 My Files
          </button>
        )}
      </div>

      {/* Search */}
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={activeTab === 'samples' ? 'Search samples...' : 'Search files...'}
      />



      {/* Context Menu */}
      {contextMenu && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          type={contextMenu.type}
          onClose={() => setContextMenu(null)}
          onNewFile={() => setModal({ 
            type: 'file', 
            action: 'create',
            parentFolderId: contextMenu.item.folder_id 
          })}
          onNewFolder={() => setModal({ 
            type: 'folder', 
            action: 'create',
            parentFolderId: contextMenu.item.folder_id 
          })}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}

      {/* Modal */}
      {modal && (
        <NewItemModal
          isOpen={!!modal}
          onClose={() => setModal(null)}
          onSubmit={modal.action === 'rename' ? handleRenameSubmit : 
                   modal.type === 'folder' ? handleCreateFolder : handleCreateFile}
          type={modal.type}
          title={modal.action === 'rename' ? `Rename ${modal.type}` : undefined}
          initialValue={modal.initialValue}
        />
      )}
    </div>
  );
};

export default FileExplorerSidebar;

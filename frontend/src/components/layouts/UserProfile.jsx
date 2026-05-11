import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/useAuth';
import SearchBar from '../SearchBar';
import FileTree from '../FileTree';
import FileContextMenu from '../FileContextMenu';
import NewItemModal from '../NewItemModal';
import getFileExtension from '../../scripts/getFileExtension';
import useFileTreeMoveHandlers from '../../hooks/useFileTreeMoveHandlers';

export default function UserProfile() {
  const { user, checkAuth } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Profile form state
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  
  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [languages, setLanguages] = useState([]);

  const [filesLoading, setFilesLoading] = useState(false);
  const [userFolders, setUserFolders] = useState([]);
  const [userFiles, setUserFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  // Batch delete mode for file directory in profile page.
  const [isBatchDeleteMode, setIsBatchDeleteMode] = useState(false);
  // Holds selected file IDs while batch mode is active.
  const [selectedBatchFileIds, setSelectedBatchFileIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [modal, setModal] = useState(null);
  const userFilesCacheRef = useRef({
    folders: null,
    files: null,
  });

  const API_URL = import.meta.env.VITE_API_URL;
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

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
      } catch (loadLanguagesError) {
        console.error('Error loading languages:', loadLanguagesError);
      }
    };
    loadLanguages();
  }, [API_URL]);

  const buildFolderHierarchy = (treeNodes) => {
    if (!treeNodes || treeNodes.length === 0) return null;

    const nodeMap = {};
    treeNodes.forEach(node => {
      nodeMap[node.folder_id] = {
        ...node,
        children: [],
        files: node.files || []
      };
    });

    const roots = [];
    treeNodes.forEach(node => {
      if (node.depth === 0) {
        roots.push(nodeMap[node.folder_id]);
      } else {
        const parentId = node.parent_folder_id;
        if (parentId && nodeMap[parentId]) {
          if (!nodeMap[parentId].children.includes(nodeMap[node.folder_id])) {
            nodeMap[parentId].children.push(nodeMap[node.folder_id]);
          }
        }
      }
    });

    return roots.length > 0 ? roots[0] : null;
  };

  const loadUserFiles = useCallback(async (forceReload = false, silent = false) => {
    if (!forceReload && userFilesCacheRef.current.folders && userFilesCacheRef.current.files) {
      setUserFolders(userFilesCacheRef.current.folders);
      setUserFiles(userFilesCacheRef.current.files);
      return;
    }

    if (!silent) {
      setFilesLoading(true);
    }
    try {
      const foldersResponse = await fetch(`${API_URL}/user/folders`, {
        credentials: 'include'
      });

      let allFolders = [];
      if (foldersResponse.ok) {
        const foldersData = await foldersResponse.json();
        const rootFolders = foldersData.folders || [];

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
            } catch (treeError) {
              console.error('Error loading tree:', treeError);
              return folder;
            }
          })
        );

        allFolders = trees.filter(t => t !== null);
      }

      setUserFolders(allFolders);

      const filesResponse = await fetch(`${API_URL}/user/files`, {
        credentials: 'include'
      });

      let allFiles = [];
      if (filesResponse.ok) {
        const filesData = await filesResponse.json();
        allFiles = filesData.files || [];
      }

      setUserFiles(allFiles);
      userFilesCacheRef.current = { folders: allFolders, files: allFiles };
    } catch (loadUserFilesError) {
      console.error('Error loading user files:', loadUserFilesError);
    } finally {
      if (!silent) {
        setFilesLoading(false);
      }
    }
  }, [API_URL]);

  useEffect(() => {
    if (user) {
      loadUserFiles();
    }
  }, [user, loadUserFiles]);

  useEffect(() => {
    if (!isBatchDeleteMode) {
      setSelectedBatchFileIds([]);
    }
  }, [isBatchDeleteMode]);

  const filteredUserData = useMemo(() => {
    if (!searchQuery.trim()) {
      return { folders: userFolders, files: userFiles };
    }

    const query = searchQuery.toLowerCase();
    const matchesFileSearch = (file) => {
      const fileName = (file.file_name || '').toLowerCase();
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

    const filterFolder = (folder) => {
      const matchesSearch = folder.folder_name?.toLowerCase().includes(query)
      const filteredFiles = (folder.files || []).filter(file =>
        matchesFileSearch(file)
      );

      const filteredChildren = (folder.children || [])
        .map(child => filterFolder(child))
        .filter(child => child !== null);

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
      !file.folder_id && matchesFileSearch(file)
    );

    return { folders: filteredFolders, files: filteredFiles };
  }, [userFolders, userFiles, searchQuery, languages]);

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      type
    });
  };

  const handleOpenInEditor = useCallback(async () => {
    if (!contextMenu || contextMenu.type !== 'file') return;

    const fileId = contextMenu.item.file_id;
    setSelectedFileId(fileId);

    try {
      const response = await fetch(`${API_URL}/user/files/${fileId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.file) {
          // Pass the file data to code playground
          navigate('/playground', { state: { openUserFile: data.file } });
        }
      }
    } catch (openFileError) {
      console.error('Error opening user file in editor:', openFileError);
    }
  }, [API_URL, contextMenu, navigate]);

  const handleCreateFolder = async (name, parentId = null) => {
    const checkDuplicateInFolder = (folders, targetParentId) => {
      if (!targetParentId) {
        return folders.some(f => (f.folder_name) === name);
      }

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
      const response = await fetch(`${API_URL}/user/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          folder_name: name,
          parent_folder_id: parentId
        })
      });

      if (response.ok) {
        loadUserFiles(true, true);
        setModal(null);
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to create folder'}`);
      }
    } catch (createFolderError) {
      console.error('Error creating folder:', createFolderError);
      alert('Failed to create folder. Please try again.');
    }
  };

  const handleCreateFile = async (name, languageId, folderId = null) => {
    const filesInFolder = folderId
      ? userFiles.filter(f => f.folder_id === folderId)
      : userFiles.filter(f => !f.folder_id);

    if (filesInFolder.some(f => f.file_name === name)) {
      alert(`A file named "${name}" already exists in this location.`);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/files`, {
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
        loadUserFiles(true, true);
        setModal(null);
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to create file'}`);
      }
    } catch (createFileError) {
      console.error('Error creating file:', createFileError);
      alert('Failed to create file. Please try again.');
    }
  };

  const { handleMoveFile, handleMoveFolder } = useFileTreeMoveHandlers({
    API_URL,
    userFiles,
    userFolders,
    onAfterMove: async () => {
      userFilesCacheRef.current = { folders: null, files: null };
      await loadUserFiles(true, true);
    },
  });

  const handleDelete = async () => {
    if (!contextMenu) return;

    const itemName = contextMenu.type === 'folder'
      ? (contextMenu.item.folder_name || contextMenu.item.name || 'this folder')
      : (contextMenu.item.file_name || contextMenu.item.filename || 'this file');

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
        loadUserFiles(true, true);
        setContextMenu(null);
      }
    } catch (deleteError) {
      console.error('Error deleting:', deleteError);
    }
  };

  const toggleBatchDeleteMode = () => {
    // Toggle select mode and close any context menu to avoid conflicting actions.
    setIsBatchDeleteMode((prev) => !prev);
    setContextMenu(null);
  };

  const handleBatchFileToggle = (fileId) => {
    // Add/remove one file id from current batch selection.
    setSelectedBatchFileIds((prev) => (
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    ));
  };

  const handleBatchDelete = async () => {
    const fileCount = selectedBatchFileIds.length;
    if (fileCount === 0) {
      alert('No files selected. Select files first, then click Delete selected.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${fileCount} selected file${fileCount === 1 ? '' : 's'}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      // Run deletes in parallel; partial failures are reported to the user.
      const deleteResults = await Promise.allSettled(
        selectedBatchFileIds.map((fileId) => (
          fetch(`${API_URL}/user/files/${fileId}`, {
            method: 'DELETE',
            credentials: 'include'
          })
        ))
      );

      const successfulDeletes = [];
      let failedCount = 0;

      deleteResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.ok) {
          successfulDeletes.push(selectedBatchFileIds[index]);
          return;
        }
        failedCount += 1;
      });

      if (successfulDeletes.length > 0) {
        const deletedSet = new Set(successfulDeletes);
        // Invalidate cached directory and reload latest server state.
        userFilesCacheRef.current = { folders: null, files: null };
        await loadUserFiles(true, true);

        if (selectedFileId && deletedSet.has(selectedFileId)) {
          setSelectedFileId(null);
        }

        // Remove deleted files from selection and return to normal browsing mode.
        setSelectedBatchFileIds((prev) => prev.filter((fileId) => !deletedSet.has(fileId)));
        setIsBatchDeleteMode(false);
      }

      if (failedCount > 0) {
        alert(`Deleted ${successfulDeletes.length} file(s). ${failedCount} file(s) could not be deleted.`);
      } else {
        alert(`Deleted ${successfulDeletes.length} file(s).`);
      }
    } catch (error) {
      console.error('Error during batch delete:', error);
      alert('Batch delete failed. Please try again.');
    }
  };

  const handleRename = async (newName, item, itemType) => {
    if (!item || !itemType) {
      return;
    }

    try {
      const endpoint = itemType === 'folder'
        ? `${API_URL}/user/folders/${item.folder_id}`
        : `${API_URL}/user/files/${item.file_id}`;

      const body = itemType === 'folder'
        ? { folder_name: newName }
        : { file_name: newName };

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        loadUserFiles(true, true);
        setModal(null);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to rename'}`);
      }
    } catch (renameError) {
      console.error('Error renaming:', renameError);
      alert('Failed to rename. Please try again.');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Profile updated successfully!');
        setEditing(false);
        await checkAuth(); // Refresh user data
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Password changed successfully!');
        setChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLinkSuccess = async (credentialResponse) => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/link-google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Google account linked successfully!');
        await checkAuth();
      } else {
        setError(data.error || 'Failed to link Google account');
      }
    } catch (linkError) {
      console.error('Google account linking failed:', linkError);
      setError('An error occurred while linking Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLinkError = () => {
    setError('Google linking failed. Please try again.');
  };

  const cancelEdit = () => {
    setEditing(false);
    setUsername(user.username);
    setEmail(user.email);
    setError('');
    setMessage('');
  };

  const cancelPasswordChange = () => {
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setMessage('');
  };

  if (!user) {
    return (
      <div className="profile-container">
        <div className="profile-card">
          <p>Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  const isOAuthUser = user.oauth_provider;

  return (
    <div className="profile-container">
      <div className='profile-section-grid'>
        <div className="profile-infomation">
          <div className="profile-card">
            <h2>User Profile</h2>

            {message && <div className="success-alert">{message}</div>}
            {error && <div className="error-alert">{error}</div>}
                {/* Profile Information */}
                <div className="profile-section">
                  <h3>Account Information</h3>
                  
                  {!editing ? (
                    <div className="profile-info-content">
                      <div className="info-row">
                        <span className="info-label">Username:</span>
                        <span className="info-value">{user.username}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Email:</span>
                        <span className="info-value">{user.email}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Member Since:</span>
                        <span className="info-value">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {/* {isOAuthUser && (
                        <div className="info-row">
                          <span className="info-label">Login Method:</span>
                          <span className="info-value">{user.oauth_provider}</span>
                        </div>
                      )} */}
                      
                      <button 
                        className="profile-button primary"
                        onClick={() => setEditing(true)}
                      >
                        Edit Profile
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleUpdateProfile} className="profile-form">
                      <div className="form-group">
                        <label htmlFor="username">Username:</label>
                        <input
                          type="text"
                          id="username"
                          className="modal-input"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                          type="email"
                          id="email"
                          className="modal-input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="profile-actions">
                        <button 
                          type="submit" 
                          className="profile-button primary"
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button 
                          type="button" 
                          className="profile-button secondary"
                          onClick={cancelEdit}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Native Account Security - Only for non-OAuth users */}
                {!isOAuthUser && (
                  <div className="profile-section">
                    <h3>Link Google Account</h3>
                    {googleClientId && (
                      <div style={{ marginBottom: '1rem', display: 'flex', colorScheme: 'light' }}>
                        <GoogleOAuthProvider clientId={googleClientId || ''}>
                          <GoogleLogin
                            onSuccess={handleGoogleLinkSuccess}
                            onError={handleGoogleLinkError}
                            text="continue_with"
                            shape="rectangular"
                            width="300"
                            locale="en"
                          />
                        </GoogleOAuthProvider>
                      </div>
                    )}
                    <h3>Account Security</h3>
                    <button
                      className="profile-button primary"
                      onClick={() => setChangingPassword(true)}
                    >
                      Change Password
                    </button>
                  </div>
                )}
                {isOAuthUser && user.oauth_provider && (
                  <div className="profile-section">
                    <h3>Linked Account:</h3>
                    <div className="info-row">
                      <span>Provider:</span>
                      <span>{user.oauth_provider}</span>
                    </div>
                  </div>
                )}
          </div>word
        </div>
        <div className="profile-file-storage-management">
          <div className="profile-file-storage-card">
            <h2>File Storage Management</h2>
            <h3>Manage your personal files here.</h3>

            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search my files..."
            />

            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />
            <div className="create-button-group">
              <button
                className="icon-button"
                onClick={() => setModal({ type: 'create-folder', parentId: null })}
                title="New Folder"
                disabled={isBatchDeleteMode}
              >
                📁 New folder
              </button>
              <button
                className="icon-button"
                onClick={() => setModal({ type: 'create-file', folderId: null })}
                title="New File"
                disabled={isBatchDeleteMode}
              >
                📄 New file
              </button>
              <button
                className={`icon-button ${isBatchDeleteMode ? 'active' : ''}`}
                onClick={toggleBatchDeleteMode}
                title="Select multiple files to delete"
              >
                {isBatchDeleteMode ? '✕ Cancel select' : '☑ Select files'}
              </button>
              <button
                className="icon-button icon-button-danger"
                onClick={handleBatchDelete}
                title="Delete selected files"
                disabled={!isBatchDeleteMode || selectedBatchFileIds.length === 0}
              >
                🗑 Delete selected ({selectedBatchFileIds.length})
              </button>
            </div>
            {isBatchDeleteMode && (
              <div className="batch-selection-status">
                Select files using checkboxes, then click Delete selected.
              </div>
            )}
            <hr style={{ borderColor: '#333', margin: '1rem 0' }} />

            {filesLoading ? (
              <div style={{ color: '#888', padding: '1rem' }}>Loading files...</div>
            ) : (
              <>
                <div className="file-tree-scroll-container profile-file-tree-scroll">
                  <FileTree
                    folders={filteredUserData.folders}
                    files={filteredUserData.files.filter(f => !f.folder_id)}
                    onFileClick={setSelectedFileId}
                    onFolderClick={() => {}}
                    onContextMenu={handleContextMenu}
                    onMoveFile={handleMoveFile}
                    onMoveFolder={handleMoveFolder}
                    selectedFileId={selectedFileId}
                    isBatchSelectMode={isBatchDeleteMode}
                    selectedBatchFileIds={selectedBatchFileIds}
                    onBatchFileToggle={handleBatchFileToggle}
                    languages={languages}
                    depth={0}
                  />
                </div>

                {filteredUserData.folders.length === 0 && filteredUserData.files.filter(f => !f.folder_id).length === 0 && (
                  <div style={{ color: '#888', padding: '1rem', textAlign: 'center' }}>
                    {searchQuery ? `No results for "${searchQuery}"` : 'No files yet. Create a folder or file to get started!'}
                  </div>
                )}
              </>
            )}

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
                onOpenInEditor={contextMenu.type === 'file' ? handleOpenInEditor : undefined}
                onDelete={handleDelete}
              />
            )}

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
              />
            )}
          </div>
        </div>
      </div>

      {changingPassword && (
        <div className="modal-overlay" onClick={cancelPasswordChange}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="modal-close" onClick={cancelPasswordChange}>x</button>
            </div>

            <form onSubmit={handleChangePassword} className="modal-body">
              <div className="form-group">
                <label htmlFor="current-password">Current Password:</label>
                <input
                  type="password"
                  id="current-password"
                  className="modal-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-password">New Password:</label>
                <input
                  type="password"
                  id="new-password"
                  className="modal-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password">Confirm New Password:</label>
                <input
                  type="password"
                  id="confirm-password"
                  className="modal-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-button secondary"
                  onClick={cancelPasswordChange}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-button primary"
                  disabled={loading}
                >
                  {loading ? 'Changing...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

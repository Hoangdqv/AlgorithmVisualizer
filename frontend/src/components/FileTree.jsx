// FileTree.jsx - Recursive tree component for folders and files
import { useState } from 'react';

const FileTree = ({ 
  folders = [], 
  files = [], 
  onFileClick, 
  onFolderClick,
  onContextMenu,
  selectedFileId,
  languages,
  depth = 0 
}) => {

  const [expandedFolders, setExpandedFolders] = useState({});
  const suffix = {
    'python': 'py',
    'javascript': 'js'
  }

  const toggleFolder = (folderId, e) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const handleFolderClick = (folder, e) => {
    e.stopPropagation();
    if (onFolderClick) {
      onFolderClick(folder);
    }
  };

  const handleFileClick = (file, e) => {
    e.stopPropagation();
    if (onFileClick) {
      onFileClick(file.file_id);
    }
  };

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    e.stopPropagation();
    if (onContextMenu) {
      onContextMenu(e, item, type);
    }
  };

  const handleLanguages = (file) => {
    if (!languages) return null;
    const lang = languages.find(lang => lang.lang_id === file.lang_id);
    return lang ? suffix[lang.language.toLowerCase()] : null;
  }

  const indent = depth * 16;

  return (
    <div className="file-tree">
      {/* Render folders */}
      {folders.map((folder) => (
        <div key={`folder-${folder.folder_id}`} className="tree-item-container">
          <div
            className="tree-item folder-item"
            style={{ paddingLeft: `${indent}px` }}
            onClick={(e) => handleFolderClick(folder, e)}
            onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
          >
            <span className="folder-toggle">
              {expandedFolders[folder.folder_id] ? '📂' : '📁'}
            </span>
            <span className="item-name" onClick={(e) => toggleFolder(folder.folder_id, e)}>{folder.name || folder.folder_name}</span>
            {folder.files && folder.files.length > 0 && (
              <span className="item-count">({folder.files.length})</span>
            )}
          </div>

          {/* Recursively render children if expanded */}
          {expandedFolders[folder.folder_id] && folder.children && (
            <FileTree
              folders={folder.children}
              files={[]}
              onFileClick={onFileClick}
              onFolderClick={onFolderClick}
              onContextMenu={onContextMenu}
              selectedFileId={selectedFileId}
              languages={languages}
              depth={depth + 1}
            />
          )}

          {/* Render files in this folder */}
          {expandedFolders[folder.folder_id] && folder.files && (
            <div className="folder-files">
              {folder.files.map((file) => (
                <div
                  key={`file-${file.file_id}`}
                  className={`tree-item file-item ${selectedFileId === file.file_id ? 'selected' : ''}`}
                  style={{ paddingLeft: `${indent + 16}px` }}
                  onClick={(e) => handleFileClick(file, e)}
                  onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                >
                  <span className="file-icon">📄</span>
                  <span className="item-name">{file.file_name}</span>
                  <span className="file-language">.{handleLanguages(file)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Render root-level files */}
      {depth === 0 && files.map((file) => (
        <div
          key={`file-${file.file_id}`}
          className={`tree-item file-item ${selectedFileId === file.file_id ? 'selected' : ''}`}
          style={{ paddingLeft: `${indent}px` }}
          onClick={(e) => handleFileClick(file, e)}
          onContextMenu={(e) => handleContextMenu(e, file, 'file')}
        >
          <span className="file-icon">📄</span>
          <span className="item-name">{file.file_name}</span>
          <span className="file-language">.{handleLanguages(file)}</span>
        </div>
      ))}
    </div>
  );
};

export default FileTree;

// FileTree.jsx - Recursive tree component for folders and files
import { useRef, useState } from 'react';
import getFileExtension from '../scripts/getFileExtension';

const FileTree = ({ 
  folders = [], 
  files = [], 
  onFileClick, 
  onFolderClick,
  onContextMenu,
  onMoveFile,
  onMoveFolder,
  selectedFileId,
  languages,
  depth = 0,
  parentFolderId = null,
  
  // For recursive drag and drop context sharing, if not provided, it will use local state
  dragContext: dragContextProp,
  setDragContext: setDragContextProp
}) => {

  const [expandedFolders, setExpandedFolders] = useState({});
  const [localDragContext, setLocalDragContext] = useState({
    dragOverTarget: null,
    isDragging: false,
    dragSource: null,
  });
  const dragImageRef = useRef(null);

  const dragContext = dragContextProp || localDragContext;
  const setDragContext = setDragContextProp || setLocalDragContext;
  const { dragOverTarget, isDragging, dragSource } = dragContext;
  
  // Dynamic file extension mapper


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
    return lang ? getFileExtension(lang.language) : 'txt';
  };

  const handleDragStart = (event, itemType, item) => {
    event.stopPropagation();
    // Info of what being dragged
    const dragPayload = itemType === 'folder'
      ? {
          type: 'folder',
          id: item.folder_id,
          parentFolderId: item.parent_folder_id ?? null,
        }
      : {
          type: 'file',
          id: item.file_id,
          parentFolderId: item.folder_id ?? null,
        };

    const encodedPayload = JSON.stringify(dragPayload);
    
    event.dataTransfer.setData('application/x-file-tree-item', encodedPayload);
    // Prevent dragging into editor
    event.dataTransfer.setData('text/plain', '');
    // This is moving item
    event.dataTransfer.effectAllowed = 'move';

    // Create a transparent image to avoid ghost image in drag and drop behaviour
    if (!dragImageRef.current) {
      const transparentImage = new Image();
      transparentImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      dragImageRef.current = transparentImage;
    }
    event.dataTransfer.setDragImage(dragImageRef.current, 0, 0);

    setDragContext(prev => ({
      ...prev,
      isDragging: true,
      dragSource: { type: dragPayload.type, id: dragPayload.id },
      dragOverTarget: null,
    }));
  };

  const handleDragEnd = () => {
    setDragContext(prev => ({
      ...prev,
      dragOverTarget: null,
      isDragging: false,
      dragSource: null,
    }));
  };

  const tryGetDragPayload = (event) => {
    try {
      const raw = event.dataTransfer.getData('application/x-file-tree-item');
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const handleDragOverTarget = (event, targetType, targetId) => {
    event.preventDefault();
    // moves item
    event.dataTransfer.dropEffect = 'move';
    setDragContext(prev => ({
      ...prev,
      dragOverTarget: `${targetType}:${targetId ?? 'root'}`,
    }));
  };

  const handleTreeDragOverCapture = (event) => {
    event.preventDefault();
    // moves item
    event.dataTransfer.dropEffect = 'move';
  };

  const handleTreeDragEnterCapture = (event) => {
    // 
    event.preventDefault();
  };

  const handleDragLeaveTarget = (event, targetType, targetId) => {
    // Only clear when the pointer actually leaves the element, not when moving within.
    const nextTarget = event.relatedTarget;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    const currentKey = `${targetType}:${targetId ?? 'root'}`;
    setDragContext(prev => (
      prev.dragOverTarget === currentKey
        ? { ...prev, dragOverTarget: null }
        : prev
    ));
  };

  const handleDropOnTarget = async (event, targetType, targetId) => {
    event.preventDefault();
    event.stopPropagation();

    const payload = tryGetDragPayload(event);
    setDragContext(prev => ({
      ...prev,
      dragOverTarget: null,
      isDragging: false,
      dragSource: null,
    }));
    if (!payload) {
      return;
    }

    if (payload.type === 'file' && payload.parentFolderId === (targetId ?? null)) {
      return;
    }

    if (payload.type === 'folder' && (payload.id === targetId || payload.parentFolderId === (targetId ?? null))) {
      return;
    }

    if (payload.type === 'file' && onMoveFile) {
      await onMoveFile(payload.id, targetId ?? null);
      return;
    }

    if (payload.type === 'folder' && onMoveFolder) {
      await onMoveFolder(payload.id, targetId ?? null);
    }
  };

  const indent = Math.min(5 + depth * 16, 96);
  const fileIndent = Math.min(indent + 16, 112);

  // Check if the current drag source is itself to avoid unnecessary hints
  const isDragSourceTarget = (targetType, targetId) =>
    dragSource && dragSource.type === targetType && dragSource.id === targetId;

  return (
    <div
      className={`file-tree ${!isDragSourceTarget('folder', parentFolderId) && dragOverTarget === (parentFolderId ? `folder:${parentFolderId}` : 'root:root') ? 'drop-target' : ''}`}
      onDragEnterCapture={handleTreeDragEnterCapture}
      onDragOverCapture={handleTreeDragOverCapture}
      onDragOver={(e) => handleDragOverTarget(e, parentFolderId ? 'folder' : 'root', parentFolderId)}
      onDrop={(e) => handleDropOnTarget(e, parentFolderId ? 'folder' : 'root', parentFolderId)}
      onDragLeave={(e) => handleDragLeaveTarget(e, parentFolderId ? 'folder' : 'root', parentFolderId)}
    >
      {/* Render folders */}
      {folders.map((folder) => (
        <div
          key={`folder-${folder.folder_id}`}
          className="tree-item-container"
          onDragOver={(e) => {
            e.stopPropagation();
            handleDragOverTarget(e, 'folder', folder.folder_id);
          }}
          onDrop={(e) => handleDropOnTarget(e, 'folder', folder.folder_id)}
          onDragLeave={(e) => handleDragLeaveTarget(e, 'folder', folder.folder_id)}
        >
          <div
            className={`tree-item folder-item ${!isDragSourceTarget('folder', folder.folder_id) && dragOverTarget === `folder:${folder.folder_id}` ? 'drop-target' : ''}`}
            style={{ paddingLeft: `${indent}px` }}
            title={folder.folder_name}
            onClick={(e) => handleFolderClick(folder, e)}
            onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
            draggable
            onDragStart={(e) => handleDragStart(e, 'folder', folder)}
            onDragEnd={handleDragEnd}
          >
            <span className="folder-toggle">
              {expandedFolders[folder.folder_id] ? '📂' : '📁'}
            </span>
            <span
              className="item-name"
              title={folder.folder_name}
              onClick={(e) => toggleFolder(folder.folder_id, e)}
            >
              {folder.folder_name}
            </span>
            {isDragging && !isDragSourceTarget('folder', folder.folder_id) && (
              <span className="drop-hint">Move to</span>
            )}
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
              onMoveFile={onMoveFile}
              onMoveFolder={onMoveFolder}
              selectedFileId={selectedFileId}
              languages={languages}
              depth={depth + 1}
              parentFolderId={folder.folder_id}
              dragContext={dragContext}
              setDragContext={setDragContext}
            />
          )}

          {/* Render files in this folder */}
          {expandedFolders[folder.folder_id] && folder.files && (
            <div className="folder-files">
              {folder.files.map((file) => (
                <div
                  key={`file-${file.file_id}`}
                  className={`tree-item file-item ${selectedFileId === file.file_id ? 'selected' : ''}`}
                  style={{ paddingLeft: `${fileIndent}px` }}
                  title={file.file_name}
                  onClick={(e) => handleFileClick(file, e)}
                  onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                  draggable
                  onDragStart={(e) => handleDragStart(e, 'file', file)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="file-icon">📄</span>
                  <span className="item-name" title={file.file_name}>{file.file_name}</span>
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
          title={file.file_name}
          onClick={(e) => handleFileClick(file, e)}
          onContextMenu={(e) => handleContextMenu(e, file, 'file')}
          draggable
          onDragStart={(e) => handleDragStart(e, 'file', file)}
          onDragEnd={handleDragEnd}
        >
          <span className="file-icon">📄</span>
          <span className="item-name" title={file.file_name}>{file.file_name}</span>
          <span className="file-language">.{handleLanguages(file)}</span>
        </div>
      ))}
    </div>
  );
};

export default FileTree;

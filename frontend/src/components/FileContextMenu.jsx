// FileContextMenu.jsx - Right-click context menu for files and folders
import { useEffect, useRef } from 'react';

const FileContextMenu = ({ 
  x, 
  y, 
  type, 
  onClose, 
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = (action, e) => {
    e.stopPropagation();
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        top: `${y}px`,
        left: `${x}px`,
        zIndex: 1000
      }}
    >
      {type === 'folder' && (
        <>
          <div className="context-menu-item" onClick={(e) => handleAction(onNewFile, e)}>
            📄 New File
          </div>
          <div className="context-menu-item" onClick={(e) => handleAction(onNewFolder, e)}>
            📁 New Folder
          </div>
          <div className="context-menu-divider" />
        </>
      )}
      
      <div className="context-menu-item" onClick={(e) => handleAction(onRename, e)}>
        Rename
      </div>
      
      <div className="context-menu-divider" />
      
      <div className="context-menu-item danger" onClick={(e) => handleAction(onDelete, e)}>
        Delete
      </div>
    </div>
  );
};

export default FileContextMenu;

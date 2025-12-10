// NewItemModal.jsx - Modal for creating new files and folders
import { useState, useEffect, useRef } from 'react';

const NewItemModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  type, // 'file' or 'folder'
  title,
  initialValue = ''
}) => {
  const [name, setName] = useState(initialValue);
  const [language, setLanguage] = useState('python');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    setName(initialValue);
  }, [isOpen, initialValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      if (type === 'rename') {
        // For rename, just send the name
        onSubmit({ name: name.trim() });
      } else if (type === 'file' || type === 'create-file') {
        const languageId = language.toLowerCase() === 'javascript' ? 2 : 1;
        onSubmit({ name: name.trim(), language_id: languageId });
      } else {
        onSubmit({ name: name.trim() });
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title || `New ${(type === 'file' || type === 'create-file') ? 'File' : 'Folder'}`}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="item-name">
              {(type === 'file' || type === 'create-file') ? 'File Name' : 'Folder Name'}
            </label>
            <input
              ref={inputRef}
              id="item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={(type === 'file' || type === 'create-file') ? `example.${language === 'javascript' ? 'js' : 'py'}` : 'My Folder'}
              className="modal-input"
            />
          </div>

          {(type === 'file' || type === 'create-file') && type !== 'rename' && (
            <div className="form-group">
              <label htmlFor="language">Language</label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="modal-select"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="modal-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="modal-button primary" disabled={!name.trim()}>
              {type === 'rename' ? 'Rename' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewItemModal;

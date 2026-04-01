import { useCallback } from 'react';

export default function useFileTreeMoveHandlers({
  API_URL,
  userFiles,
  userFolders,
  onAfterMove,
}) {
  const findFolderById = useCallback((folders, folderId) => {
    for (const folder of folders) {
      if (folder.folder_id === folderId) {
        return folder;
      }
      if (folder.children?.length) {
        const match = findFolderById(folder.children, folderId);
        if (match) {
          return match;
        }
      }
    }
    return null;
  }, []);

  const folderContainsDescendant = useCallback((folder, targetFolderId) => {
    if (!folder?.children?.length) {
      return false;
    }

    for (const child of folder.children) {
      if (child.folder_id === targetFolderId) {
        return true;
      }
      if (folderContainsDescendant(child, targetFolderId)) {
        return true;
      }
    }

    return false;
  }, []);

  const handleMoveFile = useCallback(async (fileId, targetFolderId = null) => {
    const file = userFiles.find(f => f.file_id === fileId);
    if (!file || file.folder_id === targetFolderId) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/files/${fileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder_id: targetFolderId })
      });

      if (response.ok) {
        if (onAfterMove) {
          await onAfterMove({ type: 'file', fileId });
        }
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to move file'}`);
      }
    } catch (moveFileError) {
      console.error('Error moving file:', moveFileError);
      alert('Failed to move file. Please try again.');
    }
  }, [API_URL, onAfterMove, userFiles]);

  const handleMoveFolder = useCallback(async (folderId, targetParentId = null) => {
    const folder = findFolderById(userFolders, folderId);
    if (!folder || folder.parent_folder_id === targetParentId) {
      return;
    }

    if (targetParentId === folderId) {
      return;
    }

    if (targetParentId !== null && folderContainsDescendant(folder, targetParentId)) {
      alert('Cannot move a folder into one of its descendants.');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/user/folders/${folderId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ new_parent_id: targetParentId })
      });

      if (response.ok) {
        if (onAfterMove) {
          await onAfterMove({ type: 'folder', folderId });
        }
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || 'Failed to move folder'}`);
      }
    } catch (moveFolderError) {
      console.error('Error moving folder:', moveFolderError);
      alert('Failed to move folder. Please try again.');
    }
  }, [API_URL, findFolderById, folderContainsDescendant, onAfterMove, userFolders]);

  return {
    handleMoveFile,
    handleMoveFolder,
  };
}

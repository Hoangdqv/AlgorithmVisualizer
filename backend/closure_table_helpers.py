# closure_table_helpers.py
from datetime import datetime
from sqlalchemy.orm import aliased
from database import db
from models import Folder, ClosureTable, Language, File, FileSystemItem


def _owned_closure_query(user_account_id):
    """Scope closure rows to descendants owned by the given user through a join between ClosureTable and FileSystemItem on user_account_id."""
    return ClosureTable.query.join(
        FileSystemItem,
        ClosureTable.descendant == FileSystemItem.item_id
    ).filter(
        FileSystemItem.user_account_id == user_account_id
    )

def create_folder_with_closure(item_name, path, user_account_id, parent_item_id=None, item_type='user-defined', created_at=datetime.now()):
    """
    Create a new folder and update closure table with:
        item_name: Name of the folder
        path: Full path of the folder
        user_account_id: ID of the user creating the folder
        parent_item_id: ID of parent folder (None for root)
        item_type: 'user-defined' or 'sample'
    
    Returns:
        Folder object
    """
    # Create the folder
    new_folder = Folder(
        item_name=item_name,
        path=path,
        item_type=item_type,
        created_at=created_at,
        user_account_id=user_account_id,
        parent_item_id=parent_item_id
    )
    if parent_item_id:
        parent_folder = Folder.query.get(parent_item_id)
        if parent_folder is not None:
            parent_folder.children.append(new_folder)
    else:
        db.session.add(new_folder)
    db.session.flush()  # Get the folder_id
    
    # Check if self-reference already exists
    existing_self_ref = ClosureTable.query.filter_by(
        ancestor=new_folder.folder_id,
        descendant=new_folder.folder_id
    ).first()
    
    # Insert self-reference (depth=0) only if it doesn't exist
    if not existing_self_ref:
        new_folder.ancestors.append(ClosureTable(
            ancestor=new_folder.folder_id,
            depth=0
        ))
    
    # If has parent, copy all parent's ancestors
    if parent_item_id:
        # Get all ancestors of parent
        parent_ancestors = _owned_closure_query(user_account_id).filter(
            ClosureTable.descendant == parent_item_id
        ).all()
        
        # Create closure entries for each ancestor
        for ancestor_entry in parent_ancestors:
            new_folder.ancestors.append(ClosureTable(
                ancestor=ancestor_entry.ancestor,
                depth=ancestor_entry.depth + 1
            ))
    
    db.session.commit()
    return new_folder


def get_folder_tree(root_folder_id, user_account_id):
    """
    Get entire folder tree starting from root_folder_id.
    
    Args:
        root_folder_id: ID of root folder
        user_account_id: ID of the user
    
    Returns:
        List of tuples: (Folder, depth)
    """
    # Query all descendants with their depth
    query = db.session.query(Folder, ClosureTable.depth).join(
        ClosureTable, Folder.folder_id == ClosureTable.descendant
    ).filter(
        ClosureTable.ancestor == root_folder_id,
        Folder.user_account_id == user_account_id
    ).order_by(ClosureTable.depth, Folder.item_name)
    
    return query.all()


def get_all_descendants(folder_id, user_account_id):
    """
    Get all descendant folder IDs (not including self).
    
    Args:
        folder_id: ID of the folder
        user_account_id: ID of the user
    
    Returns:
        List of folder IDs
    """
    descendants = _owned_closure_query(user_account_id).filter(
        ClosureTable.ancestor == folder_id,
        ClosureTable.depth > 0
    ).all()
    
    return [d.descendant for d in descendants]


def is_descendant(ancestor_id, descendant_id, user_account_id):
    """
    Check if descendant_id is a descendant of ancestor_id.
    
    Args:
        ancestor_id: Potential ancestor folder ID
        descendant_id: Potential descendant folder ID
        user_account_id: ID of the user
    
    Returns:
        Boolean
    """
    entry = _owned_closure_query(user_account_id).filter(
        ClosureTable.ancestor == ancestor_id,
        ClosureTable.descendant == descendant_id
    ).first()
    
    return entry is not None


def delete_folder_cascade(folder_id, user_account_id):
    """
    Delete folder and all its descendants.
    Uses database CASCADE on closure_table.
    
    Args:
        folder_id: ID of folder to delete
        user_account_id: ID of the user (for verification)
    
    Returns:
        Number of folders deleted
    """
    # Get folder to delete
    folder = Folder.query.filter_by(folder_id=folder_id, user_account_id=user_account_id).first()
    if not folder:
        return 0

    # Get all its descendants
    descendant_ids = get_all_descendants(folder_id, user_account_id)
    deleted_count = len(descendant_ids) + 1

    parent_folder = folder.parent
    if parent_folder is not None:
        # Remove from the relationship
        parent_folder.children.remove(folder)
    else:
        # Root folders have no parent to detach from.
        db.session.delete(folder)

    db.session.commit()
    return deleted_count


def get_root_folders(user_account_id, item_type='user-defined'):
    """
    Get all root-level folders for a user.
    Root folders have no parent (parent_item_id IS NULL).
    
    Args:
        user_account_id: ID of the user
        item_type: 'user-defined' or 'sample'
    
    Returns:
        List of Folder objects
    """
    # Simply query folders with no parent
    root_folders = Folder.query.filter_by(
        user_account_id=user_account_id,
        item_type=item_type,
        parent_item_id=None
    ).all()
    
    return root_folders

def move_folder(folder_id, new_parent_id, user_account_id):
    """
    Move a folder to a new parent and update the closure table and paths.

    Args:
        folder_id: Folder to move
        new_parent_id: New parent folder id (None for root)
        user_account_id: ID of the user

    Returns:
        True when success
    """

    # Get folder to move
    folder = Folder.query.filter_by(folder_id=folder_id, user_account_id=user_account_id).first()
    if not folder:
        raise ValueError('Folder not found')

    if new_parent_id == folder_id:
        raise ValueError('Cannot move folder into itself')

    if new_parent_id is not None:
        # Get destination folder
        new_parent = Folder.query.filter_by(folder_id=new_parent_id, user_account_id=user_account_id).first()
        if not new_parent:
            raise ValueError('Destination folder not found')
        if is_descendant(folder_id, new_parent_id, user_account_id):
            raise ValueError('Cannot move folder into its descendant')
    else:
        new_parent = None

    # Collect subtree descendants including self.
    subtree_entries = _owned_closure_query(user_account_id).filter(
        ClosureTable.ancestor == folder_id
    ).all()
    descendant_ids = [entry.descendant for entry in subtree_entries]

    # Remove old ancestor relationships outside the subtree.
    old_ancestors = _owned_closure_query(user_account_id).filter(
        ClosureTable.descendant == folder_id,
        ClosureTable.ancestor != folder_id
    ).all()
    old_ancestor_ids = [entry.ancestor for entry in old_ancestors]

    if old_ancestor_ids:
        old_entries = ClosureTable.query.filter(
            ClosureTable.ancestor.in_(old_ancestor_ids),
            ClosureTable.descendant.in_(descendant_ids)
        ).all()
        for entry in old_entries:
            if entry.descendant_folder is not None:
                entry.descendant_folder.ancestors.remove(entry)
            elif entry.ancestor_folder is not None:
                entry.ancestor_folder.descendants.remove(entry)
            else:
                db.session.delete(entry)

    # Insert new ancestor relationships from the new parent.
    if new_parent is not None:
        new_ancestors = _owned_closure_query(user_account_id).filter(
            ClosureTable.descendant == new_parent_id
        ).all()

        for ancestor_entry in new_ancestors:
            for subtree_entry in subtree_entries:
                new_depth = ancestor_entry.depth + 1 + subtree_entry.depth
                db.session.add(ClosureTable(
                    ancestor=ancestor_entry.ancestor,
                    descendant=subtree_entry.descendant,
                    depth=new_depth
                ))

    # Update parent reference and paths.
    old_path = folder.path
    if new_parent is not None:
        new_path = f"{new_parent.path}/{folder.item_name}"
    else:
        new_path = f"/{folder.item_name}"

    folder.parent_item_id = new_parent_id
    folder.path = new_path

    if descendant_ids:
        descendant_folders = Folder.query.filter(
            Folder.folder_id.in_(descendant_ids)
        ).all()
        for descendant in descendant_folders:
            if descendant.folder_id == folder_id:
                continue
            descendant.path = descendant.path.replace(old_path, new_path, 1)

        descendant_files = File.query.filter(
            File.parent_item_id.in_(descendant_ids),
            File.user_account_id == user_account_id
        ).all()
        for file in descendant_files:
            file.path = file.path.replace(old_path, new_path, 1)

    db.session.commit()
    return True

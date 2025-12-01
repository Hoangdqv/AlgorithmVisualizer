# closure_table_helpers.py
"""Helper functions for closure table operations"""
from database import db
from models import Folder, ClosureTable

def create_folder_with_closure(folder_name, path, user_id, parent_folder_id=None, folder_type='user-defined'):
    """
    Create a new folder and update closure table.
    
    Args:
        folder_name: Name of the folder
        path: Full path of the folder
        user_id: ID of the user creating the folder
        parent_folder_id: ID of parent folder (None for root)
        folder_type: 'user-defined' or 'sample'
    
    Returns:
        Created Folder object
    """
    # Create the folder
    new_folder = Folder(
        folder_name=folder_name,
        path=path,
        folder_type=folder_type
    )
    db.session.add(new_folder)
    db.session.flush()  # Get the folder_id
    
    # Insert self-reference (depth=0)
    self_ref = ClosureTable(
        ancestor=new_folder.folder_id,
        descendant=new_folder.folder_id,
        depth=0,
        user_account_id=user_id
    )
    db.session.add(self_ref)
    
    # If has parent, copy all parent's ancestors
    if parent_folder_id:
        # Get all ancestors of parent
        parent_ancestors = ClosureTable.query.filter_by(
            descendant=parent_folder_id,
            user_account_id=user_id
        ).all()
        
        # Create closure entries for each ancestor
        for ancestor_entry in parent_ancestors:
            new_entry = ClosureTable(
                ancestor=ancestor_entry.ancestor,
                descendant=new_folder.folder_id,
                depth=ancestor_entry.depth + 1,
                user_account_id=user_id
            )
            db.session.add(new_entry)
    
    db.session.commit()
    return new_folder


def get_folder_tree(root_folder_id, user_id):
    """
    Get entire folder tree starting from root_folder_id.
    
    Args:
        root_folder_id: ID of root folder
        user_id: ID of the user
    
    Returns:
        List of tuples: (Folder, depth)
    """
    # Query all descendants with their depth
    query = db.session.query(Folder, ClosureTable.depth).join(
        ClosureTable, Folder.folder_id == ClosureTable.descendant
    ).filter(
        ClosureTable.ancestor == root_folder_id,
        ClosureTable.user_account_id == user_id
    ).order_by(ClosureTable.depth, Folder.folder_name)
    
    return query.all()


def get_all_descendants(folder_id, user_id):
    """
    Get all descendant folder IDs (not including self).
    
    Args:
        folder_id: ID of the folder
        user_id: ID of the user
    
    Returns:
        List of folder IDs
    """
    descendants = ClosureTable.query.filter(
        ClosureTable.ancestor == folder_id,
        ClosureTable.depth > 0,
        ClosureTable.user_account_id == user_id
    ).all()
    
    return [d.descendant for d in descendants]


def get_folder_path_list(folder_id, user_id):
    """
    Get the path from root to folder as list of folders.
    
    Args:
        folder_id: ID of the folder
        user_id: ID of the user
    
    Returns:
        List of Folder objects from root to target
    """
    # Get all ancestors ordered by depth (descending = root first)
    ancestors = db.session.query(Folder).join(
        ClosureTable, Folder.folder_id == ClosureTable.ancestor
    ).filter(
        ClosureTable.descendant == folder_id,
        ClosureTable.user_account_id == user_id
    ).order_by(ClosureTable.depth.desc()).all()
    
    return ancestors


def is_descendant(ancestor_id, descendant_id, user_id):
    """
    Check if descendant_id is a descendant of ancestor_id.
    
    Args:
        ancestor_id: Potential ancestor folder ID
        descendant_id: Potential descendant folder ID
        user_id: ID of the user
    
    Returns:
        Boolean
    """
    entry = ClosureTable.query.filter_by(
        ancestor=ancestor_id,
        descendant=descendant_id,
        user_account_id=user_id
    ).first()
    
    return entry is not None


def delete_folder_cascade(folder_id, user_id):
    """
    Delete folder and all its descendants.
    Uses database CASCADE on closure_table.
    
    Args:
        folder_id: ID of folder to delete
        user_id: ID of the user (for verification)
    
    Returns:
        Number of folders deleted
    """
    # Get all descendants (including self)
    descendant_ids = get_all_descendants(folder_id, user_id)
    descendant_ids.append(folder_id)
    
    # Delete all descendant folders (CASCADE will handle closure table)
    deleted_count = Folder.query.filter(
        Folder.folder_id.in_(descendant_ids)
    ).delete(synchronize_session=False)
    
    db.session.commit()
    return deleted_count


def move_folder(folder_id, new_parent_id, user_id):
    """
    Move a folder to a new parent.
    This is complex as it requires updating closure table relationships.
    
    Args:
        folder_id: ID of folder to move
        new_parent_id: ID of new parent folder (None for root)
        user_id: ID of the user
    
    Returns:
        Boolean success
    """
    # Verify not moving to its own descendant
    if new_parent_id and is_descendant(folder_id, new_parent_id, user_id):
        raise ValueError("Cannot move folder into its own descendant")
    
    # Get all descendants of moving folder (including self)
    moving_subtree = get_all_descendants(folder_id, user_id)
    moving_subtree.append(folder_id)
    
    # Delete old relationships (except self-references and internal subtree relationships)
    ClosureTable.query.filter(
        ClosureTable.descendant.in_(moving_subtree),
        ClosureTable.user_account_id == user_id,
        ~ClosureTable.ancestor.in_(moving_subtree)
    ).delete(synchronize_session=False)
    
    # Add new relationships
    if new_parent_id:
        # Get all ancestors of new parent
        new_ancestors = ClosureTable.query.filter_by(
            descendant=new_parent_id,
            user_account_id=user_id
        ).all()
        
        # For each node in moving subtree
        for moving_node_id in moving_subtree:
            # Get depth of this node relative to folder_id
            node_depth_query = ClosureTable.query.filter_by(
                ancestor=folder_id,
                descendant=moving_node_id,
                user_account_id=user_id
            ).first()
            node_relative_depth = node_depth_query.depth if node_depth_query else 0
            
            # Add relationship to each ancestor of new parent
            for ancestor_entry in new_ancestors:
                new_entry = ClosureTable(
                    ancestor=ancestor_entry.ancestor,
                    descendant=moving_node_id,
                    depth=ancestor_entry.depth + 1 + node_relative_depth,
                    user_account_id=user_id
                )
                db.session.add(new_entry)
    
    # Update folder path
    folder = Folder.query.get(folder_id)
    if new_parent_id:
        parent = Folder.query.get(new_parent_id)
        folder.path = f"{parent.path}/{folder.folder_name}"
    else:
        folder.path = f"/{folder.folder_name}"
    
    db.session.commit()
    return True


def get_root_folders(user_id, folder_type='user-defined'):
    """
    Get all root-level folders for a user.
    Root folders have depth=0 in closure table and no parent.
    
    Args:
        user_id: ID of the user
        folder_type: 'user-defined' or 'sample'
    
    Returns:
        List of Folder objects
    """
    # Find folders that are only descendants of themselves (depth=0, self-reference only)
    root_folders = db.session.query(Folder).join(
        ClosureTable, Folder.folder_id == ClosureTable.descendant
    ).filter(
        ClosureTable.user_account_id == user_id,
        ClosureTable.depth == 0,
        Folder.folder_type == folder_type
    ).group_by(Folder.folder_id).having(
        db.func.count(ClosureTable.ancestor) == 1
    ).all()
    
    return root_folders

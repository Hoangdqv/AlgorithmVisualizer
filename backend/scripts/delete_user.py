"""
Delete user by username or email
python backend/scripts/delete_user.py <username_or_email>
"""
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import app
from database import db
from models import User, File, Folder, ClosureTable

def delete_user(identifier):
    """Delete user by username or email"""
    with app.app_context():
        # Find user by username or email
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()
        
        if not user:
            print(f" User '{identifier}' not found")
            return False
        
        print(f"   ID: {user.id}")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   OAuth Provider: {user.oauth_provider or 'None'}")
        print(f"   Created: {user.created_at}")
        
        # Count user's files and folders
        file_count = File.query.filter_by(user_account_id=user.id).count()
        folder_count = Folder.query.filter_by(user_account_id=user.id).count()
        
        print(f"\n User data:")
        print(f"   Files: {file_count}")
        print(f"   Folders: {folder_count}")
        
        # Confirm deletion
        confirm = input(f"\n Delete user '{user.username}' and all associated data? (yes/no): ")
        
        if confirm.lower() != 'yes':
            print("Deletion cancelled")
            return False
        
        try:
            # Remove root-level files via relationship to trigger delete-orphan.
            root_files = [f for f in user.files if f.parent_item_id is None]
            for file in root_files:
                user.files.remove(file)

            # Delete user's folder tree(s) via helper to respect cascades.
            deleted_folders = 0
            root_folders = Folder.query.filter_by(user_account_id=user.id, parent_item_id=None).all()
            for folder in root_folders:
                deleted_folders += ClosureTable.delete_entry(folder.folder_id, user.id)

            # Delete user (remaining root files cascade from user.files).
            db.session.delete(user)
            db.session.commit()

            print(f" Deleted {file_count} file(s)")
            print(f"  Deleted {deleted_folders} folder(s)")
            print(f"\n User '{user.username}' deleted successfully!")
            return True

        except Exception as e:
            db.session.rollback()
            print(f"\n Error deleting user: {str(e)}")
            return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python delete_user.py <username_or_email>")
        print("Example: python delete_user.py john@example.com")
        sys.exit(1)
    
    identifier = sys.argv[1]
    success = delete_user(identifier)
    sys.exit(0 if success else 1)

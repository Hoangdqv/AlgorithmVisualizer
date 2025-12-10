"""
Delete user by username or email
Usage: python delete_user.py <username_or_email>
"""
import sys
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
            print(f"❌ User '{identifier}' not found")
            return False
        
        print(f"\n🔍 Found user:")
        print(f"   ID: {user.id}")
        print(f"   Username: {user.username}")
        print(f"   Email: {user.email}")
        print(f"   OAuth Provider: {user.oauth_provider or 'None'}")
        print(f"   Created: {user.created_at}")
        
        # Count user's files and folders
        file_count = File.query.filter_by(user_account_id=user.id).count()
        folder_count = Folder.query.filter_by(user_id=user.id).count()
        
        print(f"\n📊 User data:")
        print(f"   Files: {file_count}")
        print(f"   Folders: {folder_count}")
        
        # Confirm deletion
        confirm = input(f"\n⚠️  Delete user '{user.username}' and all associated data? (yes/no): ")
        
        if confirm.lower() != 'yes':
            print("❌ Deletion cancelled")
            return False
        
        try:
            # Delete user's files
            deleted_files = File.query.filter_by(user_account_id=user.id).delete()
            print(f"🗑️  Deleted {deleted_files} file(s)")
            
            # Get user's folder IDs
            folder_ids = [f.folder_id for f in Folder.query.filter_by(user_id=user.id).all()]
            
            # Delete closure table entries for user's folders
            if folder_ids:
                deleted_closures = ClosureTable.query.filter(
                    ClosureTable.descendant.in_(folder_ids)
                ).delete(synchronize_session=False)
                print(f"🗑️  Deleted {deleted_closures} closure table entry(ies)")
            
            # Delete user's folders
            deleted_folders = Folder.query.filter_by(user_id=user.id).delete()
            print(f"🗑️  Deleted {deleted_folders} folder(s)")
            
            # Delete user
            db.session.delete(user)
            db.session.commit()
            
            print(f"\n✅ User '{user.username}' deleted successfully!")
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error deleting user: {str(e)}")
            return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python delete_user.py <username_or_email>")
        print("Example: python delete_user.py john@example.com")
        sys.exit(1)
    
    identifier = sys.argv[1]
    success = delete_user(identifier)
    sys.exit(0 if success else 1)

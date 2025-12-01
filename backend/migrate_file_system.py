# migrate_file_system.py
"""Migration script to add file system tables and seed data"""
from app import app, db
from models import Language, Folder, File, ClosureTable

def migrate():
    """Create new file system tables and seed initial data"""
    with app.app_context():
        print("Creating file system tables...")
        
        # Create tables
        db.create_all()
        
        print("✓ Tables created successfully!")
        
        # Seed language data
        print("\nSeeding language data...")
        
        languages = [
            Language(lang_id=1, language='python', docker_image='python:3.13-alpine', run_cmd='python'),
            Language(lang_id=2, language='javascript', docker_image='node:22-alpine', run_cmd='node')
        ]
        
        # Check if languages already exist
        existing_langs = Language.query.all()
        if not existing_langs:
            for lang in languages:
                db.session.add(lang)
            db.session.commit()
            print(f"✓ Seeded {len(languages)} languages")
        else:
            print(f"✓ Languages already exist ({len(existing_langs)} found)")
        
        # Verify tables
        print("\nVerifying tables...")
        tables = ['language', 'folder', 'file', 'closure_table']
        for table in tables:
            if table in db.metadata.tables:
                print(f"  ✓ {table}")
            else:
                print(f"  ✗ {table} - NOT FOUND")
        
        print("\n" + "="*50)
        print("Migration complete!")
        print("="*50)
        print("\nNew tables:")
        print("  - language (programming languages)")
        print("  - folder (hierarchical folder structure)")
        print("  - file (user files with content)")
        print("  - closure_table (efficient folder tree queries)")
        print("\nYou can now:")
        print("  - Create user folders and files")
        print("  - Build hierarchical project structures")
        print("  - Query folder trees efficiently")

if __name__ == '__main__':
    migrate()

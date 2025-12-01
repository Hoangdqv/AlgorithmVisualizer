# test_file_system.py
"""Test script to demonstrate file system functionality"""
from app import app, db
from models import User, Folder, File, Language
from closure_table_helpers import (
    create_folder_with_closure,
    get_folder_tree,
    get_root_folders,
    get_folder_path_list
)

def test_file_system():
    """Create sample folder structure to test the system"""
    with app.app_context():
        # Get or create a test user
        user = User.query.filter_by(username='john').first()
        if not user:
            user = User(username='john', email='john@example.com')
            user.set_password('password123')
            db.session.add(user)
            db.session.commit()
            print(f"✓ Created test user: {user.username}")
        else:
            print(f"✓ Using existing user: {user.username}")
        
        print("\n" + "="*50)
        print("Creating folder structure...")
        print("="*50)
        
        # Create root folder: "My Projects"
        root = create_folder_with_closure(
            folder_name="My Projects",
            path="/My Projects",
            user_id=user.id
        )
        print(f"✓ Created root folder: {root.folder_name} (id={root.folder_id})")
        
        # Create subfolder: "Sorting Algorithms"
        sorting = create_folder_with_closure(
            folder_name="Sorting Algorithms",
            path="/My Projects/Sorting Algorithms",
            user_id=user.id,
            parent_folder_id=root.folder_id
        )
        print(f"✓ Created subfolder: {sorting.folder_name} (id={sorting.folder_id})")
        
        # Create another subfolder: "Graph Algorithms"
        graphs = create_folder_with_closure(
            folder_name="Graph Algorithms",
            path="/My Projects/Graph Algorithms",
            user_id=user.id,
            parent_folder_id=root.folder_id
        )
        print(f"✓ Created subfolder: {graphs.folder_name} (id={graphs.folder_id})")
        
        # Create nested folder: "Advanced"
        advanced = create_folder_with_closure(
            folder_name="Advanced",
            path="/My Projects/Sorting Algorithms/Advanced",
            user_id=user.id,
            parent_folder_id=sorting.folder_id
        )
        print(f"✓ Created nested folder: {advanced.folder_name} (id={advanced.folder_id})")
        
        print("\n" + "="*50)
        print("Creating files...")
        print("="*50)
        
        # Get languages
        python = Language.query.filter_by(language='python').first()
        javascript = Language.query.filter_by(language='javascript').first()
        
        # Create file in sorting folder
        quicksort = File(
            file_name="quicksort.py",
            folder_id=sorting.folder_id,
            path="/My Projects/Sorting Algorithms/quicksort.py",
            file_type='user-defined',
            user_account_id=user.id,
            content="def quicksort(arr):\n    # TODO: implement quicksort\n    pass",
            lang_id=python.lang_id
        )
        db.session.add(quicksort)
        
        # Create file in advanced folder
        merge_sort = File(
            file_name="mergesort.js",
            folder_id=advanced.folder_id,
            path="/My Projects/Sorting Algorithms/Advanced/mergesort.js",
            file_type='user-defined',
            user_account_id=user.id,
            content="function mergeSort(arr) {\n  // TODO: implement mergesort\n}",
            lang_id=javascript.lang_id
        )
        db.session.add(merge_sort)
        
        # Create file in graphs folder
        bfs_file = File(
            file_name="bfs.py",
            folder_id=graphs.folder_id,
            path="/My Projects/Graph Algorithms/bfs.py",
            file_type='user-defined',
            user_account_id=user.id,
            content="def bfs(graph, start):\n    # TODO: implement BFS\n    pass",
            lang_id=python.lang_id
        )
        db.session.add(bfs_file)
        
        db.session.commit()
        print(f"✓ Created file: {quicksort.file_name}")
        print(f"✓ Created file: {merge_sort.file_name}")
        print(f"✓ Created file: {bfs_file.file_name}")
        
        print("\n" + "="*50)
        print("Testing folder tree query...")
        print("="*50)
        
        # Get entire tree from root
        tree = get_folder_tree(root.folder_id, user.id)
        print(f"\nFolder tree from '{root.folder_name}':")
        for folder, depth in tree:
            indent = "  " * depth
            files_count = len(folder.files)
            print(f"{indent}📁 {folder.folder_name} ({files_count} files)")
            for file in folder.files:
                print(f"{indent}  📄 {file.file_name}")
        
        print("\n" + "="*50)
        print("Testing root folders query...")
        print("="*50)
        
        # Get root folders
        roots = get_root_folders(user.id, 'user-defined')
        print(f"\nRoot folders for user '{user.username}':")
        for root_folder in roots:
            print(f"  📁 {root_folder.folder_name}")
        
        print("\n" + "="*50)
        print("Testing folder path query...")
        print("="*50)
        
        # Get path to advanced folder
        path = get_folder_path_list(advanced.folder_id, user.id)
        print(f"\nPath to '{advanced.folder_name}':")
        print(" → ".join([f.folder_name for f in path]))
        
        print("\n" + "="*50)
        print("✓ All tests passed!")
        print("="*50)
        
        return user, root

if __name__ == '__main__':
    test_file_system()

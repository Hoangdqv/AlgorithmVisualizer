# test_api_endpoints.py
"""Test script for file system API endpoints"""
import requests
import json

BASE_URL = "http://localhost:5000"
session = requests.Session()

def print_response(response, title):
    """Pretty print API response"""
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"Status: {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, indent=2))
    except:
        print(response.text)

def test_apis():
    """Test all file system APIs"""
    
    # 1. Register a test user
    print("\n🔐 Testing Authentication...")
    register_data = {
        'username': 'testuser',
        'email': 'test@example.com',
        'password': 'password123'
    }
    response = session.post(f"{BASE_URL}/api/auth/register", json=register_data)
    if response.status_code == 409:
        # User exists, login instead
        login_data = {'username': 'testuser', 'password': 'password123'}
        response = session.post(f"{BASE_URL}/api/auth/login", json=login_data)
    print_response(response, "✓ Authenticated")
    
    # 2. Create root folder
    print("\n📁 Testing Folder Creation...")
    folder_data = {
        'folder_name': 'My Projects',
        'parent_folder_id': None
    }
    response = session.post(f"{BASE_URL}/api/user/folders", json=folder_data)
    print_response(response, "✓ Created Root Folder")
    root_folder_id = response.json().get('folder', {}).get('folder_id')
    
    # 3. Create subfolder
    subfolder_data = {
        'folder_name': 'Python Scripts',
        'parent_folder_id': root_folder_id
    }
    response = session.post(f"{BASE_URL}/api/user/folders", json=subfolder_data)
    print_response(response, "✓ Created Subfolder")
    subfolder_id = response.json().get('folder', {}).get('folder_id')
    
    # 4. Get all root folders
    response = session.get(f"{BASE_URL}/api/user/folders")
    print_response(response, "✓ Get Root Folders")
    
    # 5. Get folder tree
    response = session.get(f"{BASE_URL}/api/user/folders/{root_folder_id}/tree")
    print_response(response, "✓ Get Folder Tree")
    
    # 6. Create a file
    print("\n📄 Testing File Creation...")
    file_data = {
        'file_name': 'hello.py',
        'folder_id': subfolder_id,
        'content': 'print("Hello, World!")',
        'language': 'python'
    }
    response = session.post(f"{BASE_URL}/api/user/files", json=file_data)
    print_response(response, "✓ Created File")
    file_id = response.json().get('file', {}).get('file_id')
    
    # 7. Get file content
    response = session.get(f"{BASE_URL}/api/user/files/{file_id}")
    print_response(response, "✓ Get File Content")
    
    # 8. Update file content
    update_data = {
        'content': 'print("Hello, Updated World!")\nprint("New line added")'
    }
    response = session.put(f"{BASE_URL}/api/user/files/{file_id}", json=update_data)
    print_response(response, "✓ Updated File Content")
    
    # 9. Get all user files
    response = session.get(f"{BASE_URL}/api/user/files")
    print_response(response, "✓ Get All Files")
    
    # 10. Rename folder
    rename_data = {'folder_name': 'Python Code'}
    response = session.put(f"{BASE_URL}/api/user/folders/{subfolder_id}", json=rename_data)
    print_response(response, "✓ Renamed Folder")
    
    # 11. Create another file in root
    file_data2 = {
        'file_name': 'readme.md',
        'folder_id': root_folder_id,
        'content': '# My Projects\n\nThis is my project folder.',
        'language': 'python'  # We'll treat markdown as python for now
    }
    response = session.post(f"{BASE_URL}/api/user/files", json=file_data2)
    print_response(response, "✓ Created Another File")
    file_id2 = response.json().get('file', {}).get('file_id')
    
    # 12. Get files in specific folder
    response = session.get(f"{BASE_URL}/api/user/files?folder_id={root_folder_id}")
    print_response(response, "✓ Get Files in Folder")
    
    # 13. Test folder details
    response = session.get(f"{BASE_URL}/api/user/folders/{root_folder_id}")
    print_response(response, "✓ Get Folder Details")
    
    print("\n" + "="*60)
    print("✅ ALL API TESTS COMPLETED!")
    print("="*60)
    print("\nAPI Endpoints Tested:")
    print("  ✓ POST   /api/auth/register")
    print("  ✓ POST   /api/auth/login")
    print("  ✓ POST   /api/user/folders")
    print("  ✓ GET    /api/user/folders")
    print("  ✓ GET    /api/user/folders/:id")
    print("  ✓ GET    /api/user/folders/:id/tree")
    print("  ✓ PUT    /api/user/folders/:id")
    print("  ✓ POST   /api/user/files")
    print("  ✓ GET    /api/user/files")
    print("  ✓ GET    /api/user/files/:id")
    print("  ✓ PUT    /api/user/files/:id")
    print("\nCleanup Note:")
    print(f"  - Root folder ID: {root_folder_id}")
    print(f"  - To delete: DELETE /api/user/folders/{root_folder_id}")

if __name__ == '__main__':
    print("="*60)
    print("🚀 Testing File System API Endpoints")
    print("="*60)
    print("\nMake sure Flask server is running:")
    print("  cd backend && flask run --debug")
    print("\nPress Enter to start tests...")
    input()
    
    try:
        test_apis()
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to Flask server")
        print("   Make sure the server is running on http://localhost:5000")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

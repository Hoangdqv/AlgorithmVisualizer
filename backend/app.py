# app.py
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from datetime import datetime
import requests
from config import LANGUAGE_MAP, ALGORITHM_MAP, SAMPLE_CODE_DIR, SAMPLE_ALGORITHMS_DIR
from containerHandler import ContainerHandler
from database import db, init_db
import os
from sqlalchemy import event
from sqlalchemy.engine import Engine

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///algorithm_visualizer.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'  # Change this!
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS

# Enable foreign key constraints for SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# Initialize database
init_db(app)

# CORS configuration to allow credentials
CORS(app, supports_credentials=True, origins=['http://localhost:5173'])

PISTON_API_URL = "https://emkc.org/api/v2/piston"
container_handler = ContainerHandler()

def strip_docker_json_output(code):
    """Remove JSON output markers and content for display purposes."""
    lines = code.split('\n')
    filtered_lines = []
    skip_json = False
    
    for line in lines:
        # Check for JSON block markers
        if '--- TRACER_JSON_START ---' in line:
            skip_json = True
            continue
        if '--- TRACER_JSON_END ---' in line:
            skip_json = False
            continue
        if skip_json:
            continue
        
        # Skip the [DOCKER_JSON] marker
        if line.strip() in ['# [DOCKER_JSON]', '// [DOCKER_JSON]']:
            continue
            
        filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)

# Get list of samples for a language
@app.route('/api/samples/<language>', methods=['GET'])
def get_samples(language):
    lang_config = LANGUAGE_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    samples = [
        {
            'key': key,
            'name': sample['name'],
            'description': sample['description']
        }
        for key, sample in lang_config['samples'].items()
    ]
    
    return jsonify({'samples': samples})

#Get default sample algorithms
@app.route('/api/sample-algorithms/<language>', methods=['GET'])
def get_sample_algorithms(language):
    lang_config = ALGORITHM_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    algorithms = [
        {
            'key': key,
            'name': sample['name'],
            'description': sample['description']
        }
        for key, sample in lang_config['samples'].items()
    ]
    
    return jsonify({'algorithms': algorithms})


# Get default sample code 
@app.route('/api/sample-code/<language>', methods=['GET'])
def get_default_sample(language):
    lang_config = LANGUAGE_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    # Get first sample as default
    first_sample_key = list(lang_config['samples'].keys())[0]
    sample = lang_config['samples'][first_sample_key]
    filepath = os.path.join(SAMPLE_CODE_DIR, sample['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        return jsonify({
            'code': code,
            'language': language,
            'name': sample['name'],
            'description': sample['description']
        })
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404

# Get specific sample code
@app.route('/api/sample-code/<language>/<sample_key>', methods=['GET'])
def get_sample_code(language, sample_key):
    lang_config = LANGUAGE_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    sample = lang_config['samples'].get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404
    
    filepath = os.path.join(SAMPLE_CODE_DIR, sample['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        clean_code = strip_docker_json_output(code)
        
        return jsonify({
            'code': clean_code,
            'language': language,
            'name': sample['name'],
            'description': sample['description']
        })
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404

#Get specific sample algorithm code
@app.route('/api/sample-algorithm/<language>/<algorithm_key>', methods=['GET'])
def get_sample_algorithm_code(language, algorithm_key):
    lang_config = ALGORITHM_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    algorithm = lang_config['algorithms'].get(algorithm_key)
    if not algorithm:
        return jsonify({'error': 'Algorithm not found'}), 404
    
    filepath = os.path.join(SAMPLE_ALGORITHMS_DIR, algorithm['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        clean_code = strip_docker_json_output(code)
        
        return jsonify({
            'code': clean_code,
            'language': language,
            'name': algorithm['name'],
            'description': algorithm['description']
        })
    except FileNotFoundError:
        return jsonify({'error': 'Algorithm code file not found'}), 404

# Get algorithms by category and language
@app.route('/api/category/<category>/algorithms/<language>', methods=['GET'])
def get_category_algorithms(category, language):
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms = category_config['algorithms'].get(language.lower(), [])
    
    return jsonify({
        'category': category_config['display_name'],
        'language': language,
        'algorithms': algorithms
    })

# Get specific algorithm code by category
@app.route('/api/category/<category>/algorithm/<language>/<algorithm_key>', methods=['GET'])
def get_category_algorithm_code(category, language, algorithm_key):
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms = category_config['algorithms'].get(language.lower(), [])
    algorithm = next((algo for algo in algorithms if algo['key'] == algorithm_key), None)
    
    if not algorithm:
        return jsonify({'error': 'Algorithm not found'}), 404
    
    filepath = os.path.join(SAMPLE_ALGORITHMS_DIR, algorithm['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        # Try to read explanation file if it exists
        explanation = None
        if 'explanation_file' in algorithm:
            explanation_filepath = os.path.join(SAMPLE_ALGORITHMS_DIR, algorithm['explanation_file'])
            try:
                with open(explanation_filepath, 'r', encoding='utf-8') as f:
                    explanation = f.read()
            except FileNotFoundError:
                pass  # Explanation is optional
        
        return jsonify({
            'code': code,
            'language': language,
            'name': algorithm['name'],
            'description': algorithm['description'],
            'explanation': explanation
        })
    except FileNotFoundError:
        return jsonify({'error': 'Algorithm code file not found'}), 404

@app.route('/api/execute', methods=['POST'])
def execute_code():
    try:
        data = request.get_json()
        language = data.get('language', '').lower()
        code = data.get('code', '')
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        lang_config = LANGUAGE_MAP.get(language)
        if not lang_config:
            return jsonify({'error': f'Language {language} not supported'}), 400
        
        piston_language = lang_config['piston_name']
        
        piston_response = requests.post(
            f"{PISTON_API_URL}/execute",
            json={
                "language": piston_language,
                "version": "*",
                "files": [{"content": code}]
            }
        )
        
        if piston_response.status_code == 200:
            result = piston_response.json()
            return jsonify({
                'success': True,
                'output': result.get('run', {}).get('output', ''),
                'stderr': result.get('run', {}).get('stderr', ''),
                'code': result.get('run', {}).get('code', 0)
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to execute code'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    

@app.route('/api/execute/algorithm', methods=['POST'])
def execute_algorithm():
    try:
        data = request.get_json()
        language = data.get('language', '').lower()
        code = data.get('code', '')
        
        print(f"\n{'='*60}")
        print(f"[API] Received execution request for {language}")
        print(f"{'='*60}")
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        # Use containerHandler to execute
        result = container_handler.execute_algorithm(language, code)
        
        print(f"\n[API] Result: {'SUCCESS' if result.get('success') else 'FAILED'}")
        if result.get('success'):
            print(f"[API] Output length: {len(result.get('output', ''))} chars")
            if 'states' in result:
                print(f"[API] States count: {len(result['states'].get('states', []))}")
        else:
            print(f"[API] Error: {result.get('error')}")
        print(f"{'='*60}\n")
        
        if not result.get('success'):
            return jsonify(result), 500
            
        return jsonify(result)
            
    except Exception as e:
        print(f"[API] EXCEPTION: {str(e)}\n")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/process', methods=['POST'])
def process_json():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    try:
        states = data.get("states", [])
        if not states:
            return jsonify({"error": "No states found in data"}), 400
        
        processed_data = []
        for step_data in states:
            if isinstance(step_data, dict):
                step_info = {
                    "step": step_data.get("step", None),
                    "state": step_data.get("data", [])  # Changed from "array" to "data"
                }
                processed_data.append(step_info)
            else:
                return jsonify({"error": "Data should consist of one pair of state and step."}), 400
        
        return jsonify({"processed_data": processed_data}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================
# AUTHENTICATION ROUTES
# ============================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    from models import User
    
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    # Validation
    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 400
    
    # Create new user
    user = User(username=username, email=email)
    user.set_password(password)
    
    try:
        db.session.add(user)
        db.session.commit()
        
        # Log user in automatically
        session['user_id'] = user.id
        session['username'] = user.username
        
        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Registration failed'}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user with email or username"""
    from models import User
    from datetime import datetime
    
    data = request.get_json()
    identifier = data.get('username')  # Can be email or username
    password = data.get('password')
    
    if not identifier or not password:
        return jsonify({'error': 'Email/username and password are required'}), 400
    
    # Try to find user by email or username
    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()
    
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email/username or password'}), 401
    
    # Update last login
    user.last_login = datetime.now()
    db.session.commit()
    
    # Set session
    session['user_id'] = user.id
    session['username'] = user.username
    
    return jsonify({
        'message': 'Login successful',
        'user': user.to_dict()
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout user"""
    session.clear()
    return jsonify({'message': 'Logout successful'}), 200


@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    """Get current logged-in user"""
    from models import User
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    
    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({'user': user.to_dict()}), 200

@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset (placeholder for now)"""
    from models import User
    
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    # Always return success to prevent email enumeration
    if user:
        # TODO: Generate reset token and send email
        # For now, just log it
        print(f"Password reset requested for {email}")
    
    return jsonify({
        'message': 'If an account exists with that email, a password reset link will be sent.'
    }), 200

# ============================================
# FILE SYSTEM ROUTES
# ============================================

@app.route('/api/languages', methods=['GET'])
def get_languages():
    """Get all available programming languages"""
    from models import Language
    
    try:
        languages = Language.query.all()
        return jsonify({
            'languages': [{
                'lang_id': lang.lang_id,
                'language': lang.language,
                'docker_img': lang.docker_image,
                'run_cmd': lang.run_cmd
            } for lang in languages]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/folders', methods=['GET'])
def get_user_folders():
    """Get all root folders for current user"""
    from models import Folder
    from closure_table_helpers import get_root_folders
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        root_folders = get_root_folders(user_id, 'user-defined')
        return jsonify({
            'folders': [f.to_dict() for f in root_folders]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/folders/<int:folder_id>', methods=['GET'])
def get_folder_details(folder_id):
    """Get folder details including files"""
    from models import Folder
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    folder = Folder.query.get(folder_id)
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    return jsonify({'folder': folder.to_dict(include_files=True)}), 200


@app.route('/api/user/folders/<int:folder_id>/tree', methods=['GET'])
def get_folder_tree_route(folder_id):
    """Get entire folder tree from specified folder"""
    from models import Folder, File
    from closure_table_helpers import get_folder_tree
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        tree_data = get_folder_tree(folder_id, user_id)
        
        # Build hierarchical structure
        result = []
        for folder, depth in tree_data:
            folder_dict = folder.to_dict(include_files=False)
            folder_dict['depth'] = depth
            folder_dict['files'] = [f.to_dict(include_content=False) for f in folder.files]
            result.append(folder_dict)
        
        return jsonify({'tree': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/folders', methods=['POST'])
def create_folder():
    """Create a new folder"""
    from closure_table_helpers import create_folder_with_closure
    from models import Folder
    from models import ClosureTable

    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    
    data = request.get_json()
    folder_name = data.get('folder_name')
    parent_folder_id = data.get('parent_folder_id')  # None for root
    
    if not folder_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    try:
        # Check for duplicate folder name in the same parent
        if parent_folder_id:
            # Check siblings in parent folder
            existing = Folder.query.filter_by(
                folder_name=folder_name,
                user_id=user_id
            ).join(
                ClosureTable,
                ClosureTable.descendant == Folder.folder_id
            ).filter(
                ClosureTable.ancestor == parent_folder_id,
                ClosureTable.depth == 1
            ).first()
            
            if existing:
                return jsonify({'error': f'A folder named "{folder_name}" already exists in this location'}), 409
        else:
            # Check root level folders
            existing = Folder.query.filter_by(
                folder_name=folder_name,
                user_id=user_id
            ).outerjoin(
                ClosureTable,
                ClosureTable.descendant == Folder.folder_id
            ).filter(
                ClosureTable.ancestor == None
            ).first()
            
            if existing:
                return jsonify({'error': f'A folder named "{folder_name}" already exists at root level'}), 409
        
        # Build path
        if parent_folder_id:
            from models import Folder
            parent = Folder.query.get(parent_folder_id)
            if not parent:
                return jsonify({'error': 'Parent folder not found'}), 404
            if parent.user_id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            path = f"{parent.path}/{folder_name}"
        else:
            path = f"/{folder_name}"
        
        # Create folder with closure table
        new_folder = create_folder_with_closure(
            folder_name=folder_name,
            path=path,
            folder_type='user-defined',
            created_at=datetime.now(),
            user_id=user_id,
            parent_folder_id=parent_folder_id,
        )
        
        return jsonify({
            'message': 'Folder created successfully',
            'folder': new_folder.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/folders/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id):
    """Rename a folder"""
    from models import Folder
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    print(data)
    new_name = data.get('folder_name')
    
    if not new_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    folder = Folder.query.get(folder_id)
    if not folder:
        return jsonify({'error': 'Folder not found'}), 404
    
    try:
        # Update folder name and path
        old_path = folder.path
        folder.folder_name = new_name
        
        # Update path
        path_parts = old_path.rsplit('/', 1)
        if len(path_parts) > 1:
            folder.path = f"{path_parts[0]}/{new_name}"
        else:
            folder.path = f"/{new_name}"
        
        db.session.commit()
        
        return jsonify({
            'message': 'Folder renamed successfully',
            'folder': folder.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/folders/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id):
    """Delete a folder and all its contents"""
    from closure_table_helpers import delete_folder_cascade
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        deleted_count = delete_folder_cascade(folder_id, user_id)
        return jsonify({
            'message': f'Deleted {deleted_count} folder(s) successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/folders/<int:folder_id>/move', methods=['POST'])
def move_folder(folder_id):
    """Move folder to a new parent"""
    from closure_table_helpers import move_folder as move_folder_helper
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    new_parent_id = data.get('new_parent_id')  # None for root
    
    try:
        success = move_folder_helper(folder_id, new_parent_id, user_id)
        
        if success:
            return jsonify({'message': 'Folder moved successfully'}), 200
        else:
            return jsonify({'error': 'Failed to move folder'}), 500
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================
# FILE ROUTES
# ============================================

@app.route('/api/user/files', methods=['GET'])
def get_user_files():
    """Get all files for current user"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    folder_id = request.args.get('folder_id', type=int)
    
    try:
        if folder_id:
            # Get files in specific folder
            files = File.query.filter_by(
                user_account_id=user_id,
                folder_id=folder_id,
                file_type='user-defined'
            ).all()
        else:
            # Get all user files
            files = File.query.filter_by(
                user_account_id=user_id,
                file_type='user-defined'
            ).order_by(File.last_updated.desc()).all()
        
        return jsonify({
            'files': [f.to_dict(include_content=False) for f in files]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/files/<int:file_id>', methods=['GET'])
def get_file(file_id):
    """Get file content"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    file = File.query.filter_by(
        file_id=file_id,
        user_account_id=user_id
    ).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({'file': file.to_dict(include_content=True)}), 200


@app.route('/api/user/files', methods=['POST'])
def create_file():
    """Create a new file"""
    from models import File, Language, Folder
    from datetime import datetime
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json()
    print(data)
    file_name = data.get('file_name')
    folder_id = data.get('folder_id')  # None for root level
    language_id = data.get('language_id')
    content = data.get('content', '')
    
    if not file_name:
        return jsonify({'error': 'File name is required'}), 400
    
    try:
        # Check for duplicate file name in the same folder
        if folder_id:
            existing = File.query.filter_by(
                file_name=file_name,
                folder_id=folder_id,
                user_account_id=user_id
            ).first()
        else:
            existing = File.query.filter_by(
                file_name=file_name,
                folder_id=None,
                user_account_id=user_id
            ).first()
        
        if existing:
            return jsonify({'error': f'A file named "{file_name}" already exists in this location'}), 409
        
        
        # Build path
        if folder_id:
            folder = Folder.query.get(folder_id)
            if not folder:
                return jsonify({'error': 'Folder not found'}), 404
            if folder.user_id != user_id:
                return jsonify({'error': 'Access denied'}), 403
            path = f"{folder.path}/{file_name}"
        else:
            path = f"/{file_name}"
        
        # Create file
        new_file = File(
            file_name=file_name,
            folder_id=folder_id,
            path=path,
            file_type='user-defined',
            user_account_id=user_id,
            content=content,
            lang_id=language_id,
            created_at=datetime.now(),
            last_updated=datetime.now()
        )   
        
        db.session.add(new_file)
        db.session.commit()
        
        return jsonify({
            'message': 'File created successfully',
            'file': new_file.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/files/<int:file_id>', methods=['PUT'])
def update_file(file_id):
    """Update file content or rename file"""
    from models import File, Folder
    from datetime import datetime
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    
    file = File.query.filter_by(
        file_id=file_id,
        user_account_id=user_id
    ).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Update content if provided
        if 'content' in data:
            file.content = data['content']
        
        # Update file name if provided
        if 'file_name' in data:
            old_name = file.file_name
            new_name = data['file_name']
            file.file_name = new_name
            
            # Update path
            file.path = file.path.replace(old_name, new_name)
        
        file.last_updated = datetime.now()
        db.session.commit()
        
        return jsonify({
            'message': 'File updated successfully',
            'file': file.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    file = File.query.filter_by(
        file_id=file_id,
        user_account_id=user_id
    ).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    try:
        db.session.delete(file)
        db.session.commit()
        return jsonify({'message': 'File deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================
# SAMPLE FILES ROUTES (READ-ONLY)
# ============================================

@app.route('/api/samples/folders', methods=['GET'])
def get_sample_folders():
    """Get sample folder tree (read-only)"""
    from models import Folder
    
    try:
        sample_folders = Folder.query.filter_by(folder_type='sample').all()
        return jsonify({
            'folders': [f.to_dict(include_files=True) for f in sample_folders]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/samples/files/<int:file_id>', methods=['GET'])
def get_sample_file(file_id):
    """Get sample file content (read-only)"""
    from models import File
    
    file = File.query.filter_by(
        file_id=file_id,
        file_type='sample'
    ).first()
    
    if not file:
        return jsonify({'error': 'Sample file not found'}), 404
    
    return jsonify({'file': file.to_dict(include_content=True)}), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
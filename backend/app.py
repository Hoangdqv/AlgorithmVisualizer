# app.py
from flask import Flask, request, jsonify, session, Response
from flask_cors import CORS
from flask_mail import Mail, Message
from flask_migrate import Migrate
from datetime import datetime, timedelta, timezone
import requests
import threading
import queue
import json
from functools import wraps
from services.infrastructure.dockerExecutionService import dockerExecutionService
from services.application.executionService import executionService
from config import LANGUAGE_MAP, ALGORITHM_MAP, SAMPLE_CODE_DIR, SAMPLE_ALGORITHMS_DIR
from config import add_algorithm_config
from config import remove_algorithm_config
from config import add_sample_config
from config import remove_sample_config
from config import update_sample_config
from database import db, init_db
import os
import secrets
import re
from sqlalchemy import event
from sqlalchemy.engine import Engine


app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///algorithm_visualizer.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

# Email Configuration
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'true').lower() == 'true'
app.config['MAIL_USE_SSL'] = os.environ.get('MAIL_USE_SSL', 'false').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')  # Your email
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')  # Your app password
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))

# Initialize Flask-Mail
mail = Mail(app)

# Enable foreign key constraints for SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# Initialize database
init_db(app)

# Initialize Flask-Migrate
migrate = Migrate(app, db)

# CORS configuration to allow credentials
cors_origins = os.environ.get(
    'CORS_ORIGINS',
    'http://localhost:5173, http://127.0.0.1:5173'
)
CORS(
    app,
    supports_credentials=True,
    origins=[origin.strip() for origin in cors_origins.split(',') if origin.strip()]
)

docker_service = dockerExecutionService()
execution_service = executionService(docker_service)

# Server Startup cleanup: Remove leftover containers if any
def _startup_cleanup():
    try:
        client = docker_service._get_client()
        orphans = client.containers.list(
            all=True,
            filters={'ancestor': 'python:3.13-alpine', 'status': 'exited'}
        ) + client.containers.list(
            all=True,
            filters={'ancestor': 'node:22-alpine', 'status': 'exited'}
        )
        for c in orphans:
            try: c.remove()
            except: pass
    except Exception:
        pass

_startup_cleanup()

# run_id -> { container, temp_file, stop_event, raw_sock, output_q, lock }
active_runs = {}
active_runs_lock = threading.Lock()

# ============================================
# RBAC DECORATORS
# ============================================

def login_required(f):
    """Require user to be logged in"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Require user to be admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from models import User
        
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401
        
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

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


def _safe_join(base_dir, relative_path):
    base_abs = os.path.abspath(base_dir)
    target_abs = os.path.abspath(os.path.join(base_abs, relative_path))

    if os.path.commonpath([base_abs, target_abs]) != base_abs:
        return None

    return target_abs

# ============================================
# SIMPLE CODE SAMPLES ROUTES
# ============================================

@app.route('/api/samples', methods=['GET'])
def get_all_samples():
    """Get all languages with their samples"""
    result = {}
    for lang_key, lang_config in LANGUAGE_MAP.items():
        result[lang_key] = {
            'display_name': lang_config['display_name'],
            'samples': [
                {
                    'key': key,
                    'name': sample['name'],
                    'description': sample['description']
                }
                for key, sample in lang_config['samples'].items()
            ]
        }
    return jsonify({'languages': result})

@app.route('/api/samples/<language>', methods=['GET'])
def get_samples(language):
    """Get list of samples for a specific language"""
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

@app.route('/api/samples/<language>/<sample_key>', methods=['GET'])
def get_sample_code(language, sample_key):
    """Get specific sample code"""
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
            'description': sample['description'],
            'await_console_input': sample.get('await_console_input', False)
        })
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404


@app.route('/api/admin/sample-code', methods=['GET'])
@admin_required
def get_admin_sample_code_list():
    """Get all simple code samples for admin management"""
    samples = []

    for lang_key, lang_config in LANGUAGE_MAP.items():
        for key, sample in lang_config.get('samples', {}).items():
            samples.append({
                'language': lang_key,
                'key': key,
                'name': sample.get('name', key),
                'display_name': sample.get('name', key),
                'description': sample.get('description', ''),
                'file': sample.get('file', ''),
                'await_console_input': sample.get('await_console_input', False)
            })

    return jsonify({'samples': samples}), 200


@app.route('/api/admin/sample-code', methods=['POST'])
@admin_required
def create_admin_sample_code():
    """Create a simple code sample and register it for the playground"""
    from werkzeug.utils import secure_filename

    data = request.get_json() or {}
    language = secure_filename(data.get('language', '')).lower()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    await_console_input = data.get('await_console_input', False)

    if not language or not name:
        return jsonify({'error': 'Language and name are required'}), 400

    lang_config = LANGUAGE_MAP.get(language)
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    base_key = secure_filename(name.lower().replace(' ', '_'))
    if not base_key:
        return jsonify({'error': 'Name must contain letters or numbers'}), 400

    samples = lang_config.get('samples', {})
    sample_key = base_key
    suffix = 2
    while sample_key in samples:
        sample_key = f'{base_key}_{suffix}'
        suffix += 1

    valid_ext = '.py' if language == 'python' else '.js'
    relative_file = f'{language}/{sample_key}{valid_ext}'
    file_path = _safe_join(SAMPLE_CODE_DIR, relative_file)

    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    while os.path.exists(file_path):
        sample_key = f'{base_key}_{suffix}'
        suffix += 1
        relative_file = f'{language}/{sample_key}{valid_ext}'
        file_path = _safe_join(SAMPLE_CODE_DIR, relative_file)

        if not file_path:
            return jsonify({'error': 'Invalid sample file path'}), 400

    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        code = data.get('content') if 'content' in data else data.get('code')
        if code is None:
            code = '# Write sample code here\n' if language == 'python' else '// Write sample code here\n'

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)

        created = add_sample_config(
            language,
            sample_key,
            name,
            relative_file,
            description,
            await_console_input
        )

        if not created:
            return jsonify({'error': 'Failed to register sample code'}), 500

        return jsonify({
            'message': 'Sample code created successfully',
            'sample': {
                'language': language,
                'key': sample_key,
                'name': name,
                'display_name': name,
                'description': description,
                'await_console_input': bool(await_console_input)
            }
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create sample code: {str(e)}'}), 500


@app.route('/api/admin/sample-code/<language>/<sample_key>', methods=['GET'])
@admin_required
def get_admin_sample_code_details(language, sample_key):
    """Get a simple code sample for editing"""
    from werkzeug.utils import secure_filename

    language = secure_filename(language).lower()
    sample_key = secure_filename(sample_key)
    lang_config = LANGUAGE_MAP.get(language)

    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    sample = lang_config.get('samples', {}).get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404

    file_path = _safe_join(SAMPLE_CODE_DIR, sample.get('file', ''))
    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()

        return jsonify({
            'language': language,
            'key': sample_key,
            'name': sample.get('name', sample_key),
            'display_name': sample.get('name', sample_key),
            'description': sample.get('description', ''),
            'file': sample.get('file', ''),
            'filename': os.path.basename(sample.get('file', '')),
            'await_console_input': sample.get('await_console_input', False),
            'code': code
        }), 200
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Failed to read sample code: {str(e)}'}), 500


@app.route('/api/admin/sample-code/<language>/<sample_key>', methods=['PUT'])
@admin_required
def update_admin_sample_code_details(language, sample_key):
    """Update a simple code sample file and editable metadata"""
    from werkzeug.utils import secure_filename

    language = secure_filename(language).lower()
    sample_key = secure_filename(sample_key)
    lang_config = LANGUAGE_MAP.get(language)

    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    sample = lang_config.get('samples', {}).get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404

    file_path = _safe_join(SAMPLE_CODE_DIR, sample.get('file', ''))
    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    valid_ext = '.py' if language == 'python' else '.js'
    if not file_path.endswith(valid_ext):
        return jsonify({'error': f'Invalid file extension. Expected {valid_ext}'}), 400

    data = request.get_json() or {}
    code = data.get('content') if 'content' in data else data.get('code')

    if code is None:
        return jsonify({'error': 'Code content is required'}), 400

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)

        update_sample_config(
            language,
            sample_key,
            name=data.get('name'),
            description=data.get('description'),
            await_console_input=data.get('await_console_input')
            if 'await_console_input' in data
            else None
        )

        return jsonify({'message': 'Sample code updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update sample code: {str(e)}'}), 500


@app.route('/api/admin/sample-code/<language>/<sample_key>', methods=['DELETE'])
@admin_required
def delete_admin_sample_code(language, sample_key):
    """Delete a simple code sample file and registry entry"""
    from werkzeug.utils import secure_filename

    language = secure_filename(language).lower()
    sample_key = secure_filename(sample_key)
    lang_config = LANGUAGE_MAP.get(language)

    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    sample = lang_config.get('samples', {}).get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404

    file_path = _safe_join(SAMPLE_CODE_DIR, sample.get('file', ''))
    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    try:
        if os.path.exists(file_path):
            os.remove(file_path)

        removed = remove_sample_config(language, sample_key)
        if not removed:
            return jsonify({'error': 'Failed to unregister sample code'}), 500

        return jsonify({'message': 'Sample code deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete sample code: {str(e)}'}), 500

# ============================================
# EDUCATIONAL ALGORITHMS ROUTES
# ============================================

# @app.route('/api/algorithms', methods=['GET'])
# def get_all_algorithm_categories():
#     """Get all algorithm categories"""
#     categories = [
#         {
#             'key': key,
#             'name': config['display_name'],
#             'languages': list(config['algorithms'].keys())
#         }
#         for key, config in ALGORITHM_MAP.items()
#     ]
#     return jsonify({'categories': categories})

# @app.route('/api/algorithms/<category>', methods=['GET'])
# def get_category_info(category):
#     """Get category info with all algorithms across all languages"""
#     category_config = ALGORITHM_MAP.get(category.lower())
    
#     if not category_config:
#         return jsonify({'error': 'Category not found'}), 404
    
#     return jsonify({
#         'category': category_config['display_name'],
#         'algorithms': category_config['algorithms']
#     })

@app.route('/api/algorithms/<category>/<language>', methods=['GET'])
def get_category_algorithms(category, language):
    """Get algorithms for a specific category and language"""
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms_map = category_config['algorithms'].get(language.lower(), {})
    algorithms = [
        {
            'key': key,
            **algorithm
        }
        for key, algorithm in algorithms_map.items()
    ]
    
    return jsonify({
        'category': category_config['display_name'],
        'language': language,
        'algorithms': algorithms
    })

@app.route('/api/algorithms/<category>/<language>/<algorithm_key>', methods=['GET'])
def get_algorithm_code(category, language, algorithm_key):
    """Get specific algorithm code with explanation"""
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms_map = category_config['algorithms'].get(language.lower(), {})
    algorithm = algorithms_map.get(algorithm_key)
    
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
    from models import Language
    try:
        data = request.get_json()

        language = data.get('language', '').lower()
        code = data.get('code', '')
        file_name = data.get('file_name')
        language_row = Language.query.filter_by(language=language).first()
        cmd = language_row.get_run_cmd() if language_row else None
        docker_image = language_row.get_docker_image() if language_row else None

        execution_data = {
            'language': language,
            'code': code,
            'cmd': cmd,
            'docker_image': docker_image,
            'file_name': file_name
        }

        if not code:
            return jsonify({'error': 'No code provided'}), 400

        if language not in ('python', 'javascript'):
            return jsonify({'error': f'Language {language} not supported'}), 400

        result = execution_service.execute_code(**execution_data)

        if not result.get('success'):
            return jsonify({
                'success': False,
                'stderr': result.get('stderr', ''),
                'error_file': result.get('error_file')
            }), 500
        
        return jsonify({
            'success': True,
            'output': result.get('output', ''),
            'stderr': result.get('stderr', ''),
            'code': result.get('exit_code', 0)
        })

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    

def inject_params_block(code, language, params_block):
    """
    Replace the [PARAMS]...[/PARAMS] block in algorithm source code
    """
    if language == 'python':
        indented = '\n'.join('    ' + line for line in params_block.split('\n'))
        pattern = r'    # \[PARAMS\].*?    # \[/PARAMS\]'
        replacement = f'    # [PARAMS]\n{indented}\n    # [/PARAMS]'
    else:  # javascript
        pattern = r'// \[PARAMS\].*?// \[/PARAMS\]'
        replacement = f'// [PARAMS]\n{params_block}\n// [/PARAMS]'
    return re.sub(pattern, replacement, code, flags=re.DOTALL)


@app.route('/api/execute/algorithm', methods=['POST'])
def execute_algorithm():
    from models import Language
    try:
        data = request.get_json()
        params_block = data.get('params_block', None)

        language = data.get('language', '').lower()
        code = data.get('code', '')
        language_row = Language.query.filter_by(language=language).first()
        cmd = language_row.get_run_cmd() if language_row else None
        docker_image = language_row.get_docker_image() if language_row else None

        if params_block is not None:
            code = inject_params_block(code, language, params_block)

        execution_data = {
            'language': language,
            'code': code,
            'cmd': cmd,
            'docker_image': docker_image
        }
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        

        result = execution_service.execute_algorithm(**execution_data)
                
        if not result.get('success'):
            return jsonify({
                'success': False,
                'stderr': result.get('stderr', ''),
            }), 500
            
        return jsonify(result)
            
    except Exception as e:
        print(f"[API] EXCEPTION: {str(e)}\n")
        return jsonify({'success': False, 'error': str(e)}), 500

# @app.route('/process', methods=['POST'])
# def process_json():
#     data = request.get_json()
#     if not data:
#         return jsonify({"error": "Invalid or missing JSON payload"}), 400

#     try:
#         states = data.get("states", [])
#         if not states:
#             return jsonify({"error": "No states found in data"}), 400
        
#         processed_data = []
#         for step_data in states:
#             if isinstance(step_data, dict):
#                 step_info = {
#                     "step": step_data.get("step", None),
#                     "state": step_data.get("data", [])  # Changed from "array" to "data"
#                 }
#                 processed_data.append(step_info)
#             else:
#                 return jsonify({"error": "Data should consist of one pair of state and step."}), 400
        
#         return jsonify({"processed_data": processed_data}), 200

#     except Exception as e:
#         return jsonify({"error": str(e)}), 500


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
    
    # Check if user already exists
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'This username is already taken. Please try again.'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'This email is already taken. Please try again.'}), 400
    
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
    user.record_login()
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
    session['user_id'] = None
    session['username'] = None

    session.clear()

    return jsonify({'message': 'Logout successful'}), 200


@app.route('/api/auth/google', methods=['POST'])
def google_login():
    from models import User
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    
    data = request.get_json()
    token = data.get('credential')
    
    if not token:
        return jsonify({'error': 'No credential provided'}), 400
    
    try:
        # Verify
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        if not client_id:
            return jsonify({'error': 'Google OAuth not configured'}), 500
        
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            client_id,
            clock_skew_in_seconds=30
        )
        # Extract user info from Google
        google_id = idinfo['sub']
        email = idinfo.get('email')
        
        if not email:
            return jsonify({'error': 'No email provided by Google'}), 400
        
        # Check if user exists with this Google ID
        user = User.query.filter_by(oauth_provider='google', oauth_id=google_id).first()
        
        if not user:
            # Check if user exists with this email (link accounts)
            user = User.query.filter_by(email=email).first()
            
            if user:
                # Link existing account to Google
                user.link_oauth('google', google_id)
            else:
                # Create new user
                base_username = email.split('@')[0]
                username = base_username
                
                # Add random string if username already exists
                while User.query.filter_by(username=username).first():
                    random_suffix = secrets.token_hex(3)  # 6 random hex chars
                    username = f"{base_username}_{random_suffix}"
                
                user = User(
                    username=username,
                    email=email,
                    oauth_provider='google',
                    oauth_id=google_id,
                    password_hash=None 
                )
                db.session.add(user)
        
        user.record_login()
        db.session.commit()
        
        session['user_id'] = user.id
        session['username'] = user.username
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
        
    except ValueError:
        # Invalid token
        return jsonify({'error': 'Invalid Google token'}), 401
    except Exception as e:
        db.session.rollback()
        print(f"Google OAuth error: {str(e)}")
        return jsonify({'error': 'Authentication failed'}), 500


@app.route('/api/auth/link-google', methods=['POST'])
@login_required
def link_google_account():
    """Link a logged-in native account to Google OAuth."""
    from models import User
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    data = request.get_json()
    token = data.get('credential') if data else None

    if not token:
        return jsonify({'error': 'No credential provided'}), 400

    user_id = session.get('user_id')
    user = User.query.get(user_id)

    if not user:
        session.clear()
        return jsonify({'error': 'User not found'}), 404

    if user.oauth_provider == 'google' and user.oauth_id:
        return jsonify({'message': 'Google account already linked', 'user': user.to_dict()}), 200

    try:
        client_id = os.environ.get('GOOGLE_CLIENT_ID')
        if not client_id:
            return jsonify({'error': 'Google OAuth not configured'}), 500

        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
            clock_skew_in_seconds=30
        )

        google_id = idinfo.get('sub')
        email = idinfo.get('email')

        if not google_id or not email:
            return jsonify({'error': 'Invalid Google account data'}), 400

        if email.lower() != (user.email or '').lower():
            return jsonify({'error': 'Google account email must match your profile email'}), 400

        existing_google_user = User.query.filter_by(oauth_provider='google', oauth_id=google_id).first()
        if existing_google_user and existing_google_user.id != user.id:
            return jsonify({'error': 'This Google account is already linked to another user'}), 409

        user.link_oauth('google', google_id)
        db.session.commit()

        return jsonify({'message': 'Google account linked successfully', 'user': user.to_dict()}), 200
    except ValueError:
        return jsonify({'error': 'Invalid Google token'}), 401
    except Exception as e:
        db.session.rollback()
        print(f"Google link error: {str(e)}")
        return jsonify({'error': 'Failed to link Google account'}), 500


@app.route('/api/auth/check', methods=['GET'])
def check_session():
    """Check if user has active session (returns 200 regardless)"""
    from models import User
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'authenticated': False}), 200
    
    user = User.query.get(user_id)
    
    if not user:
        session.clear()
        return jsonify({'authenticated': False}), 200
    
    return jsonify({'authenticated': True, 'user': user.to_dict()}), 200


# @app.route('/api/auth/me', methods=['GET'])
# def get_current_user():
#     """Get current logged-in user"""
#     from models import User
    
#     user_id = session.get('user_id')
    
#     if not user_id:
#         return jsonify({'error': 'Not authenticated'}), 401
    
#     user = User.query.get(user_id)
    
#     if not user:
#         session.clear()
#         return jsonify({'error': 'User not found'}), 404
    
#     return jsonify({'user': user.to_dict()}), 200


# ============================================
# PASSWORD RESET ROUTES
# ============================================
def _utcnow():
    return datetime.now(timezone.utc)


def _to_aware_datetime(value):
    if value is None:
        return None

    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return None

    if not isinstance(value, datetime):
        return None

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value


def send_reset_email(email, token):
    """Send password reset email"""
    try:
        reset_link = f"http://localhost:5173/confirm-reset?token={token}"
        
        msg = Message(
            subject="Password Reset Request",
            recipients=[email],
            html=f"""
            <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #667eea;">Password Reset Request</h2>
                        <p>A request was made to reset your password for your Algorithm Visualizer account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{reset_link}" 
                               style="background-color: #667eea; 
                                      color: white; 
                                      padding: 12px 30px; 
                                      text-decoration: none; 
                                      border-radius: 5px;
                                      display: inline-block;">
                                Reset Password
                            </a>
                        </div>
                        <p style="color: #666; font-size: 14px;">
                            This link will expire in 1 hour.
                        </p>
                        <p style="color: #666; font-size: 14px;">
                            If you didn't request this, please ignore this email.
                        </p>
                    </div>
                </body>
            </html>
            """
        )
        
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return False
@app.route('/api/auth/forgot-password', methods=['POST'])
def forgot_password():
    """Request password reset - generates token"""
    from models import User, ResetTokens
    
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({
            'message': f'If an account with {email} exists, a password reset link has been sent.'
        }), 200
    
    # Generate secure random token
    token = secrets.token_urlsafe(32)
    
    # Delete any existing tokens for this user
    for token_row in list(user.reset_tokens):
        db.session.delete(token_row)
    
    # Create new reset token
    reset_token = ResetTokens(
        user_id=user.id,
        token=token,
        expires_at=_utcnow() + timedelta(minutes=30)
    )
    
    user.reset_tokens.append(reset_token)
    db.session.commit()
    
    # Send email
    email_sent = send_reset_email(user.email, token)
    
    if not email_sent:
        return jsonify({'error': 'An error has occured'}), 500
    
    return jsonify({
        'message': f'A password reset link has been sent to {email}.'

    }), 200


@app.route('/api/auth/confirm-reset', methods=['POST'])
def confirm_reset():
    """Confirm reset token, create session, and return redirect info"""
    from models import ResetTokens
    import uuid
    
    data = request.get_json()
    token = data.get('token')
    
    if not token:
        return jsonify({'error': 'Token is required'}), 400
    
    reset_token = ResetTokens.query.filter_by(token=token).first()
    
    if not reset_token:
        return jsonify({'error': 'Invalid or expired token'}), 400
    
    # Check if token is expired
    if reset_token.is_expired(_utcnow()):
        reset_token.consume()
        db.session.commit()
        return jsonify({'error': 'Token has expired'}), 400
    
    # Token is valid - create a reset session
    reset_session_id = str(uuid.uuid4())
    
    reset_session = {
        'user_id': reset_token.user_id,
        'created_at': _utcnow().isoformat(),
        'expires_at': (_utcnow() + timedelta(minutes=15)).isoformat()
    }
    
    # Store in Flask session
    session[f'reset_{reset_session_id}'] = reset_session
    
    # Delete the token immediately after verification (single use)
    reset_token.consume()
    db.session.commit()
    
    # Return confirmation
    response = jsonify({
        'valid': True,
        'message': 'Token verified. Redirecting to reset password page...'
    })
    
    # Set secure session cookie
    response.set_cookie(
        'reset_session',
        reset_session_id,
        max_age=900,  # 15 minutes
        secure=app.config.get('SESSION_COOKIE_SECURE', False),
        httponly=True,  # Not accessible via JavaScript
        samesite='Lax'
    )
    
    return response, 200


# @app.route('/api/auth/verify-reset-token', methods=['POST'])
# def verify_reset_token():
#     """Verify reset token and create a reset session"""
#     from models import ResetTokens
#     import uuid
    
#     data = request.get_json()
#     token = data.get('token')
    
#     if not token:
#         return jsonify({'error': 'Token is required'}), 400
    
#     reset_token = ResetTokens.query.filter_by(token=token).first()
    
#     if not reset_token:
#         return jsonify({'error': 'Invalid or expired token'}), 400
    
#     # Check if token is expired
#     token_expires_at = _to_aware_datetime(reset_token.expires_at)
#     if not token_expires_at or _utcnow() > token_expires_at:
#         db.session.delete(reset_token)
#         db.session.commit()
#         return jsonify({'error': 'Token has expired'}), 400
    
#     # Token is valid - create a reset session
#     # Generate session ID for this reset attempt
#     reset_session_id = str(uuid.uuid4())
    
#     # Store session data (valid for 15 minutes)
#     reset_session = {
#         'user_id': reset_token.user_id,
#         'created_at': _utcnow().isoformat(),
#         'expires_at': (_utcnow() + timedelta(minutes=15)).isoformat()
#     }
    
#     # Store in Flask session
#     session[f'reset_{reset_session_id}'] = reset_session
    
#     # Delete the token immediately after verification (single use)
#     db.session.delete(reset_token)
#     db.session.commit()
    
#     # Return session ID (not the token)
#     response = jsonify({
#         'valid': True,
#         'message': 'Token verified. You can now reset your password.',
#         'session_id': reset_session_id
#     })
    
#     # Set secure session cookie
#     response.set_cookie(
#         'reset_session',
#         reset_session_id,
#         max_age=900,  # 15 minutes
#         secure=app.config.get('SESSION_COOKIE_SECURE', False),
#         httponly=True,  # Not accessible via JavaScript
#         samesite='Lax'
#     )
    
#     return response, 200


@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """Reset password using valid reset session (from HttpOnly cookie)"""
    from models import User
    
    data = request.get_json()
    new_password = data.get('password')
    
    # Get session ID from HttpOnly cookie
    session_id = request.cookies.get('reset_session')
    
    if not session_id or not new_password:
        return jsonify({'error': 'Session and password are required'}), 400
    
    # Validate reset session
    reset_session_key = f'reset_{session_id}'
    reset_session = session.get(reset_session_key)
    
    if not reset_session:
        return jsonify({'error': 'Invalid or expired reset session'}), 400
    
    # Check if session is expired
    session_expires_at = _to_aware_datetime(reset_session.get('expires_at'))
    if not session_expires_at or _utcnow() > session_expires_at:
        session.pop(reset_session_key, None)
        return jsonify({'error': 'Reset session has expired'}), 400
    
    # Get user from session
    user_id = reset_session.get('user_id')
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Update password
    user.set_password(new_password)
    db.session.commit()
    
    # Delete the used session
    session.pop(reset_session_key, None)
    
    # Clear reset session cookie
    response = jsonify({
        'message': 'Password has been reset successfully'
    })
    response.set_cookie('reset_session', '', max_age=0)  # Delete cookie
    
    return response, 200


# ============================================
# USER PROFILE ROUTES
# ============================================

# @app.route('/api/user/profile', methods=['GET'])
# @login_required
# def get_profile():
#     """Get current user profile"""
#     from models import User
    
#     user_id = session.get('user_id')
#     user = User.query.get(user_id)
    
#     if not user:
#         return jsonify({'error': 'User not found'}), 404
    
#     return jsonify({'user': user.to_dict()}), 200


@app.route('/api/user/profile', methods=['PUT'])
@login_required
def update_profile():
    """Update user profile (username and email)"""
    from models import User
    
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    
    # Validate inputs
    if not username or not email:
        return jsonify({'error': 'Username and email are required'}), 400
    
    # Check if username is taken by another user
    if username != user.username:
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({'error': 'This username is already taken. Please try again.'}), 400
    
    # Check if email is taken by another user
    if email != user.email:
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'This email is already taken. Please try again.'}), 400
    
    # Update user
    user.username = username
    user.email = email
    
    try:
        db.session.commit()
        session['username'] = username  # Update session
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update profile'}), 500


@app.route('/api/user/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password"""
    from models import User
    
    user_id = session.get('user_id')
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current and new passwords are required'}), 400
    
    # Check if user has a password (OAuth users don't)
    if not user.password_hash:
        return jsonify({'error': 'Cannot change password for OAuth accounts'}), 400
    
    # Verify current password
    if not user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect'}), 401
    
    # Update password
    user.set_password(new_password)
    
    try:
        db.session.commit()
        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to change password'}), 500


# ============================================
# ADMIN ROUTES - ALGORITHM MANAGEMENT
# ============================================

@app.route('/api/admin/categories', methods=['GET'])
@admin_required
def get_categories():
    """Get all algorithm categories"""
    categories = []
    
    if os.path.exists(SAMPLE_ALGORITHMS_DIR):
        for item in os.listdir(SAMPLE_ALGORITHMS_DIR):
            item_path = os.path.join(SAMPLE_ALGORITHMS_DIR, item)
            if os.path.isdir(item_path) and not item.startswith('.'):
                categories.append(item)
    
    return jsonify({'categories': sorted(categories)}), 200


@app.route('/api/admin/algorithms', methods=['GET'])
@admin_required
def get_all_algorithms():
    """Get all algorithms across all categories"""
    from werkzeug.utils import secure_filename
    
    algorithms = []
    
    if not os.path.exists(SAMPLE_ALGORITHMS_DIR):
        return jsonify({'algorithms': []}), 200
    
    for category in os.listdir(SAMPLE_ALGORITHMS_DIR):
        category_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category)
        
        if not os.path.isdir(category_path) or category.startswith('.'):
            continue
        
        for algorithm in os.listdir(category_path):
            algorithm_path = os.path.join(category_path, algorithm)
            
            if not os.path.isdir(algorithm_path) or algorithm.startswith('.'):
                continue
            
            # Check for required files
            has_python = os.path.exists(os.path.join(algorithm_path, 'python'))
            has_javascript = os.path.exists(os.path.join(algorithm_path, 'javascript'))
            has_explanation = os.path.exists(os.path.join(algorithm_path, 'explanation.txt'))
            
            algorithms.append({
                'category': category,
                'name': algorithm,
                'display_name': algorithm.replace('_', ' ').title(),
                'has_python': has_python,
                'has_javascript': has_javascript,
                'has_explanation': has_explanation
            })
    
    return jsonify({'algorithms': algorithms}), 200


@app.route('/api/admin/algorithms/<category>/<algorithm>', methods=['GET'])
@admin_required
def get_algorithm_details(category, algorithm):
    """Get details of a specific algorithm"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    
    algorithm_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm)
    
    if not os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm not found'}), 404
    
    details = {
        'category': category,
        'name': algorithm,
        'display_name': algorithm.replace('_', ' ').title(),
        'explanation': None,
        'languages': {}
    }
    
    # Get explanation
    explanation_path = os.path.join(algorithm_path, 'explanation.txt')
    if os.path.exists(explanation_path):
        with open(explanation_path, 'r', encoding='utf-8') as f:
            details['explanation'] = f.read()
    
    # Get code files for each language
    for lang in ['python', 'javascript']:
        lang_dir = os.path.join(algorithm_path, lang)
        if os.path.exists(lang_dir):
            files = []
            for file in os.listdir(lang_dir):
                if file.endswith('.py' if lang == 'python' else '.js'):
                    file_path = os.path.join(lang_dir, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        files.append({
                            'filename': file,
                            'content': f.read()
                        })
            details['languages'][lang] = files
    
    return jsonify(details), 200


@app.route('/api/admin/algorithms/<category>/<algorithm>/explanation', methods=['PUT'])
@admin_required
def update_explanation(category, algorithm):
    """Update algorithm explanation"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    
    algorithm_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm)
    
    if not os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm not found'}), 404
    
    data = request.get_json()
    explanation = data.get('explanation')
    
    if explanation is None:
        return jsonify({'error': 'Explanation content is required'}), 400
    
    explanation_path = os.path.join(algorithm_path, 'explanation.txt')
    
    try:
        with open(explanation_path, 'w', encoding='utf-8') as f:
            f.write(explanation)
        return jsonify({'message': 'Explanation updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update explanation: {str(e)}'}), 500


@app.route('/api/admin/algorithms/<category>/<algorithm>/code/<language>/<filename>', methods=['GET'])
@admin_required
def get_algorithm_code_file(category, algorithm, language, filename):
    """Get algorithm code file for editing"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    language = secure_filename(language)
    filename = secure_filename(filename)
    
    # Validate language
    if language not in ['python', 'javascript']:
        return jsonify({'error': 'Invalid language'}), 400
    
    file_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm, language, filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()
        return jsonify({
            'code': code,
            'category': category,
            'algorithm': algorithm,
            'language': language,
            'filename': filename,
            'path': file_path
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to read code file: {str(e)}'}), 500


@app.route('/api/admin/algorithms/<category>/<algorithm>/code/<language>/<filename>', methods=['PUT'])
@admin_required
def update_code_file(category, algorithm, language, filename):
    """Update algorithm code file"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    language = secure_filename(language)
    filename = secure_filename(filename)
    
    # Validate language
    if language not in ['python', 'javascript']:
        return jsonify({'error': 'Invalid language'}), 400
    
    # Validate file extension
    valid_ext = '.py' if language == 'python' else '.js'
    if not filename.endswith(valid_ext):
        return jsonify({'error': f'Invalid file extension. Expected {valid_ext}'}), 400
    
    file_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm, language, filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    data = request.get_json()
    # Accept both 'code' and 'content' for flexibility
    code = data.get('content') or data.get('code')
    
    if code is None:
        return jsonify({'error': 'Code content is required'}), 400
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)
        return jsonify({'message': 'Code file updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update code file: {str(e)}'}), 500


@app.route('/api/admin/algorithms', methods=['POST'])
@admin_required
def create_algorithm():
    """Create a new algorithm"""
    from werkzeug.utils import secure_filename
    
    data = request.get_json()
    category = secure_filename(data.get('category', ''))
    algorithm_name = secure_filename(data.get('name', ''))
    explanation = data.get('explanation', '')
    
    if not category or not algorithm_name:
        return jsonify({'error': 'Category and algorithm name are required'}), 400
    
    # Check if category exists
    category_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category)
    if not os.path.exists(category_path):
        return jsonify({'error': 'Category does not exist'}), 404
    
    algorithm_path = os.path.join(category_path, algorithm_name)
    
    # Check if algorithm already exists
    if os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm already exists'}), 400
    
    try:
        # Create algorithm directory
        os.makedirs(algorithm_path)
        
        # Create explanation file
        explanation_path = os.path.join(algorithm_path, 'explanation.txt')
        with open(explanation_path, 'w', encoding='utf-8') as f:
            f.write(explanation if explanation else f'{algorithm_name.replace("_", " ").title()} - Algorithm Explanation\n\n[Add explanation here]')
        
        # Create language directories
        os.makedirs(os.path.join(algorithm_path, 'python'))
        os.makedirs(os.path.join(algorithm_path, 'javascript'))
        
        # Create placeholder files
        python_file = os.path.join(algorithm_path, 'python', f'{algorithm_name}.py')
        with open(python_file, 'w', encoding='utf-8') as f:
            f.write(f'# {algorithm_name.replace("_", " ").title()}\n\nfrom runtime.tracer import Tracer\n# Add algorithm implementation here\n\nif __name__ == "__main__":\n#[PARAMS]\n    # Add parameters here\n#[PARAMS]\n    main()\n')
        
        javascript_file = os.path.join(algorithm_path, 'javascript', f'{algorithm_name}.js')
        with open(javascript_file, 'w', encoding='utf-8') as f:
            f.write(f"// {algorithm_name.replace("_", " ").title()}\n\nimport Tracer from './runtime/tracer.js';\n// Add algorithm implementation here\n//[PARAMS]\n    // Add parameters here\n//[PARAMS] \n\ntracer.finalize();\n")

        # Add algorithm to config
        display_name = f'{algorithm_name.replace("_", " ").title()}'
        explanation_relative_path = f'{category}/{algorithm_name}/explanation.txt'
        python_relative_path = f'{category}/{algorithm_name}/python/{algorithm_name}.py'
        javascript_relative_path = f'{category}/{algorithm_name}/javascript/{algorithm_name}.js'

        add_algorithm_config(
            category,
            algorithm_name,
            display_name,
            python_relative_path,
            f'{display_name} algorithm',
            'python',
            explanation_file=explanation_relative_path
        )
        add_algorithm_config(
            category,
            algorithm_name,
            display_name,
            javascript_relative_path,
            f'{display_name} algorithm',
            'javascript',
            explanation_file=explanation_relative_path
        )

        return jsonify({
            'message': 'Algorithm created successfully',
            'algorithm': {
                'category': category,
                'name': algorithm_name
            }
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create algorithm: {str(e)}'}), 500


@app.route('/api/admin/algorithms/<category>/<algorithm>', methods=['DELETE'])
@admin_required
def delete_algorithm(category, algorithm):
    """Delete an algorithm"""
    from werkzeug.utils import secure_filename
    import shutil
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    
    algorithm_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm)
    
    if not os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm not found'}), 404
    
    try:
        shutil.rmtree(algorithm_path)
        remove_algorithm_config(category, algorithm)
        return jsonify({'message': 'Algorithm deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete algorithm: {str(e)}'}), 500


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
                'cmd': lang.run_cmd
            } for lang in languages]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/folders', methods=['GET'])
def get_user_folders():
    """Get all root folders for current user"""
    from models import ClosureTable
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        root_folders = ClosureTable.get_root_folders(user_id, 'user-defined')
        return jsonify({
            'folders': [f.to_dict() for f in root_folders]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# @app.route('/api/user/folders/<int:folder_id>', methods=['GET'])
# def get_folder_details(folder_id):
#     """Get folder details including files"""
#     from models import Folder
    
#     user_id = session.get('user_id')
#     if not user_id:
#         return jsonify({'error': 'Not authenticated'}), 401
    
#     folder = Folder.query.get(folder_id)
#     if not folder:
#         return jsonify({'error': 'Folder not found'}), 404
    
#     return jsonify({'folder': folder.to_dict(include_files=True)}), 200


@app.route('/api/user/folders/<int:folder_id>/tree', methods=['GET'])
def get_hierarchy_route(folder_id):
    """Get entire folder tree from specified folder"""
    from models import Folder, File, ClosureTable
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        tree_data = ClosureTable.get_hierarchy(folder_id, user_id)
        
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
def add_entry():
    """Create a new folder"""
    from models import Folder

    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    
    data = request.get_json()
    item_name = data.get('item_name')
    parent_item_id = data.get('parent_item_id')  # None for root
    
    if not item_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    try:
        new_folder, error = Folder.create_for_user(
            user_account_id=user_id,
            item_name=item_name,
            parent_item_id=parent_item_id,
            item_type='user-defined',
            created_at=datetime.now(),
        )

        if error:
            return jsonify({'error': error['message']}), error['status']
        
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
    new_name = data.get('item_name')
    
    if not new_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    try:
        folder, error = Folder.rename_for_user(folder_id, user_id, new_name)

        if error:
            return jsonify({'error': error['message']}), error['status']
        
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
    from models import ClosureTable
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        deleted_count = ClosureTable.delete_entry(folder_id, user_id)
        return jsonify({
            'message': f'Deleted {deleted_count} folder(s) successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/folders/<int:folder_id>/move', methods=['POST'])
def move_entry(folder_id):
    """Move folder to a new parent"""
    from models import Folder
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    new_parent_id = data.get('new_parent_id')  # None for root
    
    try:
        success, error = Folder.move_for_user(folder_id, new_parent_id, user_id)

        if error:
            return jsonify({'error': error['message']}), error['status']

        if success:
            return jsonify({'message': 'Folder moved successfully'}), 200
        else:
            return jsonify({'error': 'Failed to move folder'}), 500
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
    
    parent_item_id = request.args.get('parent_item_id', type=int)
    
    try:
        if parent_item_id is not None:
            # Get files in specific folder
            files = File.query.filter_by(
                user_account_id=user_id,
                parent_item_id=parent_item_id,
                item_type='user-defined'
            ).all()
        else:
            # Get all user files
            files = File.query.filter_by(
                user_account_id=user_id,
                item_type='user-defined'
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
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json()
    item_name = data.get('item_name')
    parent_item_id = data.get('parent_item_id')  # None for root level
    language_id = data.get('language_id')
    content = data.get('content', '')
    
    if not item_name:
        return jsonify({'error': 'File name is required'}), 400
    if language_id is None:
        return jsonify({'error': 'language_id is required'}), 400
    
    try:
        new_file, error = File.create_for_user(
            user_account_id=user_id,
            item_name=item_name,
            parent_item_id=parent_item_id,
            language_id=language_id,
            content=content
        )

        if error:
            return jsonify({'error': error['message']}), error['status']
        
        return jsonify({
            'message': 'File created successfully',
            'file': new_file.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/files/<int:file_id>', methods=['PUT'])
def update_file(file_id):
    """Update file content, rename file, or move file"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    
    try:
        file, error = File.update_for_user(file_id, user_id, data)

        if error:
            return jsonify({'error': error['message']}), error['status']
        
        return jsonify({
            'message': 'File updated successfully',
            'file': file.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/files/upload-image', methods=['POST'])
def upload_user_image_file():
    """Upload an image file directly as binary blob"""
    from models import File

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    upload = request.files.get('file')
    item_name = request.form.get('item_name')
    parent_item_id_raw = request.form.get('parent_item_id')
    language_id_raw = request.form.get('language_id')

    parent_item_id = int(parent_item_id_raw) if parent_item_id_raw not in (None, '', 'null') else None
    language_id = int(language_id_raw) if language_id_raw not in (None, '') else None

    if not upload:
        return jsonify({'error': 'Image file is required'}), 400
    if not item_name:
        return jsonify({'error': 'File name is required'}), 400
    if language_id is None:
        return jsonify({'error': 'language_id is required'}), 400

    mime_type = upload.mimetype or 'application/octet-stream'
    if not mime_type.startswith('image/'):
        return jsonify({'error': 'Only image uploads are supported for this route'}), 400

    # Return of read() is a bytes object and store into content_blob in DB
    blob_content = upload.read()
    if not blob_content:
        return jsonify({'error': 'Uploaded image is empty'}), 400

    try:
        new_file, error = File.create_image_for_user(
            user_account_id=user_id,
            item_name=item_name,
            parent_item_id=parent_item_id,
            language_id=language_id,
            blob_content=blob_content,
            mime_type=mime_type
        )

        if error:
            return jsonify({'error': error['message']}), error['status']

        return jsonify({
            'message': 'Image file uploaded successfully',
            'file': new_file.to_dict(include_content=False)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@app.route('/api/user/files/<int:file_id>/binary', methods=['GET'])
def get_file_binary(file_id):
    """Get binary file content for user-owned files"""
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
    if not file.content_blob:
        return jsonify({'error': 'No binary content available for this file'}), 404

    return Response(
        file.content_blob,
        mimetype=file.content_mime or 'application/octet-stream',
        headers={
            'Content-Disposition': f'inline; filename="{file.item_name}"'
        }
    )


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
    
    parent_folder = file.folder
    file_owner = file.user
    try:
        if parent_folder is not None:
            # Remove from folder relationship
            parent_folder.files.remove(file)
        elif file_owner is not None:
            # Root-level files rely on the user
            file_owner.files.remove(file)
        else:
            db.session.delete(file)
        db.session.commit()
        return jsonify({'message': 'File deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================
# SAMPLE FILES ROUTES (READ-ONLY)
# ============================================

# @app.route('/api/samples/folders', methods=['GET'])
# def get_sample_folders():
#     """Get sample folder tree (read-only)"""
#     from models import Folder
    
#     try:
#         sample_folders = Folder.query.filter_by(folder_type='sample').all()
#         return jsonify({
#             'folders': [f.to_dict(include_files=True) for f in sample_folders]
#         }), 200
#     except Exception as e:
#         return jsonify({'error': str(e)}), 500


# @app.route('/api/samples/files/<int:file_id>', methods=['GET'])
# def get_sample_file(file_id):
#     """Get sample file content (read-only)"""
#     from models import File
    
#     file = File.query.filter_by(
#         file_id=file_id,
#         file_type='sample'
#     ).first()
    
#     if not file:
#         return jsonify({'error': 'Sample file not found'}), 404
    
#     return jsonify({'file': file.to_dict(include_content=True)}), 200


# ============================================
# INTERACTIVE EXECUTION — SSE (Server-Sent Events)
# ============================================

MAX_INTERACTIVE_TIMEOUT = 30  # seconds before container is killed automatically
STDIN_TIMEOUT_EXTENSION = 15  # extra seconds granted per stdin submission
MAX_TOTAL_TIMEOUT = 120       # hard cap — container can never live longer than this


def _cleanup_run(run_id):
    """Kill container and free all resources for a run."""
    with active_runs_lock:
        run_data = active_runs.pop(run_id, None)
    if not run_data:
        return
    # Cancel the wall-time timer first so it cannot fire after cleanup
    timer = run_data.get('timer')
    if timer:
        timer.cancel()
    # Signal the reader thread to stop
    run_data['stop_event'].set()
    # Close the raw socket so the reader unblocks
    raw = run_data.get('raw_sock')
    if raw:
        try:
            raw.close()
        except Exception:
            pass
    # Kill/remove the container
    container = run_data.get('container')
    if container:
        docker_service.cleanup_container(container)
    # Remove temp file
    temp_file = run_data.get('temp_file')
    if temp_file:
        try:
            os.unlink(temp_file)
        except Exception:
            pass


def _read_container_output(run_id, raw_sock, stop_event, output_q):
    """
    Background thread: reads bytes from the attached Docker PTY socket and
    pushes them onto the output queue.  Exits when the container process
    finishes or the stop_event is set.
    """
    try:
        raw_sock.settimeout(0.3)
    except Exception:
        pass  # npipesocket on Windows may not support settimeout
    output_bytes = 0
    output_cap = 50 * 1024  # 50 KB live output cap

    while not stop_event.is_set():
        try:
            data = raw_sock.recv(4096)
            if not data:
                break
            output_bytes += len(data)
            text = data.decode('utf-8', errors='replace')
            output_q.put(('output', text))
            if output_bytes >= output_cap:
                output_q.put(('output', '\n[Output truncated due to size exceeding limit]\n'))
                break
        except OSError:
            with active_runs_lock:
                run_data = active_runs.get(run_id)
            if not run_data:
                break
            try:
                run_data['container'].reload()
                if run_data['container'].status not in ('running', 'created'):
                    break
            except Exception:
                break
        except Exception:
            break

    # Container finished — check if we still own this run
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if run_data is None:
        return

    exit_code = 0
    try:
        result = run_data['container'].wait(timeout=5)
        exit_code = result.get('StatusCode', 0)
    except Exception:
        pass

    output_q.put(('done', exit_code))


@app.route('/api/execute/run', methods=['POST'])
def start_execution():
    """
    POST { language: str, code: str }
    Returns { run_id: str }
    """
    from models import Language
    data = request.get_json(silent=True) or {}

    language = data.get('language', '').lower()
    code = data.get('code', '')
    language_row = Language.query.filter_by(language=language).first()
    cmd = language_row.get_run_cmd() if language_row else None
    docker_image = language_row.get_docker_image() if language_row else None
    file_name = data.get('file_name')

    execution_data = {
        'language': language,
        'code': code,
        'file_name': file_name,
        'cmd': cmd,
        'docker_image': docker_image
    }
    if not code:
        return jsonify({'error': 'No code provided'}), 400
    if language not in LANGUAGE_MAP:
        return jsonify({'error': f'Language {language} not supported'}), 400

    run_id = secrets.token_hex(8)

    try:
        container, temp_file = docker_service.build_interactive_container(**execution_data)
        container.start()

        sock = docker_service._get_api_client().attach_socket(
            container.id,
            params={'stdin': 1, 'stdout': 1, 'stderr': 1, 'stream': 1}
        )
        raw_sock = getattr(sock, '_sock', sock)

        stop_event = threading.Event()
        output_q = queue.Queue()

        run_data = {
            'container': container,
            'temp_file': temp_file,
            'stop_event': stop_event,
            'raw_sock': raw_sock,
            'output_q': output_q,
        }

        with active_runs_lock:
            active_runs[run_id] = run_data

        # Background reader thread
        t = threading.Thread(
            target=_read_container_output,
            args=(run_id, raw_sock, stop_event, output_q),
            daemon=True,
        )
        t.start()

        # Wall-time timeout
        def _timeout_kill():
            with active_runs_lock:
                rd = active_runs.get(run_id)
            if rd:
                rd['output_q'].put(('output', f'\n[Execution timed out after {MAX_INTERACTIVE_TIMEOUT}s]'))
                rd['output_q'].put(('done', -1))
                _cleanup_run(run_id)

        timer = threading.Timer(MAX_INTERACTIVE_TIMEOUT, _timeout_kill)
        timer.daemon = True
        timer.start()
        run_data['timer'] = timer
        run_data['elapsed'] = 0  # track total time granted so far

        return jsonify({'run_id': run_id}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/execute/<run_id>/stream')
def stream_output(run_id):
    """
    SSE endpoint.  Keeps the connection open, pushing output events to the
    client as they arrive from the Docker container.
    """
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if not run_data:
        return jsonify({'error': 'Run not found'}), 404

    output_q = run_data['output_q']

    def generate():
        while True:
            try:
                msg_type, payload = output_q.get(timeout=1)
            except queue.Empty:
                # Send a keep-alive comment to prevent proxy/browser timeouts
                yield ': keepalive\n\n'
                continue

            if msg_type == 'output':
                # Encode payload as JSON so newlines inside output are preserved
                yield f'data: {json.dumps({"output": payload})}\n\n'
            elif msg_type == 'done':
                yield f'event: done\ndata: {json.dumps({"exit_code": payload})}\n\n'
                break

        # stream end
        _cleanup_run(run_id)

    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',  # disable nginx buffering if present
    })


def _reset_timer(run_id, run_data):
    """
    Cancel the current timeout timer and start a new one with
    STDIN_TIMEOUT_EXTENSION seconds, unless the hard cap has been reached.
    """
    old_timer = run_data.get('timer')
    if old_timer:
        old_timer.cancel()

    elapsed = run_data.get('elapsed', 0) + STDIN_TIMEOUT_EXTENSION
    if elapsed >= MAX_TOTAL_TIMEOUT:
        # let the container be killed on its current timer
        return
    run_data['elapsed'] = elapsed

    remaining = min(STDIN_TIMEOUT_EXTENSION, MAX_TOTAL_TIMEOUT - elapsed)

    def _timeout_kill():
        with active_runs_lock:
            rd = active_runs.get(run_id)
        if rd:
            rd['output_q'].put(('output', f'\n[Execution timed out]'))
            rd['output_q'].put(('done', -1))
            _cleanup_run(run_id)

    timer = threading.Timer(remaining, _timeout_kill)
    timer.daemon = True
    timer.start()
    run_data['timer'] = timer


@app.route('/api/execute/<run_id>/stdin', methods=['POST'])
def send_stdin(run_id):
    """
    POST { data: str } — a line of text to write to the container's stdin.
    """
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if not run_data:
        return jsonify({'error': 'Run not found'}), 404

    raw_sock = run_data.get('raw_sock')
    if not raw_sock:
        return jsonify({'error': 'No stdin socket'}), 400

    try:
        payload = (request.get_json(silent=True) or {}).get('data', '')
        encoded = (payload + '\n').encode('utf-8')
        sender = getattr(raw_sock, 'sendall', None) or raw_sock.send
        sender(encoded)
        # Extend the timeout since the user is actively interacting
        _reset_timer(run_id, run_data)
        return '', 204
    except Exception as e:
        return jsonify({'error': f'Failed to send input: {str(e)}'}), 500


@app.route('/api/execute/<run_id>/stop', methods=['POST'])
def stop_execution(run_id):
    """
    POST — kill the running container and end the SSE stream.
    """
    with active_runs_lock:
        run_data = active_runs.get(run_id)
    if not run_data:
        return jsonify({'error': 'Run not found'}), 404

    # Push stop messages onto the queue so the SSE stream picks them up
    run_data['output_q'].put(('output', '\n[Execution stopped by user]'))
    run_data['output_q'].put(('done', -1))
    _cleanup_run(run_id)
    return '', 204


if __name__ == '__main__':
    app.run(debug=True, port=5000)

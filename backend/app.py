# app.py
from flask import Flask, request, jsonify, session, Response
from flask_cors import CORS
from flask_mail import Mail, Message
from flask_migrate import Migrate
from datetime import datetime, timedelta
import requests
import threading
import queue
import json
from functools import wraps
from config import LANGUAGE_MAP, ALGORITHM_MAP, SAMPLE_CODE_DIR, SAMPLE_ALGORITHMS_DIR
from containerHandler import ContainerHandler
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
CORS(app, supports_credentials=True, origins=['http://localhost:5173'])

container_handler = ContainerHandler()

# Server Startup cleanup: Remove leftover containers if any
def _startup_cleanup():
    try:
        client = container_handler._get_client()
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

# ============================================
# EDUCATIONAL ALGORITHMS ROUTES
# ============================================

@app.route('/api/algorithms', methods=['GET'])
def get_all_algorithm_categories():
    """Get all algorithm categories"""
    categories = [
        {
            'key': key,
            'name': config['display_name'],
            'languages': list(config['algorithms'].keys())
        }
        for key, config in ALGORITHM_MAP.items()
    ]
    return jsonify({'categories': categories})

@app.route('/api/algorithms/<category>', methods=['GET'])
def get_category_info(category):
    """Get category info with all algorithms across all languages"""
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    return jsonify({
        'category': category_config['display_name'],
        'algorithms': category_config['algorithms']
    })

@app.route('/api/algorithms/<category>/<language>', methods=['GET'])
def get_category_algorithms(category, language):
    """Get algorithms for a specific category and language"""
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms = category_config['algorithms'].get(language.lower(), [])
    
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

        if language not in ('python', 'javascript'):
            return jsonify({'error': f'Language {language} not supported'}), 400

        result = container_handler.execute_code(language, code)

        if not result.get('success'):
            return jsonify(result), 500

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
    try:
        data = request.get_json()
        language = data.get('language', '').lower()
        code = data.get('code', '')
        params_block = data.get('params_block', None)

        if params_block is not None:
            code = inject_params_block(code, language, params_block)

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
            client_id
        )
        print(f"Google ID info: {idinfo}")
        # Extract user info from Google
        google_id = idinfo['sub']
        email = idinfo.get('email')
        name = idinfo.get('name')
        
        if not email:
            return jsonify({'error': 'No email provided by Google'}), 400
        
        # Check if user exists with this Google ID
        user = User.query.filter_by(oauth_provider='google', oauth_id=google_id).first()
        
        if not user:
            # Check if user exists with this email (link accounts)
            user = User.query.filter_by(email=email).first()
            
            if user:
                # Link existing account to Google
                user.oauth_provider = 'google'
                user.oauth_id = google_id
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
        
        user.last_login = datetime.now()
        db.session.commit()
        
        session['user_id'] = user.id
        session['username'] = user.username
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
        
    except ValueError as e:
        # Invalid token
        return jsonify({'error': 'Invalid Google token'}), 401
    except Exception as e:
        db.session.rollback()
        print(f"Google OAuth error: {str(e)}")
        return jsonify({'error': 'Authentication failed'}), 500


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


# ============================================
# PASSWORD RESET ROUTES
# ============================================
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
                        <p>You requested to reset your password for your Algorithm Visualizer account.</p>
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
    ResetTokens.query.filter_by(user_id=user.id).delete()
    
    # Create new reset token
    reset_token = ResetTokens(
        user_id=user.id,
        token=token,
        expires_at=datetime.now() + timedelta(minutes=30)
    )
    
    db.session.add(reset_token)
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
    if datetime.now() > reset_token.expires_at:
        db.session.delete(reset_token)
        db.session.commit()
        return jsonify({'error': 'Token has expired'}), 400
    
    # Token is valid - create a reset session
    reset_session_id = str(uuid.uuid4())
    
    reset_session = {
        'user_id': reset_token.user_id,
        'created_at': datetime.now(),
        'expires_at': datetime.now() + timedelta(minutes=15)
    }
    
    # Store in Flask session
    session[f'reset_{reset_session_id}'] = reset_session
    
    # Delete the token immediately after verification (single use)
    db.session.delete(reset_token)
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
        secure=True,  # Only send over HTTPS
        httponly=True,  # Not accessible via JavaScript
        samesite='Lax'
    )
    
    return response, 200


@app.route('/api/auth/verify-reset-token', methods=['POST'])
def verify_reset_token():
    """Verify reset token and create a reset session"""
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
    if datetime.now() > reset_token.expires_at:
        db.session.delete(reset_token)
        db.session.commit()
        return jsonify({'error': 'Token has expired'}), 400
    
    # Token is valid - create a reset session
    # Generate session ID for this reset attempt
    reset_session_id = str(uuid.uuid4())
    
    # Store session data (valid for 15 minutes)
    reset_session = {
        'user_id': reset_token.user_id,
        'created_at': datetime.now(),
        'expires_at': datetime.now() + timedelta(minutes=15)
    }
    
    # Store in Flask session
    session[f'reset_{reset_session_id}'] = reset_session
    
    # Delete the token immediately after verification (single use)
    db.session.delete(reset_token)
    db.session.commit()
    
    # Return session ID (not the token)
    response = jsonify({
        'valid': True,
        'message': 'Token verified. You can now reset your password.',
        'session_id': reset_session_id
    })
    
    # Set secure session cookie
    response.set_cookie(
        'reset_session',
        reset_session_id,
        max_age=900,  # 15 minutes
        secure=True,  # Only send over HTTPS
        httponly=True,  # Not accessible via JavaScript
        samesite='Lax'
    )
    
    return response, 200


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
    if datetime.now() > reset_session.get('expires_at'):
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
        container_handler.cleanup_container(container)
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
                output_q.put(('output', '\n[Output truncated at 50 KB]'))
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
    data = request.get_json(silent=True) or {}
    language = data.get('language', '').lower()
    code = data.get('code', '')

    if not code:
        return jsonify({'error': 'No code provided'}), 400
    if language not in LANGUAGE_MAP:
        return jsonify({'error': f'Language {language} not supported'}), 400

    run_id = secrets.token_hex(8)

    try:
        container, temp_file = container_handler.create_interactive_container(language, code)
        container.start()

        sock = container_handler._get_api_client().attach_socket(
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

        # Stream ended — clean up the run
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
        # Hard cap reached — let the container be killed on its current timer
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
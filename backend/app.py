# app.py
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import requests
from config import LANGUAGE_MAP, ALGORITHM_MAP, SAMPLE_CODE_DIR, SAMPLE_ALGORITHMS_DIR
from containerHandler import ContainerHandler
from database import db, init_db
import os

app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///algorithm_visualizer.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-change-this-in-production'  # Change this!
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS

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


@app.route('/api/<language>/<search>', methods=['GET'])
def get_searchResults(language, search):
    query = request.args.get('q', '').lower()
    lang_config = LANGUAGE_MAP.get(language.lower())
    return [item for item in lang_config['samples'] if query in item['name'].lower()]


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
    user.last_login = datetime.utcnow()
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


@app.route('/api/auth/update-profile', methods=['PUT'])
def update_profile():
    """Update user profile (username, profile picture)"""
    from models import User
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    # Update username if provided
    if 'username' in data and data['username'] != user.username:
        # Check if new username already exists
        existing = User.query.filter_by(username=data['username']).first()
        if existing:
            return jsonify({'error': 'Username already taken'}), 400
        user.username = data['username']
        session['username'] = data['username']
    
    # Update profile picture if provided
    if 'profile_picture' in data:
        user.profile_picture = data['profile_picture']
    
    try:
        db.session.commit()
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Update failed'}), 500


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
# USER CODE ROUTES
# ============================================

@app.route('/api/user/saved-code', methods=['GET'])
def get_saved_codes():
    """Get all saved code for current user"""
    from models import SavedCode
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    codes = SavedCode.query.filter_by(user_id=user_id).order_by(SavedCode.updated_at.desc()).all()
    
    return jsonify({
        'saved_codes': [code.to_dict() for code in codes]
    }), 200


@app.route('/api/user/saved-code/<algorithm_key>/<language>', methods=['GET'])
def get_saved_code(algorithm_key, language):
    """Get specific saved code"""
    from models import SavedCode
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    code = SavedCode.query.filter_by(
        user_id=user_id,
        algorithm_key=algorithm_key,
        language=language
    ).first()
    
    if not code:
        return jsonify({'error': 'Saved code not found'}), 404
    
    return jsonify({'saved_code': code.to_dict()}), 200


@app.route('/api/user/saved-code', methods=['POST'])
def save_code():
    """Save or update user's code"""
    from models import SavedCode
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    algorithm_key = data.get('algorithm_key')
    category = data.get('category')
    language = data.get('language')
    code = data.get('code')
    
    if not all([algorithm_key, category, language, code]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Check if code already exists
    existing_code = SavedCode.query.filter_by(
        user_id=user_id,
        algorithm_key=algorithm_key,
        language=language
    ).first()
    
    try:
        if existing_code:
            # Update existing
            existing_code.code = code
            existing_code.category = category
            from datetime import datetime
            existing_code.updated_at = datetime.utcnow()
            message = 'Code updated successfully'
        else:
            # Create new
            new_code = SavedCode(
                user_id=user_id,
                algorithm_key=algorithm_key,
                category=category,
                language=language,
                code=code
            )
            db.session.add(new_code)
            message = 'Code saved successfully'
        
        db.session.commit()
        
        return jsonify({'message': message}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to save code'}), 500


@app.route('/api/user/saved-code/<int:code_id>', methods=['DELETE'])
def delete_saved_code(code_id):
    """Delete saved code"""
    from models import SavedCode
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    code = SavedCode.query.filter_by(id=code_id, user_id=user_id).first()
    
    if not code:
        return jsonify({'error': 'Code not found'}), 404
    
    try:
        db.session.delete(code)
        db.session.commit()
        return jsonify({'message': 'Code deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete code'}), 500


# ============================================
# USER PROGRESS ROUTES
# ============================================

@app.route('/api/user/progress', methods=['GET'])
def get_user_progress():
    """Get all progress for current user"""
    from models import UserProgress
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    progress = UserProgress.query.filter_by(user_id=user_id).all()
    
    return jsonify({
        'progress': [p.to_dict() for p in progress]
    }), 200


@app.route('/api/user/progress/<algorithm_key>', methods=['POST'])
def mark_algorithm_complete(algorithm_key):
    """Mark an algorithm as completed"""
    from models import UserProgress
    from datetime import datetime
    
    user_id = session.get('user_id')
    
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    category = data.get('category')
    
    if not category:
        return jsonify({'error': 'Category is required'}), 400
    
    # Check if progress already exists
    progress = UserProgress.query.filter_by(
        user_id=user_id,
        algorithm_key=algorithm_key
    ).first()
    
    try:
        if progress:
            # Update existing
            progress.completed = True
            progress.completed_at = datetime.utcnow()
        else:
            # Create new
            progress = UserProgress(
                user_id=user_id,
                algorithm_key=algorithm_key,
                category=category,
                completed=True,
                completed_at=datetime.utcnow()
            )
            db.session.add(progress)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Progress updated',
            'progress': progress.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update progress'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
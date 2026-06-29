from functools import wraps
import os

from flask import jsonify, session


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

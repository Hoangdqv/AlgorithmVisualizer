from datetime import datetime, timedelta, timezone
import os
import secrets

from flask import Blueprint, current_app, jsonify, request, session
from flask_mail import Message
import requests

from database import db
from extensions import mail
from routes.common import login_required


bp = Blueprint('auth', __name__)

# ============================================
# AUTHENTICATION ROUTES
# ============================================

@bp.route('/api/auth/register', methods=['POST'])
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


@bp.route('/api/auth/login', methods=['POST'])
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


@bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logout user"""
    session['user_id'] = None
    session['username'] = None

    session.clear()

    return jsonify({'message': 'Logout successful'}), 200


@bp.route('/api/auth/google', methods=['POST'])
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
        current_app.logger.exception("Google OAuth failed")
        return jsonify({'error': 'Authentication failed'}), 500


@bp.route('/api/auth/link-google', methods=['POST'])
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
        current_app.logger.exception("Google account linking failed")
        return jsonify({'error': 'Failed to link Google account'}), 500


@bp.route('/api/auth/check', methods=['GET'])
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
    except Exception:
        current_app.logger.exception("Failed to send reset email")
        return False
@bp.route('/api/auth/forgot-password', methods=['POST'])
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


@bp.route('/api/auth/confirm-reset', methods=['POST'])
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
        secure=current_app.config.get('SESSION_COOKIE_SECURE', False),
        httponly=True,  # Not accessible via JavaScript
        samesite='Lax'
    )
    
    return response, 200


@bp.route('/api/auth/reset-password', methods=['POST'])
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

@bp.route('/api/user/profile', methods=['PUT'])
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


@bp.route('/api/user/change-password', methods=['POST'])
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

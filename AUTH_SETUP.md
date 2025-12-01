# Authentication System Setup

## Overview
Your existing SignIn/SignUp components have been integrated with the backend authentication system. The system uses:
- **Session-based authentication** (no JWT)
- **Email-based login** with username
- **SQLite database** for user data
- **Forgot password** functionality (placeholder)

## What Was Done

### 1. Database Setup
✅ Created SQLite database: `backend/algorithm_visualizer.db`
✅ Tables created:
   - `user_account` - Stores user credentials and profile
   - `saved_code` - Stores user's custom algorithm implementations
   - `user_progress` - Tracks completed algorithms

### 2. Backend Updates
✅ Modified login endpoint to accept **email OR username**
✅ Added `/api/auth/forgot-password` endpoint (placeholder)
✅ All auth endpoints ready:
   - POST `/api/auth/register` - Create new account
   - POST `/api/auth/login` - Login with email/username
   - POST `/api/auth/logout` - Logout
   - GET `/api/auth/me` - Get current user
   - PUT `/api/auth/update-profile` - Update username/profile picture
   - POST `/api/auth/forgot-password` - Request password reset

### 3. Frontend Integration
✅ Updated `SignIn.jsx`:
   - Integrated with AuthContext
   - Calls backend login API
   - Shows error messages
   - Forgot password calls backend endpoint

✅ Updated `SignUp.jsx`:
   - Added username field
   - Integrated with AuthContext
   - Calls backend register API
   - Validates email, password match, and password length

✅ Updated `SignUpForm.jsx`:
   - Added username input field

✅ Updated `App.jsx`:
   - Routes now use your existing SignIn/SignUp components
   - `/login` and `/signin` → SignIn
   - `/signup` → SignUp

✅ NavBar already shows:
   - "Welcome, [username]" + Logout when logged in
   - Login/Register buttons when logged out

## How to Test

### 1. Start the Backend
```bash
cd backend
flask run --debug
```
Backend runs on: http://localhost:5000

### 2. Start the Frontend
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

### 3. Test Registration
1. Navigate to http://localhost:5173/signup
2. Enter:
   - Username (e.g., "johndoe")
   - Email (e.g., "john@example.com")
   - Password (min 6 characters)
   - Confirm Password
3. Click "Sign Up"
4. You'll be automatically logged in and redirected to `/algorithms`

### 4. Test Login
1. Navigate to http://localhost:5173/login
2. Enter your email (or username) and password
3. Click "Sign In"
4. You'll be redirected to `/algorithms`

### 5. Test Logout
1. When logged in, click "Logout" in the navbar
2. You'll be logged out and redirected

### 6. Test Forgot Password
1. On the login page, enter your email
2. Click "Forgot password?"
3. You'll see a confirmation message
   - Note: This is a placeholder - no actual email is sent yet

## Database Viewer

To view your database, you can use:
- **DB Browser for SQLite**: https://sqlitebrowser.org/
- **VS Code Extension**: SQLite Viewer
- **Online**: https://sqliteviewer.app/

Database location: `backend/algorithm_visualizer.db`

## User Data Structure

### User Table
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email address
- `password_hash` - Bcrypt hashed password
- `profile_picture` - URL to profile image (optional)
- `created_at` - Account creation timestamp
- `last_login` - Last login timestamp

## Next Steps (Optional)

### Implement Full Forgot Password
1. Install email library: `pip install flask-mail`
2. Generate secure reset tokens
3. Send email with reset link
4. Create reset password page
5. Add `/api/auth/reset-password/<token>` endpoint

### Profile Picture Upload
1. Add file upload endpoint
2. Store images in `backend/uploads/`
3. Serve static files via Flask
4. Or use cloud storage (AWS S3, Cloudinary)

### Protected Routes
1. Create ProtectedRoute component in frontend
2. Wrap routes that require authentication
3. Redirect to login if not authenticated

### Remember Me
1. Add checkbox to login form
2. Set longer session duration
3. Use permanent sessions in Flask

## Troubleshooting

### "Not authenticated" error
- Make sure both frontend and backend are running
- Check browser console for CORS errors
- Clear browser cookies and try again

### "User not found" or "Invalid credentials"
- Make sure you registered an account first
- Check that email/password are correct
- Try viewing database to verify user exists

### Session not persisting
- Check that cookies are enabled in browser
- Verify CORS credentials are set correctly
- Check Flask SECRET_KEY is configured

## Security Notes

⚠️ **For Production:**
1. Change `SECRET_KEY` in `backend/app.py`
2. Set `SESSION_COOKIE_SECURE = True` (requires HTTPS)
3. Use environment variables for sensitive data
4. Enable rate limiting on auth endpoints
5. Add CAPTCHA to prevent bot registrations
6. Implement account verification via email

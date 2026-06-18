# Algorithm Visualizer

A full-stack algorithm visualization project with a React/Vite frontend, Flask backend, SQLite database, and Docker-based code execution for Python and JavaScript samples.

## Prerequisites

Install these before starting:

- Python 3.11 or newer
- Node.js 20 or newer
- npm
- Docker Desktop
- Git

Make sure Docker Desktop is running before using code execution features.

## Project Structure

```text
backend/             Flask API, database models, auth, admin routes
frontend/            React + Vite client
docker/              Docker image definitions for sandboxed code execution
runtime/             Tracer utilities used by sample algorithms
sandbox/             Python and Node runners mounted into execution containers
sample_code/         Simple playground examples
sample_algorithms/   Algorithm visualization examples and explanations
```

## 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd <project-folder>
```

Install the root npm dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

Create and activate a Python virtual environment:

```bash
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

On macOS/Linux:

```bash
source .venv/bin/activate
```

Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

## 2. Configure Environment Variables

Create `backend/.env`:

```env
SECRET_KEY=change-this-dev-secret
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Optional: email/password reset support
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USE_SSL=false
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Google OAuth and email reset features are optional. Normal username/password login can work without those values.

## 3. Build Docker Execution Images

The backend executes user code inside Docker containers. Build the images from the project root:

```bash
docker build -t python:3.13-alpine -f docker/python/dockerfile docker/python
docker pull node:22-alpine
```

If you want to use the local JavaScript Dockerfile, check `docker/javascript/dockerfile` first. It currently uses `FROM node22-alpine`; most Docker setups expect the official image name `node:22-alpine`.

## 4. Database Setup

The backend uses SQLite at:

```text
backend/instance/algorithm_visualizer.db
```

Tables are created automatically when the Flask app starts because `backend/database.py` calls `db.create_all()`.

If you need migration support, run commands from the `backend` folder:

```bash
cd backend
flask db upgrade
cd ..
```

To create the included test admin account:

```bash
python backend/helper_scripts/create_admin.py
```

Default admin credentials from that script:

```text
username: admin
password: adminpassword
```

Change these before using the project outside local development.

## 5. Run the Project

Start the backend from the project root:

```bash
npm run backend
```

The Flask API runs at:

```text
http://localhost:5000
```

In a second terminal, start the frontend:

```bash
npm run frontend
```

The Vite app runs at:

```text
http://localhost:5173
```

Open `http://localhost:5173` in your browser.

## Useful Commands

Run frontend linting:

```bash
cd frontend
npm run lint
```

Build the frontend:

```bash
cd frontend
npm run build
```

Run the Flask backend directly:

```bash
cd backend
flask run --debug
```

## Important Notes

- `frontend/vite.config.js` proxies `/api` requests to `http://localhost:5000`.
- The frontend also uses `VITE_API_URL`, so keep it set to `http://localhost:5000/api`.
- Docker must be running for `/api/execute`, `/api/execute/run`, and algorithm execution routes.
- The execution service reads Docker image names and run commands from the `language` table in SQLite.
- Sample algorithms are registered in `backend/algorithm_registry.json`.
- Simple playground samples are registered in `backend/playground_registry.json`.

## Troubleshooting

If the frontend cannot reach the backend:

- Confirm Flask is running on port `5000`.
- Confirm `frontend/.env` contains `VITE_API_URL=http://localhost:5000/api`.
- Restart the Vite dev server after changing `.env`.

If code execution fails:

- Confirm Docker Desktop is running.
- Confirm the required images exist:

```bash
docker images
```

- Confirm the `language` table has rows for Python and JavaScript with valid Docker images and run commands.
- Expected Docker images are usually `python:3.13-alpine` and `node:22-alpine`.

If admin pages are blocked:

- Log in with an account whose `role` is `admin`.
- You can create the test admin with `python backend/helper_scripts/create_admin.py`.

If password reset email does not send:

- Fill in the `MAIL_*` values in `backend/.env`.
- For Gmail, use an app password rather than your normal account password.

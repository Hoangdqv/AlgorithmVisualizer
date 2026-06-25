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

The root `package.json` only provides convenience scripts for starting the frontend and backend. There are no root-level app dependencies to install.

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

# Optional: seed an admin account
SEED_ADMIN=false
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=change-this-password
```

Flask loads this file automatically when running the backend because `python-dotenv` is included in `backend/requirements.txt`. The database seed script also reads this same file.

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Google OAuth and email reset features are optional. Normal username/password login can work without those values.

## 3. Build Docker Execution Images

The backend executes user code inside Docker containers. Prepare the runtime images from the project root:

```bash
docker build -t python:3.13-alpine -f docker/python/dockerfile docker/python
docker pull node:22-alpine
```

The Python image is built locally so the packages in `docker/python/requirements.txt` are available inside executed Python code.
The JavaScript runtime uses the official `node:22-alpine` image.

## 4. Database Setup

The backend uses SQLite at:

```text
backend/instance/algorithm_visualizer.db
```

Tables are created automatically when the Flask app or seed script starts because `backend/database.py` calls `db.create_all()`.

Seed the default language runtime rows:

```bash
python backend/helper_scripts/seed_database.py
```

This creates or updates the default `python` and `javascript` rows used by code execution.
The seed script imports the Flask app configuration, so it writes to the same SQLite database used by the backend: `backend/instance/algorithm_visualizer.db`.

If you need migration support, run commands from the `backend` folder:

```bash
cd backend
flask db upgrade
cd ..
```

To seed an optional admin account, set `SEED_ADMIN=true` in `backend/.env`, choose your admin username/email/password, and run the same seed command again:

```bash
python backend/helper_scripts/seed_database.py
```

Use your own password before using the project outside local development.

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
- The SQLite database is local runtime state and should not be committed.
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

- Run `python backend/helper_scripts/seed_database.py` to create the default `language` rows.
- Expected Docker images are usually `python:3.13-alpine` and `node:22-alpine`.

If admin pages are blocked:

- Log in with an account whose `role` is `admin`.
- Set `SEED_ADMIN=true` and `SEED_ADMIN_PASSWORD=...` in `backend/.env`, then rerun `python backend/helper_scripts/seed_database.py`.

If password reset email does not send:

- Fill in the `MAIL_*` values in `backend/.env`.
- For Gmail, use an app password rather than your normal account password.

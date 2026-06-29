"""Generate default local-development database records.

Run from the project root:
    python backend/scripts/generate_database.py

Optional admin account:
    Add GENERATE_ADMIN=true and GENERATE_ADMIN_PASSWORD=change-me to backend/.env.
"""

import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv


load_dotenv(BACKEND_DIR / ".env")

from app import app
from database import db
from models import Language, User


DEFAULT_LANGUAGES = {
    "python": {
        "docker_image": "python:3.13-alpine",
        "run_cmd": "python",
    },
    "javascript": {
        "docker_image": "node:22-alpine",
        "run_cmd": "node",
    },
}


def generate_languages():
    for language_name, config in DEFAULT_LANGUAGES.items():
        language = Language.query.filter_by(language=language_name).first()

        if language is None:
            language = Language(language=language_name)
            db.session.add(language)

        language.docker_image = config["docker_image"]
        language.run_cmd = config["run_cmd"]


def generate_admin():
    if os.environ.get("GENERATE_ADMIN", "").lower() not in {"1", "true", "yes"}:
        return

    username = os.environ.get("GENERATE_ADMIN_USERNAME", "admin")
    email = os.environ.get("GENERATE_ADMIN_EMAIL", "admin@example.com")
    password = os.environ.get("GENERATE_ADMIN_PASSWORD")

    if not password:
        raise RuntimeError("Set GENERATE_ADMIN_PASSWORD before generating an admin account.")

    admin = User.query.filter(
        (User.username == username) | (User.email == email)
    ).first()

    if admin is None:
        admin = User(username=username, email=email, role="admin")
        db.session.add(admin)

    admin.username = username
    admin.email = email
    admin.role = "admin"
    admin.set_password(password)


def main():
    with app.app_context():
        db.create_all()
        generate_languages()
        generate_admin()
        db.session.commit()
        print("Database generation completed.")


if __name__ == "__main__":
    main()

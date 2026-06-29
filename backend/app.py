from flask import Flask
from flask_cors import CORS
import os

from sqlalchemy import event
from sqlalchemy.engine import Engine

from database import init_db
from execution_state import cleanup_execution_containers
from extensions import mail
from routes.admin import bp as admin_bp
from routes.algorithms import bp as algorithms_bp
from routes.auth import bp as auth_bp
from routes.execution import bp as execution_bp
from routes.files import bp as files_bp
from routes.samples import bp as samples_bp


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
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.environ.get('MAIL_DEFAULT_SENDER', os.environ.get('MAIL_USERNAME'))

mail.init_app(app)


# Enable foreign key constraints for SQLite
@event.listens_for(Engine, 'connect')
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute('PRAGMA foreign_keys=ON')
    cursor.close()


init_db(app)

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


def register_blueprints(flask_app):
    flask_app.register_blueprint(samples_bp)
    flask_app.register_blueprint(algorithms_bp)
    flask_app.register_blueprint(execution_bp)
    flask_app.register_blueprint(auth_bp)
    flask_app.register_blueprint(admin_bp)
    flask_app.register_blueprint(files_bp)


register_blueprints(app)
cleanup_execution_containers()


if __name__ == '__main__':
    app.run(debug=True, port=5000)

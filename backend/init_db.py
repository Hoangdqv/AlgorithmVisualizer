# init_db.py
"""Initialize the database - Run this once to create tables"""
from app import app, db
from models import User, SavedCode, UserProgress  # Import models so SQLAlchemy knows about them

with app.app_context():
    # Create all tables
    db.create_all()
    print("✓ Database tables created successfully!")
    print("✓ Database file: algorithm_visualizer.db")
    print("\nTables created:")
    print("  - user_account")
    print("  - saved_code")
    print("  - user_progress")
    print("\nYou can now run: flask run --debug")

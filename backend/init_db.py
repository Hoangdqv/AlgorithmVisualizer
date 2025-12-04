from app import app, db
from models import User, Folder, File, Language

with app.app_context():
    # Create tables
    db.create_all()
    db.session.commit()
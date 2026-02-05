# Generate a test admin account
from database import db
from app import app
from models import User
import bcrypt

def create_admin(username, email, password):
    with app.app_context():
        if User.query.filter_by(username=username).first():
            print(f"Admin user '{username}' already exists.")
            return
    
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        new_admin = User(username=username, email=email, password_hash=hashed_password, role='admin')
        db.session.add(new_admin)
        db.session.commit()
        print(f"Admin user '{username}' created successfully.")

if __name__ == '__main__':
    create_admin('admin', 'admin@example.com', 'adminpassword')

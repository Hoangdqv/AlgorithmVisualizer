# models.py
from database import db
from datetime import datetime
import bcrypt

class User(db.Model):
    __tablename__ = 'user_account'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    profile_picture = db.Column(db.String(255), nullable=True)  # URL or path to pfp
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    saved_codes = db.relationship('SavedCode', backref='user', lazy=True, cascade='all, delete-orphan')
    progress = db.relationship('UserProgress', backref='user', lazy=True, cascade='all, delete-orphan')
    files = db.relationship('File', backref='user', lazy=True, cascade='all, delete-orphan')
    closure_entries = db.relationship('ClosureTable', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        """Return user data as dictionary (without password)"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'profile_picture': self.profile_picture,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }


class SavedCode(db.Model):
    __tablename__ = 'saved_code'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user_account.id'), nullable=False)
    algorithm_key = db.Column(db.String(50), nullable=False)  # e.g., "bfs", "dfs"
    category = db.Column(db.String(50), nullable=False)  # e.g., "graphs", "sorting"
    language = db.Column(db.String(20), nullable=False)  # "python" or "javascript"
    code = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        """Return saved code as dictionary"""
        return {
            'id': self.id,
            'algorithm_key': self.algorithm_key,
            'category': self.category,
            'language': self.language,
            'code': self.code,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class UserProgress(db.Model):
    __tablename__ = 'user_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user_account.id'), nullable=False)
    algorithm_key = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    completed_at = db.Column(db.DateTime, nullable=True)
    
    # Unique constraint: one progress entry per user per algorithm
    __table_args__ = (
        db.UniqueConstraint('user_id', 'algorithm_key', name='unique_user_algorithm'),
    )
    
    def to_dict(self):
        """Return progress as dictionary"""
        return {
            'id': self.id,
            'algorithm_key': self.algorithm_key,
            'category': self.category,
            'completed': self.completed,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }


# ============================================
# FILE SYSTEM MODELS
# ============================================

class Language(db.Model):
    __tablename__ = 'language'
    
    lang_id = db.Column(db.Integer, primary_key=True)
    language = db.Column(db.String(50), nullable=False)  # "python", "javascript"
    docker_image = db.Column(db.String(255), nullable=True)
    run_cmd = db.Column(db.String(255), nullable=True)
    
    # Relationships
    files = db.relationship('File', backref='language_info', lazy=True)
    
    def to_dict(self):
        """Return language as dictionary"""
        return {
            'lang_id': self.lang_id,
            'language': self.language,
            'docker_image': self.docker_image,
            'run_cmd': self.run_cmd
        }


class Folder(db.Model):
    __tablename__ = 'folder'
    
    folder_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    folder_name = db.Column(db.String(255), nullable=False)
    path = db.Column(db.String(1024), nullable=False)
    folder_type = db.Column(db.Enum('user-defined', 'sample', name='object_type'), 
                           default='user-defined', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    files = db.relationship('File', backref='folder', lazy=True, cascade='all, delete-orphan')
    
    # Closure table relationships
    ancestors = db.relationship(
        'ClosureTable',
        foreign_keys='ClosureTable.descendant',
        backref='descendant_folder',
        cascade='all, delete-orphan'
    )
    descendants = db.relationship(
        'ClosureTable',
        foreign_keys='ClosureTable.ancestor',
        backref='ancestor_folder',
        cascade='all, delete-orphan'
    )
    
    def to_dict(self, include_files=False):
        """Return folder as dictionary"""
        result = {
            'folder_id': self.folder_id,
            'folder_name': self.folder_name,
            'path': self.path,
            'folder_type': self.folder_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_files:
            result['files'] = [f.to_dict() for f in self.files]
        
        return result


class File(db.Model):
    __tablename__ = 'file'
    
    file_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    file_name = db.Column(db.String(255), nullable=False)
    folder_id = db.Column(db.Integer, db.ForeignKey('folder.folder_id'), nullable=True)  # NULL = root level
    path = db.Column(db.String(1024), nullable=False)
    file_type = db.Column(db.Enum('user-defined', 'sample', name='object_type'), 
                         default='user-defined', nullable=False)
    user_account_id = db.Column(db.Integer, db.ForeignKey('user_account.id'), nullable=True)  # NULL for samples
    content = db.Column(db.Text, nullable=True)
    lang_id = db.Column(db.Integer, db.ForeignKey('language.lang_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self, include_content=True):
        """Return file as dictionary"""
        result = {
            'file_id': self.file_id,
            'file_name': self.file_name,
            'folder_id': self.folder_id,
            'path': self.path,
            'file_type': self.file_type,
            'user_account_id': self.user_account_id,
            'lang_id': self.lang_id,
            'language': self.language_info.language if self.language_info else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }
        
        if include_content:
            result['content'] = self.content
        
        return result


class ClosureTable(db.Model):
    __tablename__ = 'closure_table'
    
    ancestor = db.Column(db.Integer, db.ForeignKey('folder.folder_id', ondelete='CASCADE'), 
                        primary_key=True, nullable=False)
    descendant = db.Column(db.Integer, db.ForeignKey('folder.folder_id', ondelete='CASCADE'), 
                          primary_key=True, nullable=False)
    depth = db.Column(db.Integer, nullable=False)
    user_account_id = db.Column(db.Integer, db.ForeignKey('user_account.id', ondelete='CASCADE'), nullable=True)
    
    def to_dict(self):
        """Return closure entry as dictionary"""
        return {
            'ancestor': self.ancestor,
            'descendant': self.descendant,
            'depth': self.depth,
            'user_account_id': self.user_account_id
        }

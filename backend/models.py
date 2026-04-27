from database import db
from datetime import datetime
import bcrypt

class User(db.Model):
    __tablename__ = 'user_account'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # Nullable for OAuth users
    oauth_provider = db.Column(db.String(50), nullable=True)  # 'google', 'github', etc.
    oauth_id = db.Column(db.String(255), nullable=True)  # Provider's user ID
    role = db.Column(db.Enum('user', 'admin', name='user_roles'), default='user', nullable=False)  # 'user' or 'admin'
    created_at = db.Column(db.DateTime, default=datetime.now(), nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    files = db.relationship('File', backref='user', lazy=True, cascade='all, delete-orphan', foreign_keys='File.user_account_id')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password against hash"""
        if not self.password_hash:
            return False  # OAuth users don't have password
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    def to_dict(self):
        """Return user data as dictionary"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'oauth_provider': self.oauth_provider,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
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

class FileSystemItem(db.Model):
    __tablename__ = 'filesystem_item'

    item_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    item_name = db.Column(db.String(255), nullable=False)
    path = db.Column(db.String(1024), nullable=False)
    item_kind = db.Column(db.Enum('folder', 'file', name='filesystem_item_kind'), nullable=False)
    item_type = db.Column(db.Enum('user-defined', 'sample', name='object_type'), default='user-defined', nullable=False)
    user_account_id = db.Column(db.Integer, db.ForeignKey('user_account.id'), nullable=True)
    parent_item_id = db.Column(db.Integer, db.ForeignKey('filesystem_item.item_id', ondelete='CASCADE'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)

    parent = db.relationship(
        'FileSystemItem',
        remote_side=[item_id],
        backref=db.backref('children', lazy=True, cascade='all, delete-orphan')
    )

    __table_args__ = (
        db.UniqueConstraint('user_account_id', 'parent_item_id', 'item_name', name='uq_item_sibling_name'),
    )

    __mapper_args__ = {
        'polymorphic_on': item_kind,
        'polymorphic_identity': 'item',
    }


class Folder(FileSystemItem):
    __tablename__ = 'folder'

    folder_id = db.Column(db.Integer, db.ForeignKey('filesystem_item.item_id', ondelete='CASCADE'), primary_key=True)

    # Compatibility aliases for existing route/helper naming.
    folder_name = db.synonym('item_name')
    folder_type = db.synonym('item_type')
    user_id = db.synonym('user_account_id')
    parent_folder_id = db.synonym('parent_item_id')

    user = db.relationship('User', backref='folders', foreign_keys='Folder.user_account_id')
    files = db.relationship(
        'File',
        primaryjoin='Folder.item_id == foreign(File.parent_item_id)',
        foreign_keys='File.parent_item_id',
        back_populates='folder',
        overlaps='children,parent',
        lazy=True,
        cascade='all, delete-orphan'
    )

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

    __mapper_args__ = {
        'polymorphic_identity': 'folder',
    }

    def to_dict(self, include_files=False):
        """Return folder as dictionary"""
        result = {
            'folder_id': self.folder_id,
            'folder_name': self.folder_name,
            'path': self.path,
            'type': self.folder_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'user_id': self.user_id,
            'parent_folder_id': self.parent_folder_id
        }

        if include_files:
            result['files'] = [f.to_dict() for f in self.files]

        return result


class File(FileSystemItem):
    __tablename__ = 'file'

    file_id = db.Column(db.Integer, db.ForeignKey('filesystem_item.item_id', ondelete='CASCADE'), primary_key=True)
    content = db.Column(db.Text, nullable=True)
    content_blob = db.Column(db.LargeBinary, nullable=True)
    content_mime = db.Column(db.String(100), nullable=True)
    lang_id = db.Column(db.Integer, db.ForeignKey('language.lang_id'), nullable=False)

    # Compatibility aliases for existing route/helper naming.
    file_name = db.synonym('item_name')
    file_type = db.synonym('item_type')
    folder_id = db.synonym('parent_item_id')

    folder = db.relationship(
        'Folder',
        primaryjoin='File.parent_item_id == remote(Folder.item_id)',
        foreign_keys='File.parent_item_id',
        back_populates='files',
        uselist=False,
        overlaps='children,parent'
    )

    __mapper_args__ = {
        'polymorphic_identity': 'file',
    }

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
            'has_binary': self.content_blob is not None,
            'content_mime': self.content_mime,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }

        if include_content:
            result['content'] = self.content

        return result


class ClosureTable(db.Model):
    __tablename__ = 'closure_table'
    
    ancestor = db.Column(db.Integer, db.ForeignKey('filesystem_item.item_id', ondelete='CASCADE'), 
                        primary_key=True, nullable=False)
    descendant = db.Column(db.Integer, db.ForeignKey('filesystem_item.item_id', ondelete='CASCADE'), 
                          primary_key=True, nullable=False)
    depth = db.Column(db.Integer, nullable=False)
    
    def to_dict(self):
        """Return closure entry as dictionary"""
        return {
            'ancestor': self.ancestor,
            'descendant': self.descendant,
            'depth': self.depth
        }


class ResetTokens(db.Model):
    __tablename__ = 'reset_tokens'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user_account.id', ondelete='CASCADE'), nullable=False)
    token = db.Column(db.String(255), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    user = db.relationship('User', backref='reset_tokens')
    
    def to_dict(self):
        """Return reset token as dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'token': self.token,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }
from database import db
from datetime import datetime, timezone
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

    def record_login(self, when=None):
        self.last_login = when or datetime.now()
        return self

    def link_oauth(self, provider, oauth_id):
        self.oauth_provider = provider
        self.oauth_id = oauth_id
        return self
    
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

    def get_run_cmd(self):
        return self.run_cmd

    def get_docker_image(self):
        return self.docker_image

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

    @staticmethod
    def build_path(parent_path, name):
        if parent_path:
            return f"{parent_path}/{name}"
        return f"/{name}"

    @classmethod
    def is_name_available(cls, user_id, parent_item_id, name, exclude_item_id=None):
        query = FileSystemItem.query.filter_by(
            item_name=name,
            user_account_id=user_id,
            parent_item_id=parent_item_id
        )
        if exclude_item_id is not None:
            query = query.filter(FileSystemItem.item_id != exclude_item_id)
        return query.first() is None


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

    @classmethod
    def create_for_user(cls, user_id, folder_name, parent_folder_id=None, folder_type='user-defined', created_at=None):
        if created_at is None:
            created_at = datetime.now()

        if not FileSystemItem.is_name_available(user_id, parent_folder_id, folder_name):
            return None, {
                'status': 409,
                'message': f'An item named "{folder_name}" already exists in this location'
            }

        if parent_folder_id:
            parent = Folder.query.get(parent_folder_id)
            if not parent:
                return None, {
                    'status': 404,
                    'message': 'Parent folder not found'
                }
            if parent.user_id != user_id:
                return None, {
                    'status': 403,
                    'message': 'Access denied'
                }
            path = FileSystemItem.build_path(parent.path, folder_name)
        else:
            path = FileSystemItem.build_path(None, folder_name)

        from closure_table_helpers import create_folder_with_closure
        new_folder = create_folder_with_closure(
            folder_name=folder_name,
            path=path,
            folder_type=folder_type,
            created_at=created_at,
            user_id=user_id,
            parent_folder_id=parent_folder_id,
        )

        return new_folder, None

    @classmethod
    def rename_for_user(cls, folder_id, user_id, new_name):
        folder = Folder.query.get(folder_id)
        if not folder:
            return None, {
                'status': 404,
                'message': 'Folder not found'
            }

        duplicate = FileSystemItem.query.filter(
            FileSystemItem.user_account_id == user_id,
            FileSystemItem.parent_item_id == folder.parent_folder_id,
            FileSystemItem.item_name == new_name,
            FileSystemItem.item_id != folder.folder_id
        ).first()

        if duplicate:
            return None, {
                'status': 409,
                'message': f'An item named "{new_name}" already exists in this location'
            }

        old_path = folder.path
        folder.folder_name = new_name

        path_parts = old_path.rsplit('/', 1)
        parent_path = path_parts[0] if len(path_parts) > 1 else None
        folder.path = FileSystemItem.build_path(parent_path, new_name)

        db.session.commit()
        return folder, None

    @classmethod
    def move_for_user(cls, folder_id, new_parent_id, user_id):
        from closure_table_helpers import move_folder
        try:
            success = move_folder(folder_id, new_parent_id, user_id)
        except ValueError as exc:
            return False, {
                'status': 400,
                'message': str(exc)
            }

        return success, None


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

    def set_content(self, content):
        self.content = content
        self.content_blob = None
        self.content_mime = None
        return self

    def set_binary(self, blob_content, mime_type):
        self.content = None
        self.content_blob = blob_content
        self.content_mime = mime_type
        return self

    @classmethod
    def create_for_user(cls, user_id, file_name, folder_id, language_id, content=''):
        language = Language.query.get(language_id)
        if not language:
            return None, {
                'status': 400,
                'message': 'Invalid language_id'
            }

        if not FileSystemItem.is_name_available(user_id, folder_id, file_name):
            return None, {
                'status': 409,
                'message': f'An item named "{file_name}" already exists in this location'
            }

        if folder_id:
            folder = Folder.query.get(folder_id)
            if not folder:
                return None, {
                    'status': 404,
                    'message': 'Folder not found'
                }
            if folder.user_id != user_id:
                return None, {
                    'status': 403,
                    'message': 'Access denied'
                }
            path = FileSystemItem.build_path(folder.path, file_name)
        else:
            path = FileSystemItem.build_path(None, file_name)

        now = datetime.now()
        new_file = File(
            file_name=file_name,
            folder_id=folder_id,
            path=path,
            file_type='user-defined',
            user_account_id=user_id,
            content=content,
            content_blob=None,
            content_mime=None,
            lang_id=language_id,
            created_at=now,
            last_updated=now
        )

        db.session.add(new_file)
        db.session.commit()
        return new_file, None

    @classmethod
    def update_for_user(cls, file_id, user_id, data):
        file = File.query.filter_by(
            file_id=file_id,
            user_account_id=user_id
        ).first()

        if not file:
            return None, {
                'status': 404,
                'message': 'File not found'
            }

        target_folder_id = file.folder_id
        if 'folder_id' in data:
            target_folder_id = data.get('folder_id')
            if target_folder_id is not None:
                target_folder = Folder.query.get(target_folder_id)
                if not target_folder:
                    return None, {
                        'status': 404,
                        'message': 'Destination folder not found'
                    }
                if target_folder.user_id != user_id:
                    return None, {
                        'status': 403,
                        'message': 'Access denied'
                    }

        new_name = data.get('file_name', file.file_name)

        if not FileSystemItem.is_name_available(
            user_id,
            target_folder_id,
            new_name,
            exclude_item_id=file.file_id
        ):
            return None, {
                'status': 409,
                'message': f'An item named "{new_name}" already exists in this location'
            }

        if 'content' in data:
            file.set_content(data['content'])

        file.file_name = new_name
        file.folder_id = target_folder_id
        if target_folder_id is not None:
            target_folder = Folder.query.get(target_folder_id)
            file.path = FileSystemItem.build_path(target_folder.path, new_name)
        else:
            file.path = FileSystemItem.build_path(None, new_name)

        file.last_updated = datetime.now()
        db.session.commit()
        return file, None

    @classmethod
    def create_image_for_user(cls, user_id, file_name, folder_id, language_id, blob_content, mime_type):
        language = Language.query.get(language_id)
        if not language:
            return None, {
                'status': 400,
                'message': 'Invalid language_id'
            }

        if not FileSystemItem.is_name_available(user_id, folder_id, file_name):
            return None, {
                'status': 409,
                'message': f'An item named "{file_name}" already exists in this location'
            }

        if folder_id:
            folder = Folder.query.get(folder_id)
            if not folder:
                return None, {
                    'status': 404,
                    'message': 'Folder not found'
                }
            if folder.user_id != user_id:
                return None, {
                    'status': 403,
                    'message': 'Access denied'
                }
            path = FileSystemItem.build_path(folder.path, file_name)
        else:
            path = FileSystemItem.build_path(None, file_name)

        now = datetime.now()
        new_file = File(
            file_name=file_name,
            folder_id=folder_id,
            path=path,
            file_type='user-defined',
            user_account_id=user_id,
            content=None,
            content_blob=blob_content,
            content_mime=mime_type,
            lang_id=language_id,
            created_at=now,
            last_updated=now,
        )

        db.session.add(new_file)
        db.session.commit()
        return new_file, None


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

    def is_expired(self, now=None):
        if self.expires_at is None:
            return True

        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)

        expires_at = self.expires_at
        if isinstance(expires_at, str):
            try:
                expires_at = datetime.fromisoformat(expires_at)
            except ValueError:
                return True

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        return current > expires_at

    def consume(self):
        db.session.delete(self)
        return self
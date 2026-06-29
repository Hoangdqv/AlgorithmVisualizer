from datetime import datetime

from flask import Blueprint, Response, jsonify, request, session

from database import db


bp = Blueprint('files', __name__)

# ============================================
# FILE SYSTEM ROUTES
# ============================================

@bp.route('/api/languages', methods=['GET'])
def get_languages():
    """Get all available programming languages"""
    from models import Language
    
    try:
        languages = Language.query.all()
        return jsonify({
            'languages': [{
                'lang_id': lang.lang_id,
                'language': lang.language,
                'docker_img': lang.docker_image,
                'cmd': lang.run_cmd
            } for lang in languages]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/user/folders', methods=['GET'])
def get_user_folders():
    """Get all root folders for current user"""
    from models import ClosureTable
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        root_folders = ClosureTable.get_root_folders(user_id, 'user-defined')
        return jsonify({
            'folders': [f.to_dict() for f in root_folders]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/folders/<int:folder_id>/tree', methods=['GET'])
def get_hierarchy_route(folder_id):
    """Get entire folder tree from specified folder"""
    from models import ClosureTable
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        tree_data = ClosureTable.get_hierarchy(folder_id, user_id)
        
        # Build hierarchical structure
        result = []
        for folder, depth in tree_data:
            folder_dict = folder.to_dict(include_files=False)
            folder_dict['depth'] = depth
            folder_dict['files'] = [f.to_dict(include_content=False) for f in folder.files]
            result.append(folder_dict)
        
        return jsonify({'tree': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/folders', methods=['POST'])
def add_entry():
    """Create a new folder"""
    from models import Folder

    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'User not authenticated'}), 401
    
    data = request.get_json()
    item_name = data.get('item_name')
    parent_item_id = data.get('parent_item_id')  # None for root
    
    if not item_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    try:
        new_folder, error = Folder.create_for_user(
            user_account_id=user_id,
            item_name=item_name,
            parent_item_id=parent_item_id,
            item_type='user-defined',
            created_at=datetime.now(),
        )

        if error:
            return jsonify({'error': error['message']}), error['status']
        
        return jsonify({
            'message': 'Folder created successfully',
            'folder': new_folder.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/folders/<int:folder_id>', methods=['PUT'])
def update_folder(folder_id):
    """Rename a folder"""
    from models import Folder
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    new_name = data.get('item_name')
    
    if not new_name:
        return jsonify({'error': 'Folder name is required'}), 400
    
    try:
        folder, error = Folder.rename_for_user(folder_id, user_id, new_name)

        if error:
            return jsonify({'error': error['message']}), error['status']
        
        return jsonify({
            'message': 'Folder renamed successfully',
            'folder': folder.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/folders/<int:folder_id>', methods=['DELETE'])
def delete_folder(folder_id):
    """Delete a folder and all its contents"""
    from models import ClosureTable
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    try:
        deleted_count = ClosureTable.delete_entry(folder_id, user_id)
        return jsonify({
            'message': f'Deleted {deleted_count} folder(s) successfully'
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/folders/<int:folder_id>/move', methods=['POST'])
def move_entry(folder_id):
    """Move folder to a new parent"""
    from models import Folder
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    new_parent_id = data.get('new_parent_id')  # None for root
    
    try:
        success, error = Folder.move_for_user(folder_id, new_parent_id, user_id)

        if error:
            return jsonify({'error': error['message']}), error['status']

        if success:
            return jsonify({'message': 'Folder moved successfully'}), 200
        else:
            return jsonify({'error': 'Failed to move folder'}), 500
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ============================================
# FILE ROUTES
# ============================================

@bp.route('/api/user/files', methods=['GET'])
def get_user_files():
    """Get all files for current user"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    parent_item_id = request.args.get('parent_item_id', type=int)
    
    try:
        if parent_item_id is not None:
            # Get files in specific folder
            files = File.query.filter_by(
                user_account_id=user_id,
                parent_item_id=parent_item_id,
                item_type='user-defined'
            ).all()
        else:
            # Get all user files
            files = File.query.filter_by(
                user_account_id=user_id,
                item_type='user-defined'
            ).order_by(File.last_updated.desc()).all()
        
        return jsonify({
            'files': [f.to_dict(include_content=False) for f in files]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/files/<int:file_id>', methods=['GET'])
def get_file(file_id):
    """Get file content"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    file = File.query.filter_by(
        file_id=file_id,
        user_account_id=user_id
    ).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({'file': file.to_dict(include_content=True)}), 200


@bp.route('/api/user/files', methods=['POST'])
def create_file():
    """Create a new file"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    data = request.get_json()
    item_name = data.get('item_name')
    parent_item_id = data.get('parent_item_id')  # None for root level
    language_id = data.get('language_id')
    content = data.get('content', '')
    
    if not item_name:
        return jsonify({'error': 'File name is required'}), 400
    if language_id is None:
        return jsonify({'error': 'language_id is required'}), 400
    
    try:
        new_file, error = File.create_for_user(
            user_account_id=user_id,
            item_name=item_name,
            parent_item_id=parent_item_id,
            language_id=language_id,
            content=content
        )

        if error:
            return jsonify({'error': error['message']}), error['status']
        
        return jsonify({
            'message': 'File created successfully',
            'file': new_file.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/files/<int:file_id>', methods=['PUT'])
def update_file(file_id):
    """Update file content, rename file, or move file"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    data = request.get_json()
    
    try:
        file, error = File.update_for_user(file_id, user_id, data)

        if error:
            return jsonify({'error': error['message']}), error['status']
        
        return jsonify({
            'message': 'File updated successfully',
            'file': file.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/files/upload-image', methods=['POST'])
def upload_user_image_file():
    """Upload an image file directly as binary blob"""
    from models import File

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    upload = request.files.get('file')
    item_name = request.form.get('item_name')
    parent_item_id_raw = request.form.get('parent_item_id')
    language_id_raw = request.form.get('language_id')

    parent_item_id = int(parent_item_id_raw) if parent_item_id_raw not in (None, '', 'null') else None
    language_id = int(language_id_raw) if language_id_raw not in (None, '') else None

    if not upload:
        return jsonify({'error': 'Image file is required'}), 400
    if not item_name:
        return jsonify({'error': 'File name is required'}), 400
    if language_id is None:
        return jsonify({'error': 'language_id is required'}), 400

    mime_type = upload.mimetype or 'application/octet-stream'
    if not mime_type.startswith('image/'):
        return jsonify({'error': 'Only image uploads are supported for this route'}), 400

    # Return of read() is a bytes object and store into content_blob in DB
    blob_content = upload.read()
    if not blob_content:
        return jsonify({'error': 'Uploaded image is empty'}), 400

    try:
        new_file, error = File.create_image_for_user(
            user_account_id=user_id,
            item_name=item_name,
            parent_item_id=parent_item_id,
            language_id=language_id,
            blob_content=blob_content,
            mime_type=mime_type
        )

        if error:
            return jsonify({'error': error['message']}), error['status']

        return jsonify({
            'message': 'Image file uploaded successfully',
            'file': new_file.to_dict(include_content=False)
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/api/user/files/<int:file_id>/binary', methods=['GET'])
def get_file_binary(file_id):
    """Get binary file content for user-owned files"""
    from models import File

    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401

    file = File.query.filter_by(
        file_id=file_id,
        user_account_id=user_id
    ).first()

    if not file:
        return jsonify({'error': 'File not found'}), 404
    if not file.content_blob:
        return jsonify({'error': 'No binary content available for this file'}), 404

    return Response(
        file.content_blob,
        mimetype=file.content_mime or 'application/octet-stream',
        headers={
            'Content-Disposition': f'inline; filename="{file.item_name}"'
        }
    )


@bp.route('/api/user/files/<int:file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file"""
    from models import File
    
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'error': 'Not authenticated'}), 401
    
    file = File.query.filter_by(
        file_id=file_id,
        user_account_id=user_id
    ).first()
    
    if not file:
        return jsonify({'error': 'File not found'}), 404
    
    parent_folder = file.folder
    file_owner = file.user
    try:
        if parent_folder is not None:
            # Remove from folder relationship
            parent_folder.files.remove(file)
        elif file_owner is not None:
            # Root-level files rely on the user
            file_owner.files.remove(file)
        else:
            db.session.delete(file)
        db.session.commit()
        return jsonify({'message': 'File deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

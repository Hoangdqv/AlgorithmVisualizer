import os

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from config import LANGUAGE_MAP, SAMPLE_CODE_DIR
from config import add_sample_config, remove_sample_config, update_sample_config
from routes.common import admin_required, strip_docker_json_output, _safe_join


bp = Blueprint('samples', __name__)

# ============================================
# SIMPLE CODE SAMPLES ROUTES
# ============================================

@bp.route('/api/samples', methods=['GET'])
def get_all_samples():
    """Get all languages with their samples"""
    result = {}
    for lang_key, lang_config in LANGUAGE_MAP.items():
        result[lang_key] = {
            'display_name': lang_config['display_name'],
            'samples': [
                {
                    'key': key,
                    'name': sample['name'],
                    'description': sample['description']
                }
                for key, sample in lang_config['samples'].items()
            ]
        }
    return jsonify({'languages': result})

@bp.route('/api/samples/<language>', methods=['GET'])
def get_samples(language):
    """Get list of samples for a specific language"""
    lang_config = LANGUAGE_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    samples = [
        {
            'key': key,
            'name': sample['name'],
            'description': sample['description']
        }
        for key, sample in lang_config['samples'].items()
    ]
    
    return jsonify({'samples': samples})

@bp.route('/api/samples/<language>/<sample_key>', methods=['GET'])
def get_sample_code(language, sample_key):
    """Get specific sample code"""
    lang_config = LANGUAGE_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    sample = lang_config['samples'].get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404
    
    filepath = os.path.join(SAMPLE_CODE_DIR, sample['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        clean_code = strip_docker_json_output(code)
        
        return jsonify({
            'code': clean_code,
            'language': language,
            'name': sample['name'],
            'description': sample['description'],
            'await_console_input': sample.get('await_console_input', False)
        })
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404


@bp.route('/api/admin/sample-code', methods=['GET'])
@admin_required
def get_admin_sample_code_list():
    """Get all simple code samples for admin management"""
    samples = []

    for lang_key, lang_config in LANGUAGE_MAP.items():
        for key, sample in lang_config.get('samples', {}).items():
            samples.append({
                'language': lang_key,
                'key': key,
                'name': sample.get('name', key),
                'display_name': sample.get('name', key),
                'description': sample.get('description', ''),
                'file': sample.get('file', ''),
                'await_console_input': sample.get('await_console_input', False)
            })

    return jsonify({'samples': samples}), 200


@bp.route('/api/admin/sample-code', methods=['POST'])
@admin_required
def create_admin_sample_code():
    """Create a simple code sample and register it for the playground"""
    from werkzeug.utils import secure_filename

    data = request.get_json() or {}
    language = secure_filename(data.get('language', '')).lower()
    name = data.get('name', '').strip()
    description = data.get('description', '').strip()
    await_console_input = data.get('await_console_input', False)

    if not language or not name:
        return jsonify({'error': 'Language and name are required'}), 400

    lang_config = LANGUAGE_MAP.get(language)
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    base_key = secure_filename(name.lower().replace(' ', '_'))
    if not base_key:
        return jsonify({'error': 'Name must contain letters or numbers'}), 400

    samples = lang_config.get('samples', {})
    sample_key = base_key
    suffix = 2
    while sample_key in samples:
        sample_key = f'{base_key}_{suffix}'
        suffix += 1

    valid_ext = '.py' if language == 'python' else '.js'
    relative_file = f'{language}/{sample_key}{valid_ext}'
    file_path = _safe_join(SAMPLE_CODE_DIR, relative_file)

    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    while os.path.exists(file_path):
        sample_key = f'{base_key}_{suffix}'
        suffix += 1
        relative_file = f'{language}/{sample_key}{valid_ext}'
        file_path = _safe_join(SAMPLE_CODE_DIR, relative_file)

        if not file_path:
            return jsonify({'error': 'Invalid sample file path'}), 400

    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        code = data.get('content') if 'content' in data else data.get('code')
        if code is None:
            code = '# Write sample code here\n' if language == 'python' else '// Write sample code here\n'

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)

        created = add_sample_config(
            language,
            sample_key,
            name,
            relative_file,
            description,
            await_console_input
        )

        if not created:
            return jsonify({'error': 'Failed to register sample code'}), 500

        return jsonify({
            'message': 'Sample code created successfully',
            'sample': {
                'language': language,
                'key': sample_key,
                'name': name,
                'display_name': name,
                'description': description,
                'await_console_input': bool(await_console_input)
            }
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create sample code: {str(e)}'}), 500


@bp.route('/api/admin/sample-code/<language>/<sample_key>', methods=['GET'])
@admin_required
def get_admin_sample_code_details(language, sample_key):
    """Get a simple code sample for editing"""
    from werkzeug.utils import secure_filename

    language = secure_filename(language).lower()
    sample_key = secure_filename(sample_key)
    lang_config = LANGUAGE_MAP.get(language)

    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    sample = lang_config.get('samples', {}).get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404

    file_path = _safe_join(SAMPLE_CODE_DIR, sample.get('file', ''))
    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()

        return jsonify({
            'language': language,
            'key': sample_key,
            'name': sample.get('name', sample_key),
            'display_name': sample.get('name', sample_key),
            'description': sample.get('description', ''),
            'file': sample.get('file', ''),
            'filename': os.path.basename(sample.get('file', '')),
            'await_console_input': sample.get('await_console_input', False),
            'code': code
        }), 200
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404
    except Exception as e:
        return jsonify({'error': f'Failed to read sample code: {str(e)}'}), 500


@bp.route('/api/admin/sample-code/<language>/<sample_key>', methods=['PUT'])
@admin_required
def update_admin_sample_code_details(language, sample_key):
    """Update a simple code sample file and editable metadata"""
    from werkzeug.utils import secure_filename

    language = secure_filename(language).lower()
    sample_key = secure_filename(sample_key)
    lang_config = LANGUAGE_MAP.get(language)

    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    sample = lang_config.get('samples', {}).get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404

    file_path = _safe_join(SAMPLE_CODE_DIR, sample.get('file', ''))
    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    valid_ext = '.py' if language == 'python' else '.js'
    if not file_path.endswith(valid_ext):
        return jsonify({'error': f'Invalid file extension. Expected {valid_ext}'}), 400

    data = request.get_json() or {}
    code = data.get('content') if 'content' in data else data.get('code')

    if code is None:
        return jsonify({'error': 'Code content is required'}), 400

    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)

        update_sample_config(
            language,
            sample_key,
            name=data.get('name'),
            description=data.get('description'),
            await_console_input=data.get('await_console_input')
            if 'await_console_input' in data
            else None
        )

        return jsonify({'message': 'Sample code updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update sample code: {str(e)}'}), 500


@bp.route('/api/admin/sample-code/<language>/<sample_key>', methods=['DELETE'])
@admin_required
def delete_admin_sample_code(language, sample_key):
    """Delete a simple code sample file and registry entry"""
    from werkzeug.utils import secure_filename

    language = secure_filename(language).lower()
    sample_key = secure_filename(sample_key)
    lang_config = LANGUAGE_MAP.get(language)

    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404

    sample = lang_config.get('samples', {}).get(sample_key)
    if not sample:
        return jsonify({'error': 'Sample not found'}), 404

    file_path = _safe_join(SAMPLE_CODE_DIR, sample.get('file', ''))
    if not file_path:
        return jsonify({'error': 'Invalid sample file path'}), 400

    try:
        if os.path.exists(file_path):
            os.remove(file_path)

        removed = remove_sample_config(language, sample_key)
        if not removed:
            return jsonify({'error': 'Failed to unregister sample code'}), 500

        return jsonify({'message': 'Sample code deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete sample code: {str(e)}'}), 500

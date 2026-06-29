import os

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from config import ALGORITHM_MAP, SAMPLE_ALGORITHMS_DIR
from config import add_algorithm_config, remove_algorithm_config
from routes.common import admin_required, _safe_join


bp = Blueprint('admin', __name__)

# ============================================
# ADMIN ROUTES - ALGORITHM MANAGEMENT
# ============================================

@bp.route('/api/admin/categories', methods=['GET'])
@admin_required
def get_categories():
    """Get all algorithm categories"""
    categories = []
    
    if os.path.exists(SAMPLE_ALGORITHMS_DIR):
        for item in os.listdir(SAMPLE_ALGORITHMS_DIR):
            item_path = os.path.join(SAMPLE_ALGORITHMS_DIR, item)
            if os.path.isdir(item_path) and not item.startswith('.'):
                categories.append(item)
    
    return jsonify({'categories': sorted(categories)}), 200


@bp.route('/api/admin/algorithms', methods=['GET'])
@admin_required
def get_all_algorithms():
    """Get all algorithms across all categories"""
    from werkzeug.utils import secure_filename
    
    algorithms = []
    
    if not os.path.exists(SAMPLE_ALGORITHMS_DIR):
        return jsonify({'algorithms': []}), 200
    
    for category in os.listdir(SAMPLE_ALGORITHMS_DIR):
        category_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category)
        
        if not os.path.isdir(category_path) or category.startswith('.'):
            continue
        
        for algorithm in os.listdir(category_path):
            algorithm_path = os.path.join(category_path, algorithm)
            
            if not os.path.isdir(algorithm_path) or algorithm.startswith('.'):
                continue
            
            # Check for required files
            has_python = os.path.exists(os.path.join(algorithm_path, 'python'))
            has_javascript = os.path.exists(os.path.join(algorithm_path, 'javascript'))
            has_explanation = os.path.exists(os.path.join(algorithm_path, 'explanation.txt'))
            
            algorithms.append({
                'category': category,
                'name': algorithm,
                'display_name': algorithm.replace('_', ' ').title(),
                'has_python': has_python,
                'has_javascript': has_javascript,
                'has_explanation': has_explanation
            })
    
    return jsonify({'algorithms': algorithms}), 200


@bp.route('/api/admin/algorithms/<category>/<algorithm>', methods=['GET'])
@admin_required
def get_algorithm_details(category, algorithm):
    """Get details of a specific algorithm"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    
    algorithm_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm)
    
    if not os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm not found'}), 404
    
    details = {
        'category': category,
        'name': algorithm,
        'display_name': algorithm.replace('_', ' ').title(),
        'explanation': None,
        'languages': {}
    }
    
    # Get explanation
    explanation_path = os.path.join(algorithm_path, 'explanation.txt')
    if os.path.exists(explanation_path):
        with open(explanation_path, 'r', encoding='utf-8') as f:
            details['explanation'] = f.read()
    
    # Get code files for each language
    for lang in ['python', 'javascript']:
        lang_dir = os.path.join(algorithm_path, lang)
        if os.path.exists(lang_dir):
            files = []
            for file in os.listdir(lang_dir):
                if file.endswith('.py' if lang == 'python' else '.js'):
                    file_path = os.path.join(lang_dir, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        files.append({
                            'filename': file,
                            'content': f.read()
                        })
            details['languages'][lang] = files
    
    return jsonify(details), 200


@bp.route('/api/admin/algorithms/<category>/<algorithm>/explanation', methods=['PUT'])
@admin_required
def update_explanation(category, algorithm):
    """Update algorithm explanation"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    
    algorithm_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm)
    
    if not os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm not found'}), 404
    
    data = request.get_json()
    explanation = data.get('explanation')
    
    if explanation is None:
        return jsonify({'error': 'Explanation content is required'}), 400
    
    explanation_path = os.path.join(algorithm_path, 'explanation.txt')
    
    try:
        with open(explanation_path, 'w', encoding='utf-8') as f:
            f.write(explanation)
        return jsonify({'message': 'Explanation updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update explanation: {str(e)}'}), 500


@bp.route('/api/admin/algorithms/<category>/<algorithm>/code/<language>/<filename>', methods=['GET'])
@admin_required
def get_algorithm_code_file(category, algorithm, language, filename):
    """Get algorithm code file for editing"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    language = secure_filename(language)
    filename = secure_filename(filename)
    
    # Validate language
    if language not in ['python', 'javascript']:
        return jsonify({'error': 'Invalid language'}), 400
    
    file_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm, language, filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()
        return jsonify({
            'code': code,
            'category': category,
            'algorithm': algorithm,
            'language': language,
            'filename': filename,
            'path': file_path
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to read code file: {str(e)}'}), 500


@bp.route('/api/admin/algorithms/<category>/<algorithm>/code/<language>/<filename>', methods=['PUT'])
@admin_required
def update_code_file(category, algorithm, language, filename):
    """Update algorithm code file"""
    from werkzeug.utils import secure_filename
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    language = secure_filename(language)
    filename = secure_filename(filename)
    
    # Validate language
    if language not in ['python', 'javascript']:
        return jsonify({'error': 'Invalid language'}), 400
    
    # Validate file extension
    valid_ext = '.py' if language == 'python' else '.js'
    if not filename.endswith(valid_ext):
        return jsonify({'error': f'Invalid file extension. Expected {valid_ext}'}), 400
    
    file_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm, language, filename)
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    data = request.get_json()
    # Accept both 'code' and 'content' for flexibility
    code = data.get('content') or data.get('code')
    
    if code is None:
        return jsonify({'error': 'Code content is required'}), 400
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(code)
        return jsonify({'message': 'Code file updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to update code file: {str(e)}'}), 500


@bp.route('/api/admin/algorithms', methods=['POST'])
@admin_required
def create_algorithm():
    """Create a new algorithm"""
    from werkzeug.utils import secure_filename
    
    data = request.get_json()
    category = secure_filename(data.get('category', ''))
    algorithm_name = secure_filename(data.get('name', ''))
    explanation = data.get('explanation', '')
    
    if not category or not algorithm_name:
        return jsonify({'error': 'Category and algorithm name are required'}), 400
    
    # Check if category exists
    category_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category)
    if not os.path.exists(category_path):
        return jsonify({'error': 'Category does not exist'}), 404
    
    algorithm_path = os.path.join(category_path, algorithm_name)
    
    # Check if algorithm already exists
    if os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm already exists'}), 400
    
    try:
        # Create algorithm directory
        os.makedirs(algorithm_path)
        
        # Create explanation file
        explanation_path = os.path.join(algorithm_path, 'explanation.txt')
        with open(explanation_path, 'w', encoding='utf-8') as f:
            f.write(explanation if explanation else f'{algorithm_name.replace("_", " ").title()} - Algorithm Explanation\n\n[Add explanation here]')
        
        # Create language directories
        os.makedirs(os.path.join(algorithm_path, 'python'))
        os.makedirs(os.path.join(algorithm_path, 'javascript'))
        
        # Create placeholder files
        python_file = os.path.join(algorithm_path, 'python', f'{algorithm_name}.py')
        with open(python_file, 'w', encoding='utf-8') as f:
            f.write(f'# {algorithm_name.replace("_", " ").title()}\n\nfrom runtime.tracer import Tracer\n# Add algorithm implementation here\n\nif __name__ == "__main__":\n#[PARAMS]\n    # Add parameters here\n#[PARAMS]\n    main()\n')
        
        javascript_file = os.path.join(algorithm_path, 'javascript', f'{algorithm_name}.js')
        with open(javascript_file, 'w', encoding='utf-8') as f:
            f.write(f"// {algorithm_name.replace("_", " ").title()}\n\nimport Tracer from './runtime/tracer.js';\n// Add algorithm implementation here\n//[PARAMS]\n    // Add parameters here\n//[PARAMS] \n\ntracer.finalize();\n")

        # Add algorithm to config
        display_name = f'{algorithm_name.replace("_", " ").title()}'
        explanation_relative_path = f'{category}/{algorithm_name}/explanation.txt'
        python_relative_path = f'{category}/{algorithm_name}/python/{algorithm_name}.py'
        javascript_relative_path = f'{category}/{algorithm_name}/javascript/{algorithm_name}.js'

        add_algorithm_config(
            category,
            algorithm_name,
            display_name,
            python_relative_path,
            f'{display_name} algorithm',
            'python',
            explanation_file=explanation_relative_path
        )
        add_algorithm_config(
            category,
            algorithm_name,
            display_name,
            javascript_relative_path,
            f'{display_name} algorithm',
            'javascript',
            explanation_file=explanation_relative_path
        )

        return jsonify({
            'message': 'Algorithm created successfully',
            'algorithm': {
                'category': category,
                'name': algorithm_name
            }
        }), 201
    except Exception as e:
        return jsonify({'error': f'Failed to create algorithm: {str(e)}'}), 500


@bp.route('/api/admin/algorithms/<category>/<algorithm>', methods=['DELETE'])
@admin_required
def delete_algorithm(category, algorithm):
    """Delete an algorithm"""
    from werkzeug.utils import secure_filename
    import shutil
    
    category = secure_filename(category)
    algorithm = secure_filename(algorithm)
    
    algorithm_path = os.path.join(SAMPLE_ALGORITHMS_DIR, category, algorithm)
    
    if not os.path.exists(algorithm_path):
        return jsonify({'error': 'Algorithm not found'}), 404
    
    try:
        shutil.rmtree(algorithm_path)
        remove_algorithm_config(category, algorithm)
        return jsonify({'message': 'Algorithm deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': f'Failed to delete algorithm: {str(e)}'}), 500

import os

from flask import Blueprint, jsonify

from config import ALGORITHM_MAP, SAMPLE_ALGORITHMS_DIR


bp = Blueprint('algorithms', __name__)

# ============================================
# EDUCATIONAL ALGORITHMS ROUTES
# ============================================

@bp.route('/api/algorithms/<category>/<language>', methods=['GET'])
def get_category_algorithms(category, language):
    """Get algorithms for a specific category and language"""
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms_map = category_config['algorithms'].get(language.lower(), {})
    algorithms = [
        {
            'key': key,
            **algorithm
        }
        for key, algorithm in algorithms_map.items()
    ]
    
    return jsonify({
        'category': category_config['display_name'],
        'language': language,
        'algorithms': algorithms
    })

@bp.route('/api/algorithms/<category>/<language>/<algorithm_key>', methods=['GET'])
def get_algorithm_code(category, language, algorithm_key):
    """Get specific algorithm code with explanation"""
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms_map = category_config['algorithms'].get(language.lower(), {})
    algorithm = algorithms_map.get(algorithm_key)
    
    if not algorithm:
        return jsonify({'error': 'Algorithm not found'}), 404
    
    filepath = os.path.join(SAMPLE_ALGORITHMS_DIR, algorithm['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        # Try to read explanation file if it exists
        explanation = None
        if 'explanation_file' in algorithm:
            explanation_filepath = os.path.join(SAMPLE_ALGORITHMS_DIR, algorithm['explanation_file'])
            try:
                with open(explanation_filepath, 'r', encoding='utf-8') as f:
                    explanation = f.read()
            except FileNotFoundError:
                pass  # Explanation is optional
        
        return jsonify({
            'code': code,
            'language': language,
            'name': algorithm['name'],
            'description': algorithm['description'],
            'explanation': explanation
        })
    except FileNotFoundError:
        return jsonify({'error': 'Algorithm code file not found'}), 404

# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from config import LANGUAGE_MAP, ALGORITHM_MAP, SAMPLE_CODE_DIR, SAMPLE_ALGORITHMS_DIR
from containerHandler import ContainerHandler
import os

app = Flask(__name__)
CORS(app)

PISTON_API_URL = "https://emkc.org/api/v2/piston"
container_handler = ContainerHandler()

def strip_docker_json_output(code):
    """Remove JSON output markers and content for display purposes."""
    lines = code.split('\n')
    filtered_lines = []
    skip_json = False
    
    for line in lines:
        # Check for JSON block markers
        if '--- TRACER_JSON_START ---' in line:
            skip_json = True
            continue
        if '--- TRACER_JSON_END ---' in line:
            skip_json = False
            continue
        if skip_json:
            continue
        
        # Skip the [DOCKER_JSON] marker
        if line.strip() in ['# [DOCKER_JSON]', '// [DOCKER_JSON]']:
            continue
            
        filtered_lines.append(line)
    
    return '\n'.join(filtered_lines)

# Get list of samples for a language
@app.route('/api/samples/<language>', methods=['GET'])
def get_samples(language):
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

#Get default sample algorithms
@app.route('/api/sample-algorithms/<language>', methods=['GET'])
def get_sample_algorithms(language):
    lang_config = ALGORITHM_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    algorithms = [
        {
            'key': key,
            'name': sample['name'],
            'description': sample['description']
        }
        for key, sample in lang_config['samples'].items()
    ]
    
    return jsonify({'algorithms': algorithms})


# Get default sample code 
@app.route('/api/sample-code/<language>', methods=['GET'])
def get_default_sample(language):
    lang_config = LANGUAGE_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    # Get first sample as default
    first_sample_key = list(lang_config['samples'].keys())[0]
    sample = lang_config['samples'][first_sample_key]
    filepath = os.path.join(SAMPLE_CODE_DIR, sample['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        return jsonify({
            'code': code,
            'language': language,
            'name': sample['name'],
            'description': sample['description']
        })
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404

# Get specific sample code
@app.route('/api/sample-code/<language>/<sample_key>', methods=['GET'])
def get_sample_code(language, sample_key):
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
            'description': sample['description']
        })
    except FileNotFoundError:
        return jsonify({'error': 'Sample code file not found'}), 404

#Get specific sample algorithm code
@app.route('/api/sample-algorithm/<language>/<algorithm_key>', methods=['GET'])
def get_sample_algorithm_code(language, algorithm_key):
    lang_config = ALGORITHM_MAP.get(language.lower())
    
    if not lang_config:
        return jsonify({'error': 'Language not supported'}), 404
    
    algorithm = lang_config['algorithms'].get(algorithm_key)
    if not algorithm:
        return jsonify({'error': 'Algorithm not found'}), 404
    
    filepath = os.path.join(SAMPLE_ALGORITHMS_DIR, algorithm['file'])
    
    try:
        with open(filepath, 'r') as f:
            code = f.read()
        
        clean_code = strip_docker_json_output(code)
        
        return jsonify({
            'code': clean_code,
            'language': language,
            'name': algorithm['name'],
            'description': algorithm['description']
        })
    except FileNotFoundError:
        return jsonify({'error': 'Algorithm code file not found'}), 404

# Get algorithms by category and language
@app.route('/api/category/<category>/algorithms/<language>', methods=['GET'])
def get_category_algorithms(category, language):
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms = category_config['algorithms'].get(language.lower(), [])
    
    return jsonify({
        'category': category_config['display_name'],
        'language': language,
        'algorithms': algorithms
    })

# Get specific algorithm code by category
@app.route('/api/category/<category>/algorithm/<language>/<algorithm_key>', methods=['GET'])
def get_category_algorithm_code(category, language, algorithm_key):
    category_config = ALGORITHM_MAP.get(category.lower())
    
    if not category_config:
        return jsonify({'error': 'Category not found'}), 404
    
    algorithms = category_config['algorithms'].get(language.lower(), [])
    algorithm = next((algo for algo in algorithms if algo['key'] == algorithm_key), None)
    
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

@app.route('/api/execute', methods=['POST'])
def execute_code():
    try:
        data = request.get_json()
        language = data.get('language', '').lower()
        code = data.get('code', '')
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        lang_config = LANGUAGE_MAP.get(language)
        if not lang_config:
            return jsonify({'error': f'Language {language} not supported'}), 400
        
        piston_language = lang_config['piston_name']
        
        piston_response = requests.post(
            f"{PISTON_API_URL}/execute",
            json={
                "language": piston_language,
                "version": "*",
                "files": [{"content": code}]
            }
        )
        
        if piston_response.status_code == 200:
            result = piston_response.json()
            return jsonify({
                'success': True,
                'output': result.get('run', {}).get('output', ''),
                'stderr': result.get('run', {}).get('stderr', ''),
                'code': result.get('run', {}).get('code', 0)
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to execute code'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    

@app.route('/api/execute/algorithm', methods=['POST'])
def execute_algorithm():
    try:
        data = request.get_json()
        language = data.get('language', '').lower()
        code = data.get('code', '')
        
        print(f"\n{'='*60}")
        print(f"[API] Received execution request for {language}")
        print(f"{'='*60}")
        
        if not code:
            return jsonify({'error': 'No code provided'}), 400
        
        # Use containerHandler to execute
        result = container_handler.execute_algorithm(language, code)
        
        print(f"\n[API] Result: {'SUCCESS' if result.get('success') else 'FAILED'}")
        if result.get('success'):
            print(f"[API] Output length: {len(result.get('output', ''))} chars")
            if 'states' in result:
                print(f"[API] States count: {len(result['states'].get('states', []))}")
        else:
            print(f"[API] Error: {result.get('error')}")
        print(f"{'='*60}\n")
        
        if not result.get('success'):
            return jsonify(result), 500
            
        return jsonify(result)
            
    except Exception as e:
        print(f"[API] EXCEPTION: {str(e)}\n")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/<language>/<search>', methods=['GET'])
def get_searchResults(language, search):
    query = request.args.get('q', '').lower()
    lang_config = LANGUAGE_MAP.get(language.lower())
    return [item for item in lang_config['samples'] if query in item['name'].lower()]


@app.route('/process', methods=['POST'])
def process_json():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    try:
        states = data.get("states", [])
        if not states:
            return jsonify({"error": "No states found in data"}), 400
        
        processed_data = []
        for step_data in states:
            if isinstance(step_data, dict):
                step_info = {
                    "step": step_data.get("step", None),
                    "state": step_data.get("data", [])  # Changed from "array" to "data"
                }
                processed_data.append(step_info)
            else:
                return jsonify({"error": "Data should consist of one pair of state and step."}), 400
        
        return jsonify({"processed_data": processed_data}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
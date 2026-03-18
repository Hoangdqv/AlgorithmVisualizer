# config.py
import json
import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PLAYGROUND_REGISTRY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'playground_registry.json')
ALGORITHM_REGISTRY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'algorithm_registry.json')

DEFAULT_SAMPLE_CODE_DIR = os.path.join(PROJECT_ROOT, 'sample_code')
DEFAULT_SAMPLE_ALGORITHMS_DIR = os.path.join(PROJECT_ROOT, 'sample_algorithms')


def _load_json_file(file_path):
    if not os.path.exists(file_path):
        return {}

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_json_file(file_path, data):
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)


def _load_playground_registry():
    registry = _load_json_file(PLAYGROUND_REGISTRY_FILE)

    registry.setdefault('sample_code_dir', DEFAULT_SAMPLE_CODE_DIR)
    registry.setdefault('languages', {})

    return registry


def _load_algorithm_registry():
    registry = _load_json_file(ALGORITHM_REGISTRY_FILE)

    # Backward compatibility for legacy shape: { "sorting": {...}, ... }
    if 'categories' not in registry and registry:
        registry = {
            'sample_algorithms_dir': DEFAULT_SAMPLE_ALGORITHMS_DIR,
            'categories': registry
        }

    registry.setdefault('sample_algorithms_dir', DEFAULT_SAMPLE_ALGORITHMS_DIR)
    registry.setdefault('categories', {})

    return registry


PLAYGROUND_REGISTRY = _load_playground_registry()
ALGORITHM_REGISTRY = _load_algorithm_registry()

# app.py and other modules
LANGUAGE_MAP = PLAYGROUND_REGISTRY['languages']
SAMPLE_CODE_DIR = PLAYGROUND_REGISTRY['sample_code_dir']
ALGORITHM_MAP = ALGORITHM_REGISTRY['categories']
SAMPLE_ALGORITHMS_DIR = ALGORITHM_REGISTRY['sample_algorithms_dir']


def _persist_algorithm_registry():
    _save_json_file(ALGORITHM_REGISTRY_FILE, ALGORITHM_REGISTRY)


def _normalize_category_key(category):
    category_lower = (category or '').lower()

    if category_lower in ALGORITHM_MAP:
        return category_lower

    for key, category_config in ALGORITHM_MAP.items():
        if category_config.get('display_name', '').lower() == category_lower:
            return key

    return category_lower


def add_algorithm_config(category, key, name, file, description, lang, explanation_file=None, await_console_input=False):
    category_key = _normalize_category_key(category)
    lang_key = (lang or '').lower()

    category_config = ALGORITHM_MAP.setdefault(
        category_key,
        {
            'display_name': str(category).title(),
            'algorithms': {}
        }
    )
    lang_map = category_config['algorithms'].setdefault(lang_key, {})

    lang_map[key] = {
        'file': file,
        'name': name,
        'description': description,
        'explanation_file': explanation_file,
        'await_console_input': await_console_input
    }

    ALGORITHM_REGISTRY['categories'] = ALGORITHM_MAP
    _persist_algorithm_registry()


def remove_algorithm_config(category, key):
    category_key = _normalize_category_key(category)

    category_config = ALGORITHM_MAP.get(category_key)
    if category_config and isinstance(category_config.get('algorithms'), dict):
        for lang_algorithms in category_config['algorithms'].values():
            if isinstance(lang_algorithms, dict):
                lang_algorithms.pop(key, None)

    ALGORITHM_REGISTRY['categories'] = ALGORITHM_MAP
    _persist_algorithm_registry()

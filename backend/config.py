# config.py

LANGUAGE_MAP = {
    'python': {
        'display_name': 'Python',
        'piston_name': 'python',
        'samples': {
            'helloworld': {
                'file': 'python/helloworld.py',
                'name': 'Hello World',
                'description': 'Basic print statement'
            },
            'fibonacci': {
                'file': 'python/fibonacci.py',
                'name': 'Fibonacci Sequence',
                'description': 'Calculate Fibonacci numbers'
            },
            'bubblesort': {
                'file': 'python/bubblesort.py',
                'name': 'Bubble Sort',
                'description': 'Sort an array using bubble sort'
            },
        }
    },
    'javascript': {
        'display_name': 'JavaScript',
        'piston_name': 'javascript',
        'samples': {
            'helloworld': {
                'file': 'javascript/bubblesort.js',
                'name': 'Bubble Sort',
                'description': 'Bubble sort in Javascript'
            },
            'async': {
                'file': 'javascript/fibonacci.js',
                'name': 'Fibonacci Sequence',
                'description': 'Calculate Fibonacci numbers'
            }
        }
    }
}

SAMPLE_CODE_DIR = 'C:\\Users\\dqvth\\Desktop\\vsc\\testingproject\\sample_code'
SAMPLE_ALGORITHMS_DIR = 'C:\\Users\\dqvth\\Desktop\\vsc\\testingproject\\sample_algorithms'

# Category-based algorithm organization
ALGORITHM_MAP = {
    'sorting': {
        'display_name': 'Sorting',
        'algorithms': {
            'python': [
                {
                    'key': 'bubblesort',
                    'file': 'Sorting/python/bbsort.py',
                    'name': 'Bubble Sort',
                    'description': 'Sort an array using bubble sort algorithm'
                }
            ],
            'javascript': [
                {
                    'key': 'bubblesort',
                    'file': 'Sorting/javascript/bbsort.js',
                    'name': 'Bubble Sort',
                    'description': 'Sort an array using bubble sort algorithm'
                }
            ]
        }
    },
    'graphs': {
        'display_name': 'Graphs',
        'algorithms': {
            'python': [
                {
                    'key': 'bfs',
                    'file': 'Graphs/python/bfs.py',
                    'name': 'Breadth-First Search',
                    'description': 'BFS traversal using adjacency matrix'
                },
                {
                    'key': 'dfs',
                    'file': 'Graphs/python/dfs.py',
                    'name': 'Depth-First Search',
                    'description': 'DFS traversal using adjacency matrix'
                }
            ],
            'javascript': [
                {
                    'key': 'bfs',
                    'file': 'Graphs/javascript/bfs.js',
                    'name': 'Breadth-First Search',
                    'description': 'BFS traversal using adjacency matrix'
                },
                {
                    'key': 'dfs',
                    'file': 'Graphs/javascript/dfs.js',
                    'name': 'Depth-First Search',
                    'description': 'DFS traversal using adjacency matrix'
                }
            ]
        }
    },
    'trees': {
        'display_name': 'Trees',
        'algorithms': {
            'python': [],
            'javascript': []
        }
    }
}
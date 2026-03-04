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
            'guessinggame': {
                'file': 'python/guessinggame.py',
                'name': 'Number Guessing Game',
                'description': 'Random numbers and input loops',
                'await_console_input': True
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
            },
            'guessinggame': {
                'file': 'javascript/guessinggame.js',
                'name': 'Number Guessing Game',
                'description': 'Random numbers and input loops',
                'await_console_input': True
            }
        }
    }
}

SAMPLE_CODE_DIR = 'C:\\Users\\dqvth\\Desktop\\vsc\\ThesisProject\\sample_code'
SAMPLE_ALGORITHMS_DIR = 'C:\\Users\\dqvth\\Desktop\\vsc\\ThesisProject\\sample_algorithms'

# Category-based algorithm organization
ALGORITHM_MAP = {
    'sorting': {
        'display_name': 'Sorting',
        'algorithms': {
            'python': [
                {
                    'key': 'bubblesort',
                    'file': 'Sorting/bubblesort/python/bbsort.py',
                    'name': 'Bubble Sort',
                    'description': 'Sort an array using bubble sort algorithm',
                    'explanation_file': 'Sorting/bubblesort/explanation.txt'
                },
                {
                    'key': 'selectionsort',
                    'file': 'Sorting/selectionsort/python/selectionsort.py',
                    'name': 'Selection Sort',
                    'description': 'Sort an array using selection sort algorithm',
                    'explanation_file': 'Sorting/selectionsort/explanation.txt'
                },
                {
                    'key': 'insertionsort',
                    'file': 'Sorting/insertionsort/python/insertionsort.py',
                    'name': 'Insertion Sort',
                    'description': 'Sort an array using insertion sort algorithm',
                    'explanation_file': 'Sorting/insertionsort/explanation.txt'
                },
                {
                    'key': 'quicksort',
                    'file': 'Sorting/quicksort/python/quicksort.py',
                    'name': 'Quick Sort',
                    'description': 'Sort an array using quick sort algorithm (divide-and-conquer)',
                    'explanation_file': 'Sorting/quicksort/explanation.txt'
                },
                {
                    'key': 'quicksort_hoare',
                    'file': 'Sorting/quicksort_hoare/python/quicksort_hoare.py',
                    'name': 'Quick Sort (Hoare Partition)',
                    'description': 'Quick sort using Hoare partition scheme - typically faster with fewer swaps',
                    'explanation_file': 'Sorting/quicksort_hoare/explanation.txt'
                }
            ],
            'javascript': [
                {
                    'key': 'bubblesort',
                    'file': 'Sorting/bubblesort/javascript/bbsort.js',
                    'name': 'Bubble Sort',
                    'description': 'Sort an array using bubble sort algorithm',
                    'explanation_file': 'Sorting/bubblesort/explanation.txt'
                },
                {
                    'key': 'selectionsort',
                    'file': 'Sorting/selectionsort/javascript/selectionsort.js',
                    'name': 'Selection Sort',
                    'description': 'Sort an array using selection sort algorithm',
                    'explanation_file': 'Sorting/selectionsort/explanation.txt'
                },
                {
                    'key': 'insertionsort',
                    'file': 'Sorting/insertionsort/javascript/insertionsort.js',
                    'name': 'Insertion Sort',
                    'description': 'Sort an array using insertion sort algorithm',
                    'explanation_file': 'Sorting/insertionsort/explanation.txt'
                },
                {
                    'key': 'quicksort',
                    'file': 'Sorting/quicksort/javascript/quicksort.js',
                    'name': 'Quick Sort',
                    'description': 'Sort an array using quick sort algorithm (divide-and-conquer)',
                    'explanation_file': 'Sorting/quicksort/explanation.txt'
                },
                {
                    'key': 'quicksort_hoare',
                    'file': 'Sorting/quicksort_hoare/javascript/quicksort_hoare.js',
                    'name': 'Quick Sort (Hoare Partition)',
                    'description': 'Quick sort using Hoare partition scheme - typically faster with fewer swaps',
                    'explanation_file': 'Sorting/quicksort_hoare/explanation.txt'
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
                    'file': 'Graphs/bfs/python/bfs.py',
                    'name': 'Breadth-First Search',
                    'description': 'BFS traversal using adjacency matrix',
                    'explanation_file': 'Graphs/bfs/explanation.txt'
                },
                {
                    'key': 'dfs',
                    'file': 'Graphs/dfs/python/dfs.py',
                    'name': 'Depth-First Search',
                    'description': 'DFS traversal using adjacency matrix',
                    'explanation_file': 'Graphs/dfs/explanation.txt'
                }
            ],
            'javascript': [
                {
                    'key': 'bfs',
                    'file': 'Graphs/bfs/javascript/bfs.js',
                    'name': 'Breadth-First Search',
                    'description': 'BFS traversal using adjacency matrix',
                    'explanation_file': 'Graphs/bfs/explanation.txt'
                },
                {
                    'key': 'dfs',
                    'file': 'Graphs/dfs/javascript/dfs.js',
                    'name': 'Depth-First Search',
                    'description': 'DFS traversal using adjacency matrix',
                    'explanation_file': 'Graphs/dfs/explanation.txt'
                }
            ]
        }
    },
    'trees': {
        'display_name': 'Trees',
        'algorithms': {
            'python': [
                {
                    'key': 'bst_inorder',
                    'file': 'Trees/bst_traversal/python/bst_inorder.py',
                    'name': 'BST In-Order Traversal',
                    'description': 'In-order traversal of a Binary Search Tree',
                    'explanation_file': 'Trees/bst_traversal/explanation.txt'
                }
            ],
            'javascript': [
                {
                    'key': 'bst_inorder',
                    'file': 'Trees/bst_traversal/javascript/bst_inorder.js',
                    'name': 'BST In-Order Traversal',
                    'description': 'In-order traversal of a Binary Search Tree',
                    'explanation_file': 'Trees/bst_traversal/explanation.txt'
                }
            ]
        }
    }
}
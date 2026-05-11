"""
Binary Search Tree Operations
Provides a unified interface for various BST operations including
traversals (inorder, preorder, postorder) and modifications (search, insert, delete).
"""

from runtime.tracer import Tracer
from helpers import (
    inorder_traversal,
    preorder_traversal,
    postorder_traversal,
    bst_search,
    bst_insert,
    bst_delete,
    run_targets,
    build_tree_only,
)

# [ALGORITHM]
def bst_operations(tree_nodes, root_id, operation, tracer, target=None):
    """
    Perform various Binary Search Tree operations.
    
    Args:
        tree_nodes: List of tree nodes [{"id": 1, "value": 10, "children": [left, right]}, ...]
        root_id: ID of the root node
        operation: Operation to perform:
            - 'build': Generate tree only (no traversal/modification)
            - 'inorder': In-order traversal (left -> root -> right)
            - 'preorder': Pre-order traversal (root -> left -> right)
            - 'postorder': Post-order traversal (left -> right -> root)
            - 'search': Search for a value in BST
            - 'insert': Find insertion point for a value
            - 'delete': Find node to delete
        tracer: Tracer instance
        target: Target value for search/insert/delete operations (optional)
    """
    
    operations = {
        'build': lambda: build_tree_only(tree_nodes, tracer),
        'inorder': lambda: inorder_traversal(tree_nodes, root_id, tracer),
        'preorder': lambda: preorder_traversal(tree_nodes, root_id, tracer),
        'postorder': lambda: postorder_traversal(tree_nodes, root_id, tracer),
        'search': lambda: run_targets(target, lambda x: bst_search(tree_nodes, root_id, x, tracer)),
        'insert': lambda: run_targets(target, lambda x: bst_insert(tree_nodes, root_id, x, tracer)),
        'delete': lambda: run_targets(target, lambda x, m: bst_delete(tree_nodes, root_id, x, tracer, mutate_in_place=m), mutate=True),
    }
    
    if operation not in operations:
        raise ValueError(f"Unknown operation: {operation}. Valid operations: {', '.join(operations.keys())}")
    
    return operations[operation]()


# [TEST]
if __name__ == "__main__":
    # [PARAMS]
    tree_nodes = [
        {"id": 1, "value": 10, "children": [2, 3]},
        {"id": 2, "value": 5, "children": [4, 5]},
        {"id": 3, "value": 15, "children": [6, 7]},
        {"id": 4, "value": 3, "children": []},
        {"id": 5, "value": 7, "children": []},
        {"id": 6, "value": 12, "children": []},
        {"id": 7, "value": 20, "children": []}
    ]
    root_id = 1
    operation = 'inorder'  # Options: 'build', 'inorder', 'preorder', 'postorder', 'search', 'insert', 'delete'
    target = 7             # For search/insert/delete operations
    # [/PARAMS]
    
    tracer = Tracer("trees", "list", "List")
    result = bst_operations(tree_nodes, root_id, operation, tracer, target)
    if isinstance(result, list):
        output = "\n".join(r.get("message") for r in result)
    else:
        output = result.get("message") if isinstance(result, dict) else None
        if not output:
            output = "Operation completed."

    print(output)
    tracer.finalize()

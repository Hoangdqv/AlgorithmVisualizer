"""
Binary Search Tree In-Order Traversal
This algorithm performs an in-order traversal of a Binary Search Tree,
visiting nodes in ascending order (left -> root -> right).
"""

import tracers.tracer as trc

# [ALGORITHM]
def inorder_traversal(tree_nodes, root_id, tracer):
    """
    Perform in-order traversal on a binary tree (left -> root -> right).
    
    Args:
        tree_nodes: List of tree nodes [{"id": 1, "value": 10, "children": [left, right]}, ...]
        root_id: ID of the root node
        tracer: TreeTracer instance
    """
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    
    def traverse(node_id):
        if node_id is None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        children = node.get('children', [])
        
        # Left subtree
        if len(children) > 0:
            left_child = children[0]
            tracer.add_tree_state(tree_nodes, visited=visited.copy(), current=left_child)
            traverse(left_child)
        
        # Current node
        visited.append(node_id)
        tracer.add_tree_state(tree_nodes, visited=visited.copy(), current=node_id)
        
        # Right subtree
        if len(children) > 1:
            right_child = children[1]
            tracer.add_tree_state(tree_nodes, visited=visited.copy(), current=right_child)
            traverse(right_child)
    
    # Initial and final states
    tracer.add_tree_state(tree_nodes, visited=[], current=root_id)
    traverse(root_id)
    tracer.add_tree_state(tree_nodes, visited=visited, current=None)


# Sample BST
#           10
#         /    \
#        5      15
#       / \    /  \
#      3   7  12   20

tree_nodes = [
    {"id": 1, "value": 10, "children": [2, 3]},
    {"id": 2, "value": 5, "children": [4, 5]},
    {"id": 3, "value": 15, "children": [6, 7]},
    {"id": 4, "value": 3, "children": []},
    {"id": 5, "value": 7, "children": []},
    {"id": 6, "value": 12, "children": []},
    {"id": 7, "value": 20, "children": []}
]

# [TEST]
if __name__ == "__main__":
    tracer = trc.TreeTracer(data_structure="BST", data_structure_label="Binary Search Tree")
    inorder_traversal(tree_nodes, root_id=1, tracer=tracer)
    tracer.finalize()

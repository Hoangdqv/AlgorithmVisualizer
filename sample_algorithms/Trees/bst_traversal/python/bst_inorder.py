"""
Binary Search Tree In-Order Traversal
This algorithm performs an in-order traversal of a Binary Search Tree,
visiting nodes in ascending order (left -> root -> right).
"""

from tracers.tracer import Tracer

# [ALGORITHM]
def inorder_traversal(tree_nodes, root_id, tracer):
    """
    Perform in-order traversal on a binary tree (left -> root -> right).
    
    Args:
        tree_nodes: List of tree nodes [{"id": 1, "value": 10, "children": [left, right]}, ...]
        root_id: ID of the root node
        tracer: Tracer instance
    """
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    
    def traverse(node_id, depth, path):
        if node_id is None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        current_path = path + [node_id]
        children = node.get('children', [])
        
        # Left subtree
        if len(children) > 0:
            left_child = children[0]
            tracer.add_state([],
                tree=tree_nodes, visited=visited.copy(), current=left_child,
                depth=depth + 1, path=current_path + [left_child])
            traverse(left_child, depth + 1, current_path)
        
        # Visit current node
        visited.append(node_id)
        tracer.add_state([],
            tree=tree_nodes, visited=visited.copy(), current=node_id,
            depth=depth, path=current_path)
        
        # Right subtree
        if len(children) > 1:
            right_child = children[1]
            tracer.add_state([],
                tree=tree_nodes, visited=visited.copy(), current=right_child,
                depth=depth + 1, path=current_path + [right_child])
            traverse(right_child, depth + 1, current_path)
    
    # Initial state
    tracer.add_state([],
        tree=tree_nodes, visited=[], current=root_id,
        depth=0, path=[root_id])
    
    traverse(root_id, 0, [])
    
    # Final state
    tracer.add_state([],
        tree=tree_nodes, visited=visited, current=None,
        depth=0, path=[])


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
    # [/PARAMS]
    tracer = Tracer(category='trees', data_structure='BST', data_structure_label='Binary Search Tree')
    inorder_traversal(tree_nodes, root_id=root_id, tracer=tracer)
    tracer.finalize()

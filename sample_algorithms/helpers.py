"""
Common Helper Functions for Algorithm Implementations

This module contains reusable utility functions that are frequently used
across multiple algorithms.
"""

def swap(arr, i, j):
    arr[i], arr[j] = arr[j], arr[i]


# ===== Binary Search Tree Operations  =====

def inorder_traversal(tree_nodes, root_id, tracer):
    """
    In-order traversal: left -> root -> right
    Visits nodes in ascending order for BST.
    """
    import copy
    
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    
    def traverse(node_id, depth):
        if node_id is None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        children = node.get('children', [])
        
        # Left subtree
        if len(children) > 0 and children[0] is not None:
            left_child = children[0]
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=left_child,
                depth=depth + 1)
            traverse(left_child, depth + 1)
        
        # Visit current node
        visited.append(node_id)
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=node_id,
            depth=depth)
        
        # Right subtree
        if len(children) > 1 and children[1] is not None:
            right_child = children[1]
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=right_child,
                depth=depth + 1)
            traverse(right_child, depth + 1)
    
    # Initial state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=[], current=root_id,
        depth=0)
    
    traverse(root_id, 0)
    
    # Final state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=visited, current=None,
        depth=0)


def preorder_traversal(tree_nodes, root_id, tracer):
    """
    Pre-order traversal: root -> left -> right
    Visits parent before children.
    """
    import copy
    
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    
    def traverse(node_id, depth):
        if node_id is None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        children = node.get('children', [])
        
        # Visit current node first
        visited.append(node_id)
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=node_id,
            depth=depth)
        
        # Left subtree
        if len(children) > 0 and children[0] is not None:
            left_child = children[0]
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=left_child,
                depth=depth + 1)
            traverse(left_child, depth + 1)
        
        # Right subtree
        if len(children) > 1 and children[1] is not None:
            right_child = children[1]
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=right_child,
                depth=depth + 1)
            traverse(right_child, depth + 1)
    
    # Initial state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=[], current=root_id,
        depth=0)

    traverse(root_id, 0)
    
    # Final state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=visited, current=None,
        depth=0)


def postorder_traversal(tree_nodes, root_id, tracer):
    """
    Post-order traversal: left -> right -> root
    Visits children before parent.
    """
    import copy
    
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    
    def traverse(node_id, depth):
        if node_id is None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        children = node.get('children', [])
        
        # Left subtree
        if len(children) > 0 and children[0] is not None:
            left_child = children[0]
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=left_child,
                depth=depth + 1)
            traverse(left_child, depth + 1)
        
        # Right subtree
        if len(children) > 1 and children[1] is not None:
            right_child = children[1]
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=right_child,
                depth=depth + 1)
            traverse(right_child, depth + 1)
        
        # Visit current node last
        visited.append(node_id)
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=node_id,
            depth=depth)
    
    # Initial state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=[], current=root_id,
        depth=0)

    traverse(root_id, 0)
    
    # Final state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=visited, current=None,
        depth=0)


def bst_search(tree_nodes, root_id, target, tracer):
    """
    Search for a target value in BST.
    Returns True if found, False otherwise.
    """
    import copy
    
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    found = False
    
    def search(node_id, depth):
        nonlocal found
        
        if node_id is None or found:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        visited.append(node_id)
        
        # Show current node being examined
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=node_id,
            depth=depth)
        
        # Found the target
        if node.get('value') == target:
            found = True
            return
        
        children = node.get('children', [])
        
        # Go left if target is smaller
        if target < node.get('value', float('inf')) and len(children) > 0:
            left_child = children[0]
            search(left_child, depth + 1)
        # Go right if target is larger
        elif target > node.get('value', float('-inf')) and len(children) > 1:
            right_child = children[1]
            search(right_child, depth + 1)
    
    # Start search (no initial duplicate state)
    search(root_id, 0)
    
    # Final state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=visited, current=None,
        depth=0)
    
    return found


def bst_insert(tree_nodes, root_id, value, tracer, visited=None):
    """
    Insert a new value into BST and update the tree structure.
    Returns tuple of (new_node_id, visited_list).
    """
    import copy
    
    # Modify tree in-place to support multiple insertions
    node_map = {node['id']: node for node in tree_nodes}
    visited = visited if visited is not None else []
    new_node_id = max(node['id'] for node in tree_nodes) + 1
    parent_id = None
    insert_position = None  # 'left' or 'right'
    
    def find_insertion_point(node_id, depth):
        nonlocal parent_id, insert_position
        
        if node_id is None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        visited.append(node_id)
        
        # Show current node being examined
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=node_id,
            depth=depth)
        
        children = node.get('children', [])
        
        # Go left if value is smaller
        if value < node.get('value', float('inf')):
            if len(children) > 0 and children[0] is not None:
                left_child = children[0]
                find_insertion_point(left_child, depth + 1)
            else:
                # Insert as left child here
                parent_id = node_id
                insert_position = 'left'
        # Go right if value is larger
        elif value > node.get('value', float('-inf')):
            if len(children) > 1 and children[1] is not None:
                right_child = children[1]
                find_insertion_point(right_child, depth + 1)
            else:
                # Insert as right child here
                parent_id = node_id
                insert_position = 'right'
    
    # Find where to insert
    find_insertion_point(root_id, 0)
    
    # Insert
    if parent_id is not None:
        # Create new node
        new_node = {"id": new_node_id, "value": value, "children": []}
        tree_nodes.append(new_node)
        # Assign id to node
        node_map[new_node_id] = new_node
        
        # Update parent's children
        parent = node_map[parent_id]
        if insert_position == 'left':
            if len(parent['children']) == 0:
                # init
                parent['children'] = [new_node_id]
            else:
                # replace (existing) left child or add if only right child exists
                parent['children'][0] = new_node_id
        else:   # right
            if len(parent['children']) == 0:
                # init
                parent['children'] = [None, new_node_id]
            elif len(parent['children']) == 1:
                #  add if only left child exists
                parent['children'].append(new_node_id)
            else:
                # replace right child
                parent['children'][1] = new_node_id
        
        visited.append(new_node_id)
        
        # Show the tree with the new node inserted
        parent_value = parent.get('value')
        position_text = 'left' if insert_position == 'left' else 'right'
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=new_node_id,
            depth=0,
            message=f"Inserted {value} as {position_text} child of {parent_value}")
    
    # Final state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=[], current=None,
        depth=0)
    
    return (new_node_id if parent_id else None, visited)


def bst_delete(tree_nodes, root_id, target, tracer):
    """
    Delete a node from BST and update the tree structure.
    Handles three cases: leaf node, one child, two children.
    """
    import copy
    
    # Work with a deep copy
    tree_nodes = copy.deepcopy(tree_nodes)
    node_map = {node['id']: node for node in tree_nodes}
    visited = []
    found_node = None
    parent_id = None
    node_depth = 0  # Track the depth of the node to be deleted
    
    def find_delete_node(node_id, parent, depth):
        nonlocal found_node, parent_id, node_depth
        
        if node_id is None or found_node is not None:
            return
        
        node = node_map.get(node_id)
        if not node:
            return
        
        visited.append(node_id)
        
        # Show current node being examined
        tracer.add_state([],
            tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=node_id,
            depth=depth)
        
        # Found the target
        if node.get('value') == target:
            found_node = node_id
            parent_id = parent
            node_depth = depth  # Store the depth of found node
            return
        
        children = node.get('children', [])
        
        # Go left if target is smaller
        if target < node.get('value', float('inf')) and len(children) > 0:
            left_child = children[0]
            find_delete_node(left_child, node_id, depth + 1)
        # Go right if target is larger
        elif target > node.get('value', float('-inf')) and len(children) > 1:
            right_child = children[1]
            find_delete_node(right_child, node_id, depth + 1)
    
    # Find the node to delete
    find_delete_node(root_id, None, 0)
    
    # delete if found
    if found_node is not None:
        node_to_delete = node_map[found_node]
        children = node_to_delete.get('children', [])
        
        # Case 1: Leaf node (no children)
        if len(children) == 0 or (len(children) > 0 and all(c is None for c in children)):
            # Show state before deletion
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=found_node,
                depth=node_depth,
                message=f"Deleting leaf node {node_to_delete.get('value')}")
            
            if parent_id is not None:
                # Get parent and its children through the respective parent_id
                parent = node_map[parent_id]
                parent_children = parent.get('children', [])
                # Remove from parent's children
                parent['children'] = [c if c != found_node else None for c in parent_children]
            tree_nodes = [n for n in tree_nodes if n['id'] != found_node]
        
        # Case 2: One child
        elif (len(children) == 1 and children[0] is not None) or \
             (len(children) == 2 and (children[0] is None) != (children[1] is None)):
            child_id = children[0] if (len(children) == 1 or children[0] is not None) else children[1]
            
            # Show state before deletion
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=found_node,
                depth=node_depth,
                message=f"Replacing node {node_to_delete.get('value')} with its child")
            
            if parent_id is not None:
                parent = node_map[parent_id]
                parent_children = parent.get('children', [])
                # Replace deleted node with its child
                parent['children'] = [child_id if c == found_node else c for c in parent_children]
            else:
                # Deleting root with one child - child becomes new root
                root_id = child_id
            
            tree_nodes = [n for n in tree_nodes if n['id'] != found_node]
        
        # Case 3: Two children - find inorder successor (leftmost node in right subtree)
        elif len(children) == 2 and children[0] is not None and children[1] is not None:
            # Show initial state
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=found_node,
                depth=node_depth,
                message=f"Node {node_to_delete.get('value')} has two children, finding successor...")
            
            # Find inorder successor (minimum in right subtree)
            successor_id = children[1]
            successor_parent_id = found_node
            successor_depth_count = 1
            
            # Show traversal to find successor
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=successor_id,
                depth=node_depth + 1,
                message="Looking for successor (minimum in right subtree)")
            
            while True:
                successor_node = node_map[successor_id]
                successor_children = successor_node.get('children', [])
                if len(successor_children) > 0 and successor_children[0] is not None:
                    successor_parent_id = successor_id
                    successor_id = successor_children[0]
                    successor_depth_count += 1
                    
                    # Show each step in finding successor
                    successor_depth = node_depth + successor_depth_count
                    tracer.add_state([],
                        tree=copy.deepcopy(tree_nodes), visited=visited.copy(), current=successor_id,
                        depth=successor_depth,
                        message="Going left to find minimum")
                else:
                    break
            
            # Highlight the successor found
            successor_value = node_map[successor_id].get('value')
            successor_depth = node_depth + successor_depth_count
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy() + [successor_id], current=successor_id,
                depth=successor_depth,
                message=f"Found successor: {successor_value}")
            
            # Show the swap
            original_value = node_to_delete.get('value')
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy() + [successor_id, found_node], current=found_node,
                depth=node_depth,
                message=f"Swapping value {original_value} with successor value {successor_value}")
            
            # Replace node's value with successor's value
            node_to_delete['value'] = successor_value
            
            # Delete successor (which has at most one right child)
            successor_parent = node_map[successor_parent_id]
            successor_right_child = node_map[successor_id].get('children', [None, None])[1] if len(node_map[successor_id].get('children', [])) > 1 else None
            
            if successor_parent_id == found_node:
                # Successor is direct right child
                successor_parent['children'][1] = successor_right_child
            else:
                # Successor is deeper in tree
                successor_parent['children'][0] = successor_right_child
            
            tree_nodes = [n for n in tree_nodes if n['id'] != successor_id]
            
            # Show state after value replacement and successor removal
            tracer.add_state([],
                tree=copy.deepcopy(tree_nodes), visited=visited.copy() + [successor_id, found_node], current=found_node,
                depth=node_depth,
                message=f"Replaced with successor value {successor_value} and removed old successor node")

    
    # Final state
    tracer.add_state([],
        tree=copy.deepcopy(tree_nodes), visited=visited, current=None,
        depth=0)
    
    return found_node

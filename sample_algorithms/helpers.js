/**
 * Common Helper Functions for Algorithm Implementations
 * 
 * This module contains reusable utility functions that are frequently used
 * across multiple algorithms.
 */

export function swap(arr, i, j) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
}


export function normalizeTargets(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}


export function runTargets(target, fn, mutate = false) {
    const targets = normalizeTargets(target);
    if (targets.length > 1) {
        if (mutate) {
            return targets.map((x) => fn(x, true));
        }
        return targets.map((x) => fn(x));
    }

    const singleTarget = targets.length > 0 ? targets[0] : null;
    if (mutate) {
        return fn(singleTarget, false);
    }
    return fn(singleTarget);
}


export function buildTreeOnly(treeNodes, tracer) {
    const snapshot = JSON.parse(JSON.stringify(treeNodes));
    tracer.add_state([], {
        tree: snapshot,
        visited: [],
        current: null,
        depth: 0,
    });
    return {
        operation: 'build',
        message: `Tree generated with ${treeNodes.length} node(s)`
    };
}


// ===== Binary Search Tree Operations =====

export function inorderTraversal(treeNodes, rootId, tracer) {
    /**
     * In-order traversal: left -> root -> right
     * Visits nodes in ascending order for BST.
     */
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    
    function traverse(nodeId, depth) {
        if (nodeId === null || nodeId === undefined) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        const children = node.children || [];
        
        // Left subtree
        if (children.length > 0 && children[0] !== null && children[0] !== undefined) {
            const leftChild = children[0];
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: leftChild,
                depth: depth + 1
            });
            traverse(leftChild, depth + 1);
        }
        
        // Visit current node
        visited.push(nodeId);
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: nodeId,
            depth
        });
        
        // Right subtree
        if (children.length > 1 && children[1] !== null && children[1] !== undefined) {
            const rightChild = children[1];
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: rightChild,
                depth: depth + 1
            });
            traverse(rightChild, depth + 1);
        }
    }
    
    // Initial state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: [], current: rootId,
        depth: 0
    });
    
    traverse(rootId, 0);
    
    // Final state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: visited, current: null,
        depth: 0
    });

    return {
        operation: 'inorder',
        message: 'Completed in-order traversal'
    }
}


export function preorderTraversal(treeNodes, rootId, tracer) {
    /**
     * Pre-order traversal: root -> left -> right
     * Visits parent before children.
     */
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    
    function traverse(nodeId, depth) {
        if (nodeId === null || nodeId === undefined) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        const children = node.children || [];
        
        // Visit current node first
        visited.push(nodeId);
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: nodeId,
            depth
        });
        
        // Left subtree
        if (children.length > 0 && children[0] !== null && children[0] !== undefined) {
            const leftChild = children[0];
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: leftChild,
                depth: depth + 1
            });
            traverse(leftChild, depth + 1);
        }
        
        // Right subtree
        if (children.length > 1 && children[1] !== null && children[1] !== undefined) {
            const rightChild = children[1];
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: rightChild,
                depth: depth + 1
            });
            traverse(rightChild, depth + 1);
        }
    }
    
    // Initial state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: [], current: rootId,
        depth: 0
    });

    traverse(rootId, 0);
    
    // Final state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: visited, current: null,
        depth: 0
    });

    return {
        operation: 'preorder',
        message: 'Completed pre-order traversal'
    }
}


export function postorderTraversal(treeNodes, rootId, tracer) {
    /**
     * Post-order traversal: left -> right -> root
     * Visits children before parent.
     */
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    
    function traverse(nodeId, depth) {
        if (nodeId === null || nodeId === undefined) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        const children = node.children || [];
        
        // Left subtree
        if (children.length > 0 && children[0] !== null && children[0] !== undefined) {
            const leftChild = children[0];
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: leftChild,
                depth: depth + 1
            });
            traverse(leftChild, depth + 1);
        }
        
        // Right subtree
        if (children.length > 1 && children[1] !== null && children[1] !== undefined) {
            const rightChild = children[1];
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: rightChild,
                depth: depth + 1
            });
            traverse(rightChild, depth + 1);
        }
        
        // Visit current node last
        visited.push(nodeId);
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: nodeId,
            depth
        });
    }
    
    // Initial state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: [], current: rootId,
        depth: 0
    });

    traverse(rootId, 0);
    
    // Final state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: visited, current: null,
        depth: 0
    });

    return {
        operation: 'postorder',
        message: 'Completed post-order traversal'
    };
}


export function bstSearch(treeNodes, rootId, target, tracer) {
    /**
     * Search for a target value in BST.
    * Returns a structured result containing found state and summary message.
     */
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    let found = false;
    
    function search(nodeId, depth) {
        if (nodeId === null || nodeId === undefined || found) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        visited.push(nodeId);
        
        // Show current node being examined
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: nodeId,
            depth
        });
        
        // Found the target
        if (node.value === target) {
            found = true;
            return;
        }
        
        const children = node.children || [];
        
        // Go left if target is smaller
        if (target < (node.value ?? Infinity) && children.length > 0) {
            const leftChild = children[0];
            search(leftChild, depth + 1);
        }
        // Go right if target is larger
        else if (target > (node.value ?? -Infinity) && children.length > 1) {
            const rightChild = children[1];
            search(rightChild, depth + 1);
        }
    }
    
    // Start search (no initial duplicate state)
    search(rootId, 0);
    
    // Final state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: visited, current: null,
        depth: 0
    });
    
    return {
        operation: 'search',
        value: target,
        found,
        message: found
            ? `Found node with value ${target}`
            : `Cannot find node with value ${target}`,
    };
}


export function bstInsert(treeNodes, rootId, value, tracer, visited = null) {
    /**
     * Insert a new value into BST and update the tree structure.
    * Returns a structured result containing inserted node and summary message.
     */
    // Modify tree in-place to support multiple insertions
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    visited = visited !== null ? visited : [];
    const newNodeId = Math.max(...treeNodes.map(n => n.id)) + 1;
    let parentId = null;
    let insertPosition = null; // 'left' or 'right'
    
    function findInsertionPoint(nodeId, depth) {
        if (nodeId === null || nodeId === undefined) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        visited.push(nodeId);
        
        // Show current node being examined
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: nodeId,
            depth
        });
        
        const children = node.children || [];
        
        // Go left if value is smaller
        if (value < (node.value ?? Infinity)) {
            if (children.length > 0 && children[0] !== null && children[0] !== undefined) {
                const leftChild = children[0];
                findInsertionPoint(leftChild, depth + 1);
            } else {
                // Insert as left child here
                parentId = nodeId;
                insertPosition = 'left';
            }
        }
        // Go right if value is larger
        else if (value > (node.value ?? -Infinity)) {
            if (children.length > 1 && children[1] !== null && children[1] !== undefined) {
                const rightChild = children[1];
                findInsertionPoint(rightChild, depth + 1);
            } else {
                // Insert as right child here
                parentId = nodeId;
                insertPosition = 'right';
            }
        }
    }
    
    // Find where to insert
    findInsertionPoint(rootId, 0);
    
    // Actually insert the new node
    if (parentId !== null) {
        // Create new node
        const newNode = { id: newNodeId, value: value, children: [] };
        treeNodes.push(newNode);
        nodeMap[newNodeId] = newNode;
        
        // Update parent's children
        const parent = nodeMap[parentId];
        if (insertPosition === 'left') {
            if (parent.children.length === 0) {
                parent.children = [newNodeId];
            } else {
                parent.children[0] = newNodeId;
            }
        } else { // right
            if (parent.children.length === 0) {
                parent.children = [null, newNodeId];
            } else if (parent.children.length === 1) {
                parent.children.push(newNodeId);
            } else {
                parent.children[1] = newNodeId;
            }
        }
        
        visited.push(newNodeId);
        
        // Show the tree with the new node inserted
        const parentValue = parent.value;
        const positionText = insertPosition === 'left' ? 'left' : 'right';
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: newNodeId,
            depth: 0,
            message: `Inserted ${value} as ${positionText} child of ${parentValue}`
        });
    }
    
    // Final state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: [], current: null,
        depth: 0
    });
    
    const insertedNodeId = parentId ? newNodeId : null;
    return {
        operation: 'insert',
        value,
        insertedNodeId,
        visited,
        message: insertedNodeId
            ? `Inserted node with value ${value}`
            : `Cannot insert node with value ${value}`,
    };
}


export function bstDelete(treeNodes, rootId, target, tracer, mutateInPlace = false) {
    /**
     * Delete a node from BST and update the tree structure.
     * Handles three cases: leaf node, one child, two children.
     */
    // Work with a deep copy
    const originalTreeNodes = treeNodes;
    treeNodes = JSON.parse(JSON.stringify(treeNodes));
    
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    let foundNode = null;
    let parentId = null;
    let nodeDepth = 0;  // Track the depth of the node to be deleted
    
    function findDeleteNode(nodeId, parent, depth) {
        if (nodeId === null || nodeId === undefined || foundNode !== null) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        visited.push(nodeId);
        
        // Show current node being examined
        tracer.add_state([], {
            tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: nodeId,
            depth
        });
        
        // Found the target
        if (node.value === target) {
            foundNode = nodeId;
            parentId = parent;
            nodeDepth = depth;  // Store the depth of found node
            return;
        }
        
        const children = node.children || [];
        
        // Go left if target is smaller
        if (target < (node.value ?? Infinity) && children.length > 0) {
            const leftChild = children[0];
            findDeleteNode(leftChild, nodeId, depth + 1);
        }
        // Go right if target is larger
        else if (target > (node.value ?? -Infinity) && children.length > 1) {
            const rightChild = children[1];
            findDeleteNode(rightChild, nodeId, depth + 1);
        }
    }
    
    // Find the node to delete
    findDeleteNode(rootId, null, 0);
    
    // Actually delete the node if found
    if (foundNode !== null) {
        const nodeToDelete = nodeMap[foundNode];
        const children = nodeToDelete.children || [];
        
        // Case 1: Leaf node (no children)
        if (children.length === 0 || children.every(c => c === null || c === undefined)) {
            // Show state before deletion
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: foundNode,
                depth: nodeDepth,
                message: `Deleting leaf node ${nodeToDelete.value}`
            });
            
            if (parentId !== null) {
                const parent = nodeMap[parentId];
                const parentChildren = parent.children || [];
                // Remove from parent's children
                parent.children = parentChildren.map(c => c === foundNode ? null : c);
            }
            treeNodes = treeNodes.filter(n => n.id !== foundNode);
        }
        // Case 2: One child
        else if ((children.length === 1 && children[0] !== null) ||
                 (children.length === 2 && ((children[0] === null) !== (children[1] === null)))) {
            const childId = (children.length === 1 || children[0] !== null) ? children[0] : children[1];
            
            // Show state before deletion
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: foundNode,
                depth: nodeDepth,
                message: `Replacing node ${nodeToDelete.value} with its child`
            });
            
            if (parentId !== null) {
                const parent = nodeMap[parentId];
                const parentChildren = parent.children || [];
                // Replace deleted node with its child
                parent.children = parentChildren.map(c => c === foundNode ? childId : c);
            } else {
                // Deleting root with one child - child becomes new root
                rootId = childId;
            }
            
            treeNodes = treeNodes.filter(n => n.id !== foundNode);
        }
        // Case 3: Two children - find inorder successor (leftmost node in right subtree)
        else if (children.length === 2 && children[0] !== null && children[1] !== null) {
            // Show initial state
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: foundNode,
                depth: nodeDepth,
                message: `Node ${nodeToDelete.value} has two children, finding successor...`
            });
            
            // Find inorder successor (minimum in right subtree)
            let successorId = children[1];
            let successorParentId = foundNode;
            let successorDepthCount = 1;
            
            // Show traversal to find successor
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: successorId,
                depth: nodeDepth + 1,
                message: "Looking for successor (minimum in right subtree)"
            });
            
            while (true) {
                const successorNode = nodeMap[successorId];
                const successorChildren = successorNode.children || [];
                if (successorChildren.length > 0 && successorChildren[0] !== null) {
                    successorParentId = successorId;
                    successorId = successorChildren[0];
                    successorDepthCount++;
                    
                    // Show each step in finding successor
                    const successorDepth = nodeDepth + successorDepthCount;
                    tracer.add_state([], {
                        tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited], current: successorId,
                        depth: successorDepth,
                        message: "Going left to find minimum"
                    });
                } else {
                    break;
                }
            }
            
            // Highlight the successor found
            const successorValue = nodeMap[successorId].value;
            const successorDepth = nodeDepth + successorDepthCount;
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited, successorId], current: successorId,
                depth: successorDepth,
                message: `Found successor: ${successorValue}`
            });
            
            // Show the swap about to happen
            const originalValue = nodeToDelete.value;
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited, successorId, foundNode], current: foundNode,
                depth: nodeDepth,
                message: `Swapping value ${originalValue} with successor value ${successorValue}`
            });
            
            // Replace node's value with successor's value
            nodeToDelete.value = successorValue;
            
            // Delete successor (which has at most one right child)
            const successorParent = nodeMap[successorParentId];
            const successorRightChild = (nodeMap[successorId].children || [])[1] || null;
            
            if (successorParentId === foundNode) {
                // Successor is direct right child
                successorParent.children[1] = successorRightChild;
            } else {
                // Successor is deeper in tree
                successorParent.children[0] = successorRightChild;
            }
            
            treeNodes = treeNodes.filter(n => n.id !== successorId);
            
            // Show state after value replacement and successor removal
            tracer.add_state([], {
                tree: JSON.parse(JSON.stringify(treeNodes)), visited: [...visited, successorId, foundNode], current: foundNode,
                depth: nodeDepth,
                message: `Replaced with successor value ${successorValue} and removed old successor node`
            });
        }
    }
    
    // Final state
    tracer.add_state([], {
        tree: JSON.parse(JSON.stringify(treeNodes)), visited: visited, current: null,
        depth: 0
    });
    
    if (mutateInPlace) {
        originalTreeNodes.splice(0, originalTreeNodes.length, ...treeNodes);
    }

    return {
        operation: 'delete',
        value: target,
        deletedNodeId: foundNode,
        message: foundNode !== null
            ? `Deleted node with value ${target}`
            : `Cannot find node with value ${target} to delete`,
    };
}

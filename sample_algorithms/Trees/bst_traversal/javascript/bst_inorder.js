/**
 * Binary Search Tree In-Order Traversal
 * This algorithm performs an in-order traversal of a Binary Search Tree,
 * visiting nodes in ascending order (left -> root -> right).
 */

import Tracer from './tracers/tracer.js';

// [ALGORITHM]
function inorderTraversal(treeNodes, rootId, tracer) {
    /**
     * Perform in-order traversal on a binary tree (left -> root -> right).
     * 
     * @param {Array} treeNodes - List of tree nodes [{id: 1, value: 10, children: [left, right]}, ...]
     * @param {number} rootId - ID of the root node
     * @param {Tracer} tracer - Tracer instance
     */
    
    // Build node map for quick lookup
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    
    function traverse(nodeId, depth, path) {
        if (nodeId === null || nodeId === undefined) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        const currentPath = [...path, nodeId];
        const children = node.children || [];
        
        // Left subtree
        if (children.length > 0) {
            const leftChild = children[0];
            tracer.addState([], {
                tree: treeNodes, visited: [...visited], current: leftChild,
                depth: depth + 1, path: [...currentPath, leftChild]
            });
            traverse(leftChild, depth + 1, currentPath);
        }
        
        // Visit current node
        visited.push(nodeId);
        tracer.addState([], {
            tree: treeNodes, visited: [...visited], current: nodeId,
            depth, path: currentPath
        });
        
        // Right subtree
        if (children.length > 1) {
            const rightChild = children[1];
            tracer.addState([], {
                tree: treeNodes, visited: [...visited], current: rightChild,
                depth: depth + 1, path: [...currentPath, rightChild]
            });
            traverse(rightChild, depth + 1, currentPath);
        }
    }
    
    // Initial state
    tracer.addState([], {
        tree: treeNodes, visited: [], current: rootId,
        depth: 0, path: [rootId]
    });
    
    // Start traversal
    traverse(rootId, 0, []);
    
    // Final state
    tracer.addState([], {
        tree: treeNodes, visited: visited, current: null,
        depth: 0, path: []
    });
}

// [TEST]
// [PARAMS]
const treeNodes = [
    { id: 1, value: 10, children: [2, 3] },
    { id: 2, value: 5, children: [4, 5] },
    { id: 3, value: 15, children: [6, 7] },
    { id: 4, value: 3, children: [] },
    { id: 5, value: 7, children: [] },
    { id: 6, value: 12, children: [] },
    { id: 7, value: 20, children: [] }
];
const rootId = 1;
// [/PARAMS]
const tracer = new Tracer('trees', 'BST', 'Binary Search Tree');

inorderTraversal(treeNodes, rootId, tracer);

tracer.finalize();

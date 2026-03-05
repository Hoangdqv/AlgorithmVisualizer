/**
 * Binary Search Tree Operations
 * Provides a unified interface for various BST operations including
 * traversals (inorder, preorder, postorder) and modifications (search, insert, delete).
 */

import Tracer from './tracers/tracer.js';
import {
    inorderTraversal,
    preorderTraversal,
    postorderTraversal,
    bstSearch,
    bstInsert,
    bstDelete
} from '../../../helpers.js';

// [ALGORITHM]
function bstOperations(treeNodes, rootId, operation, tracer, target = null) {
    /**
     * Perform various Binary Search Tree operations.
     * 
     * @param {Array} treeNodes - List of tree nodes [{id: 1, value: 10, children: [left, right]}, ...]
     * @param {number} rootId - ID of the root node
     * @param {string} operation - Operation to perform:
     *   - 'inorder': In-order traversal (left -> root -> right)
     *   - 'preorder': Pre-order traversal (root -> left -> right)
     *   - 'postorder': Post-order traversal (left -> right -> root)
     *   - 'search': Search for a value in BST
     *   - 'insert': Find insertion point for a value
     *   - 'delete': Find node to delete
     * @param {Tracer} tracer - Tracer instance
     * @param {number} target - Target value for search/insert/delete operations (optional)
     * @returns {*} Depends on operation:
     *   - Traversals: undefined (states recorded in tracer)
     *   - search: boolean (found or not)
     *   - insert: Array of node IDs in insertion path
     *   - delete: Node ID if found, null otherwise
     */
    const operations = {
        'inorder': () => inorderTraversal(treeNodes, rootId, tracer),
        'preorder': () => preorderTraversal(treeNodes, rootId, tracer),
        'postorder': () => postorderTraversal(treeNodes, rootId, tracer),
        'search': () => bstSearch(treeNodes, rootId, target, tracer),
        'insert': () => bstInsert(treeNodes, rootId, target, tracer),
        'delete': () => bstDelete(treeNodes, rootId, target, tracer),
    };
    
    if (!(operation in operations)) {
        throw new Error(`Unknown operation: ${operation}. Valid operations: ${Object.keys(operations).join(', ')}`);
    }
    
    return operations[operation]();
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
const operation = 'inorder'; // Options: 'inorder', 'preorder', 'postorder', 'search', 'insert', 'delete'
const target = 7;            // For search/insert/delete operations
// [/PARAMS]

const tracer = new Tracer('trees', 'BST', 'Binary Search Tree');
const result = bstOperations(treeNodes, rootId, operation, tracer, target);

if (operation === 'search') {
    console.log(`Search for ${target}: ${result ? 'Found' : 'Not found'}`);
} else if (operation === 'insert') {
    console.log(`Insertion path for ${target}: [${result.join(', ')}]`);
} else if (operation === 'delete') {
    console.log(`Node to delete (value=${target}): ${result}`);
}

tracer.finalize();

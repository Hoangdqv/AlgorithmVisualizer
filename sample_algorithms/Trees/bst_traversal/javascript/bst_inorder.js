/**
 * Binary Search Tree In-Order Traversal
 * This algorithm performs an in-order traversal of a Binary Search Tree,
 * visiting nodes in ascending order (left -> root -> right).
 */

const { TreeTracer } = require('./tracers/tracer');

// [ALGORITHM]
function inorderTraversal(treeNodes, rootId, tracer) {
    /**
     * Perform in-order traversal on a binary tree (left -> root -> right).
     * 
     * @param {Array} treeNodes - List of tree nodes [{id: 1, value: 10, children: [left, right]}, ...]
     * @param {number} rootId - ID of the root node
     * @param {TreeTracer} tracer - TreeTracer instance
     */
    
    // Build node map for quick lookup
    const nodeMap = {};
    treeNodes.forEach(node => {
        nodeMap[node.id] = node;
    });
    
    const visited = [];
    
    function traverse(nodeId) {
        if (nodeId === null || nodeId === undefined) {
            return;
        }
        
        const node = nodeMap[nodeId];
        if (!node) {
            return;
        }
        
        const children = node.children || [];
        
        // Left subtree
        if (children.length > 0) {
            const leftChild = children[0];
            tracer.addTreeState(treeNodes, [...visited], leftChild);
            traverse(leftChild);
        }
        
        // Current node
        visited.push(nodeId);
        tracer.addTreeState(treeNodes, [...visited], nodeId);
        
        // Right subtree
        if (children.length > 1) {
            const rightChild = children[1];
            tracer.addTreeState(treeNodes, [...visited], rightChild);
            traverse(rightChild);
        }
    }
    
    // Initial state
    tracer.addTreeState(treeNodes, [], rootId);
    
    // Start traversal
    traverse(rootId);
    
    // Final state
    tracer.addTreeState(treeNodes, visited, null);
}

// Sample BST
//           10
//         /    \
//        5      15
//       / \    /  \
//      3   7  12   20

const treeNodes = [
    { id: 1, value: 10, children: [2, 3] },
    { id: 2, value: 5, children: [4, 5] },
    { id: 3, value: 15, children: [6, 7] },
    { id: 4, value: 3, children: [] },
    { id: 5, value: 7, children: [] },
    { id: 6, value: 12, children: [] },
    { id: 7, value: 20, children: [] }
];

// [TEST]
if (require.main === module) {
    // Create tracer
    const tracer = new TreeTracer("BST", "Binary Search Tree");

    // Run the algorithm
    inorderTraversal(treeNodes, 1, tracer);

    // Output the tracer data
    tracer.finalize();
}

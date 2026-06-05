import Tracer from './runtime/tracer.js';

function dfs(graph, startNode, tracer) {
    /**
     * Depth-First Search traversal on a graph represented as adjacency matrix.
     * 
     * @param {number[][]} graph - 2D array (adjacency matrix) where graph[i][j] = 1 means edge from i to j
     * @param {number} startNode - The starting node index for DFS
     * @param {Tracer} tracer - Tracer object to record states
     * @returns {Object} - Object containing visited order and tracer
     */
    const n = graph.length;
    const visited = new Array(n).fill(false);
    const stack = [startNode];
    const visitedOrder = [];
    
    // Initial state - show graph with start node in stack
    tracer.add_state([], {
        graph: graph,
        visited: [...visited],
        stack: [...stack]
    });
    
    while (stack.length > 0) {
        const current = stack.pop();
        
        if (visited[current]) {
            continue;
        }
        
        visited[current] = true;
        visitedOrder.push(current);
        
        // Show current node being processed
        tracer.add_state([], {
            graph: graph,
            visited: [...visited],
            stack: [...stack],
            processing: current
        });
        
        // Explore neighbors
        for (let neighbor = n - 1; neighbor >= 0; neighbor--) {
            if (graph[current][neighbor] === 1 && !visited[neighbor]) {
                stack.push(neighbor);
                
                // Show neighbor being discovered
                tracer.add_state([], {
                    graph: graph,
                    visited: [...visited],
                    stack: [...stack],
                    processing: current,
                    discovered: neighbor
                });
            }
        }
    }
    
    // Final state
    tracer.add_state([], {
        graph: graph,
        visited: [...visited],
        stack: [],
        completed: true
    });
    
    return { visitedOrder, tracer };
}

// [PARAMS]
const adjacencyMatrix = [
    [0, 1, 1, 0, 0, 0],
    [1, 0, 0, 1, 1, 0],
    [1, 0, 0, 0, 1, 0],
    [0, 1, 0, 0, 0, 1],
    [0, 1, 1, 0, 0, 1],
    [0, 0, 0, 1, 1, 0]
];
const start = 0;
// [/PARAMS]
const tracer = new Tracer('graphs', 'stack', 'Stack');
const { visitedOrder } = dfs(adjacencyMatrix, start, tracer);

console.log(`DFS Traversal starting from node ${start}:`);
console.log(`Visit order: ${visitedOrder}`);
console.log('Graph structure (adjacency matrix):');
adjacencyMatrix.forEach((row, i) => {
    console.log(`  Node ${i}: [${row.join(', ')}]`);
});

// Output tracer data for visualization
tracer.finalize();

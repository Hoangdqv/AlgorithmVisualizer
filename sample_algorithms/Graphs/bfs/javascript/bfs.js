import Tracer from './runtime/tracer.js';

// [ALGORITHM]
function bfs(graph, startNode, tracer) {
    /**
     * Breadth-First Search traversal on a graph represented as adjacency matrix.
     * 
     * @param {number[][]} graph - 2D array (adjacency matrix) where graph[i][j] = 1 means edge from i to j
     * @param {number} startNode - The starting node index for BFS
     * @param {Tracer} tracer - Tracer object to record states
     * @returns {Object} - Object containing visited order and tracer
     */
    const n = graph.length;
    const visited = new Array(n).fill(false);
    const queue = [startNode];
    visited[startNode] = true;
    const visitedOrder = [];
    
    // Initial state - show graph with start node
    tracer.add_state([], {
        graph: graph,
        visited: [...visited],
        queue: [...queue]
    });
    
    while (queue.length > 0) {
        const current = queue.shift();
        visitedOrder.push(current);
        
        // Show current node being processed
        tracer.add_state([], {
            graph: graph,
            visited: [...visited],
            queue: [...queue],
            processing: current
        });
        
        // Explore neighbors
        for (let neighbor = 0; neighbor < n; neighbor++) {
            if (graph[current][neighbor] === 1 && !visited[neighbor]) {
                visited[neighbor] = true;
                queue.push(neighbor);
                
                // Show neighbor being discovered
                tracer.add_state([], {
                    graph: graph,
                    visited: [...visited],
                    queue: [...queue],
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
        queue: [],
        completed: true
    });
    
    return { visitedOrder, tracer };
}

// [TEST]
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
const tracer = new Tracer('graphs', 'queue', 'Queue');
const { visitedOrder } = bfs(adjacencyMatrix, start, tracer);

console.log(`BFS Traversal starting from node ${start}:`);
console.log(`Visit order: ${visitedOrder}`);
console.log('Graph structure (adjacency matrix):');
adjacencyMatrix.forEach((row, i) => {
    console.log(`  Node ${i}: [${row.join(', ')}]`);
});

// Output tracer data for visualization
tracer.finalize();

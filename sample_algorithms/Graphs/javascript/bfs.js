const Tracer = require('./tracers/tracer');

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
    tracer.addState([], {
        graph: graph,
        visited: [...visited],
        queue: [...queue]
    });
    
    while (queue.length > 0) {
        const current = queue.shift();
        visitedOrder.push(current);
        
        // Show current node being processed
        tracer.addState([], {
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
                tracer.addState([], {
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
    tracer.addState([], {
        graph: graph,
        visited: [...visited],
        queue: [],
        completed: true
    });
    
    return { visitedOrder, tracer };
}

// [TEST]
if (require.main === module) {
    // Example graph: 6 nodes (0-5)
    // Adjacency matrix representation
    const adjacencyMatrix = [
        [0, 1, 1, 0, 0, 0],  // Node 0 connects to 1, 2
        [1, 0, 0, 1, 1, 0],  // Node 1 connects to 0, 3, 4
        [1, 0, 0, 0, 1, 0],  // Node 2 connects to 0, 4
        [0, 1, 0, 0, 0, 1],  // Node 3 connects to 1, 5
        [0, 1, 1, 0, 0, 1],  // Node 4 connects to 1, 2, 5
        [0, 0, 0, 1, 1, 0]   // Node 5 connects to 3, 4
        [0, 0, 0, 1, 1, 0]   // Node 5 connects to 3, 4
        [0, 0, 0, 1, 1, 0]   // Node 5 connects to 3, 4
    ];
    
    const start = 0;
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
}

module.exports = { bfs };

import tracers.tracer as trc
from collections import deque

# [ALGORITHM]
def bfs(graph, start_node, tracer):
    """
    Breadth-First Search traversal on a graph represented as adjacency matrix.
    
    Args:
        graph: 2D list (adjacency matrix) where graph[i][j] = 1 means edge from i to j
        start_node: The starting node index for BFS
        tracer: Tracer object to record states

    """
    n = len(graph)
    visited = [False] * n
    queue = deque([start_node])
    visited[start_node] = True
    visited_order = []
    
    # Initial state - show graph with start node
    tracer.add_state(
        [],
        graph=graph,
        visited=visited.copy(),
        queue=list(queue)
    )
    
    while queue:
        current = queue.popleft()
        visited_order.append(current)
        
        # Show current node being processed
        tracer.add_state(
            [],
            graph=graph,
            visited=visited.copy(),
            queue=list(queue),
            processing=current
        )
        
        # Explore neighbors
        for neighbor in range(n):
            if graph[current][neighbor] == 1 and not visited[neighbor]:
                visited[neighbor] = True
                queue.append(neighbor)
                
                # Show neighbor being discovered
                tracer.add_state(
                    [],
                    graph=graph,
                    visited=visited.copy(),
                    queue=list(queue),
                    processing=current,
                    discovered=neighbor
                )
    
    # Final state
    tracer.add_state(
        [],
        graph=graph,
        visited=visited.copy(),
        queue=[],
        completed=True
    )
    
    return visited_order, tracer

# [TEST]
if __name__ == "__main__":
    # Example graph: 6 nodes (0-5)
    # Adjacency matrix representation
    adjacency_matrix = [
        [0, 1, 1, 0, 0, 0],  # Node 0 connects to 1, 2
        [1, 0, 0, 1, 1, 0],  # Node 1 connects to 0, 3, 4
        [1, 0, 0, 0, 1, 0],  # Node 2 connects to 0, 4
        [0, 1, 0, 0, 0, 1],  # Node 3 connects to 1, 5
        [0, 1, 1, 0, 0, 1],  # Node 4 connects to 1, 2, 5
        [0, 0, 0, 1, 1, 0]   # Node 5 connects to 3, 4
    ]
    
    start = 0
    result, tracer = bfs(adjacency_matrix, start, trc.Tracer(category='graphs', data_structure='queue', data_structure_label='Queue'))
    
    print(f'BFS Traversal starting from node {start}:')
    print(f'Visit order: {result}')
    print(f'Graph structure (adjacency matrix):')
    for i, row in enumerate(adjacency_matrix):
        print(f'  Node {i}: {row}')
    
    # Output tracer data for visualization
    tracer.finalize()

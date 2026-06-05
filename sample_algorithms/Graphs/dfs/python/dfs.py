from runtime.tracer import Tracer

def dfs(graph, start_node, tracer):
    """
    Depth-First Search traversal on a graph represented as adjacency matrix.
    
    Args:
        graph: 2D list (adjacency matrix) where graph[i][j] = 1 means edge from i to j
        start_node: The starting node index for DFS
        tracer: Tracer object to record states
    """
    n = len(graph)
    visited = [False] * n
    stack = [start_node]
    visited_order = []
    
    # Initial state - show graph with start node in stack
    tracer.add_state(
        [],
        graph=graph,
        visited=visited.copy(),
        stack=stack.copy()
    )
    
    while stack:
        current = stack.pop()
        
        if visited[current]:
            continue
        
        visited[current] = True
        visited_order.append(current)
        
        # Show current node being processed
        tracer.add_state(
            [],
            graph=graph,
            visited=visited.copy(),
            stack=stack.copy(),
            processing=current
        )

        # Explore neighbors
        for neighbor in range(n - 1, -1, -1):
            if graph[current][neighbor] == 1 and not visited[neighbor] and neighbor not in stack:
                stack.append(neighbor)
                
                # Show neighbor being discovered
                tracer.add_state(
                    [],
                    graph=graph,
                    visited=visited.copy(),
                    stack=stack.copy(),
                    processing=current,
                    discovered=neighbor
                )
    
    # Final state
    tracer.add_state([],
        graph=graph,
        visited=visited,
        stack=[],
        completed=True
    )
    
    return visited_order, tracer

if __name__ == '__main__':
    # [PARAMS]
    adjacency_matrix = [
        [0, 1, 1, 0, 0, 0],
        [1, 0, 0, 1, 1, 0],
        [1, 0, 0, 0, 1, 0],
        [0, 1, 0, 0, 0, 1],
        [0, 1, 1, 0, 0, 1],
        [0, 0, 0, 1, 1, 0]
    ]
    start = 0
    # [/PARAMS]
    result, tracer = dfs(adjacency_matrix, start, Tracer('graphs', 'stack', 'Stack'))
    
    print(f"DFS Traversal starting from node {start}:")
    print(f"Visit order: {result}")
    print("Graph structure (adjacency matrix):")
    for i, row in enumerate(adjacency_matrix):
        print(f"  Node {i}: {row}")
    
    # Output tracer data for visualization
    tracer.finalize()

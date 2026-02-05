import json

class Tracer:
    def __init__(self, category=None, data_structure=None, data_structure_label=None):
        self.states = []
        self.step = 0
        self.category = category
        self.data_structure = data_structure
        self.data_structure_label = data_structure_label or (data_structure.capitalize() if data_structure else None)
    
    def add_state(self, data, **kwargs):
        self.step += 1
        state = {"step": self.step, "data": data}
        if self.category:
            state["category"] = self.category
        state.update(kwargs)
        self.states.append(state)
    
    def get_states(self):
        result = {"states": self.states}
        if self.data_structure:
            result["metadata"] = {
                "dataStructure": self.data_structure,
                "dataStructureLabel": self.data_structure_label
            }
        return result
    
    def finalize(self):
        print('\n--- TRACER_JSON_START ---')
        print(json.dumps(self.get_states()))
        print('--- TRACER_JSON_END ---')


class TreeTracer(Tracer):
    """
    Tracer for tree algorithms (binary trees, n-ary trees, etc.)
    
    Data structure:
    {
        "tree": [
            {"id": 1, "value": 10, "children": [2, 3]},
            {"id": 2, "value": 5, "children": [4]},
            ...
        ],
        "visited": [1, 2],
        "current": 3
    }
    """
    
    def __init__(self, data_structure="Tree", data_structure_label="Tree"):
        super().__init__(category="trees", data_structure=data_structure, data_structure_label=data_structure_label)
    
    def add_tree_state(self, nodes, visited=None, current=None, **kwargs):
        """
        Add a tree state to the tracer.
        
        Args:
            nodes: List of node dicts with structure:
                   [{"id": 1, "value": 10, "children": [2, 3]}, ...]
            visited: List of node IDs that have been visited
            current: ID of the currently processing node
            **kwargs: Additional state properties
        """
        self.add_state(
            [],
            tree=nodes,
            visited=visited if visited is not None else [],
            current=current,
            **kwargs
        )
    
    def add_tree_state_with_metadata(self, nodes, visited=None, current=None, metadata=None, **kwargs):
        """
        Add a tree state with additional metadata (e.g., algorithm-specific info).
        
        Args:
            nodes: List of node dicts
            visited: List of visited node IDs
            current: Current node ID
            metadata: Dict with additional info (e.g., {"height": 3, "balanced": True})
            **kwargs: Additional state properties
        """
        state_data = {
            "tree": nodes,
            "visited": visited if visited is not None else [],
            "current": current,
            "metadata": metadata if metadata is not None else {}
        }
        self.add_state(state_data, **kwargs)
    
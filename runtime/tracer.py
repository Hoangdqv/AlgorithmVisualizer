import json

class Tracer:
    def __init__(self, category=None, data_structure=None, data_structure_label=None):
        self._states = []
        self._step = 0
        self.category = category
        self.data_structure = data_structure
        self.data_structure_label = data_structure_label or (data_structure.capitalize() if data_structure else None)
    
    def add_state(self, data, **kwargs):
        self._step += 1
        state = {"step": self._step, "data": data}
        if self.category:
            state["category"] = self.category
        state.update(kwargs)
        self._states.append(state)
    
    def get_states(self):
        result = {"states": self._states}
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
    
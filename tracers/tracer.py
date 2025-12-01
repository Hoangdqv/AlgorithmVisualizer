import json

class Tracer:
    def __init__(self, category=None):
        self.states = []
        self.step = 0
        self.category = category
    
    def add_state(self, data, **kwargs):
        self.step += 1
        state = {"step": self.step, "data": data}
        if self.category:
            state["category"] = self.category
        state.update(kwargs)
        self.states.append(state)
    
    def get_states(self):
        return {"states": self.states}
    
    def finalize(self):
        print('\n--- TRACER_JSON_START ---')
        print(json.dumps(self.get_states()))
        print('--- TRACER_JSON_END ---')
    
class Tracer {
    constructor(category = null, data_structure = null, data_structure_label = null) {
        this.states = [];
        this.step = 0;
        this.category = category;
        this.data_structure = data_structure;
        this.data_structure_label = data_structure_label || (data_structure ? data_structure.charAt(0).toUpperCase() + data_structure.slice(1) : null);
    }

    add_state(data, metadata = {}) {
        this.step += 1;
        const state = { step: this.step, data: data, ...metadata };
        if (this.category) {
            state.category = this.category;
        }
        this.states.push(state);
    }

    get_states() {
        const result = { states: this.states };
        if (this.data_structure) {
            result.metadata = {
                dataStructure: this.data_structure,
                dataStructureLabel: this.data_structure_label
            };
        }
        return result;
    }

    finalize() {
        console.log('\n--- TRACER_JSON_START ---');
        console.log(JSON.stringify(this.get_states()));
        console.log('--- TRACER_JSON_END ---');
    }
}

export default Tracer;


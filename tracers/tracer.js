class Tracer {
    constructor(category = null, dataStructure = null, dataStructureLabel = null) {
        this.states = [];
        this.step = 0;
        this.category = category;
        this.dataStructure = dataStructure;
        this.dataStructureLabel = dataStructureLabel || (dataStructure ? dataStructure.charAt(0).toUpperCase() + dataStructure.slice(1) : null);
    }

    addState(data, metadata = {}) {
        this.step += 1;
        const state = { step: this.step, data: data, ...metadata };
        if (this.category) {
            state.category = this.category;
        }
        this.states.push(state);
    }

    getStates() {
        const result = { states: this.states };
        if (this.dataStructure) {
            result.metadata = {
                dataStructure: this.dataStructure,
                dataStructureLabel: this.dataStructureLabel
            };
        }
        return result;
    }

    finalize() {
        console.log('\n--- TRACER_JSON_START ---');
        console.log(JSON.stringify(this.getStates()));
        console.log('--- TRACER_JSON_END ---');
    }
}

export default Tracer;


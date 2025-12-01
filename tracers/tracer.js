class Tracer {
    constructor(category = null) {
        this.states = [];
        this.step = 0;
        this.category = category;
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
        return { states: this.states };
    }

    finalize() {
        console.log('\n--- TRACER_JSON_START ---');
        console.log(JSON.stringify(this.getStates()));
        console.log('--- TRACER_JSON_END ---');
    }
}

module.exports = Tracer;

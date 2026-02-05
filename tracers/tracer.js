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

class TreeTracer extends Tracer {
    /**
     * Tracer for tree algorithms (binary trees, n-ary trees, etc.)
     */
    constructor(dataStructure = "Tree", dataStructureLabel = "Tree") {
        super("trees", dataStructure, dataStructureLabel);
    }

    /**
     * Add a tree state to the tracer.
     * @param {Array} nodes - Array of node objects with structure: [{id: 1, value: 10, children: [2, 3]}, ...]
     * @param {Array} visited - Array of node IDs that have been visited
     * @param {number|null} current - ID of the currently processing node
     * @param {Object} metadata - Additional state properties
     */
    addTreeState(nodes, visited = [], current = null, metadata = {}) {
        this.addState([], {
            tree: nodes,
            visited: visited,
            current: current,
            ...metadata
        });
    }

    /**
     * Add a tree state with additional metadata.
     * @param {Array} nodes - Array of node objects
     * @param {Array} visited - Array of visited node IDs
     * @param {number|null} current - Current node ID
     * @param {Object} metadata - Additional info (e.g., {height: 3, balanced: true})
     * @param {Object} additionalState - Additional state properties
     */
    addTreeStateWithMetadata(nodes, visited = [], current = null, metadata = {}, additionalState = {}) {
        this.addState([], {
            tree: nodes,
            visited: visited,
            current: current,
            metadata: metadata,
            ...additionalState
        });
    }
}

export default Tracer;
export { TreeTracer };


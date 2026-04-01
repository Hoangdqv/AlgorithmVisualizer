function buildBSTNodes(values) {
  if (!values || values.length === 0) return [];

  const nodes = [];
  let nextId = 1;

  function createNode(value) {
    const node = { id: nextId++, value, left: null, right: null };
    nodes.push(node);
    return node;
  }

  const root = createNode(values[0]);

  for (let i = 1; i < values.length; i++) {
    let current = root;
    while (true) {
      if (values[i] < current.value) {
        // If left child doesn't exist, create one; otherwise, go left
        if (!current.left) { current.left = createNode(values[i]); break; }
        current = current.left;
      } else {
        // If right child doesn't exist, create one; otherwise, go right
        if (!current.right) { current.right = createNode(values[i]); break; }
        current = current.right;
      }
    }
  }

  return nodes.map((n) => ({
    id: n.id,
    value: n.value,
    children: [
      ...(n.left  ? [n.left.id]  : []),
      ...(n.right ? [n.right.id] : []),
    ],
  }));
}


function buildAdjacencyMatrix(nodeCount, edges) {
  const matrix = Array.from({ length: nodeCount }, () =>
    Array(nodeCount).fill(0),
  );
  edges.forEach(([a, b]) => {
    if (a >= 0 && a < nodeCount && b >= 0 && b < nodeCount) {
      matrix[a][b] = 1;
      matrix[b][a] = 1; // undirected
    }
  });
  return matrix;
}

function parseEdges(edgeStr) {
  return String(edgeStr)
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.includes('-'))
    .map((e) => {
      const [a, b] = e.split('-').map(Number);
      return [a, b];
    })
    .filter(([a, b]) => !isNaN(a) && !isNaN(b));
}


export const algorithmParams = {
  sorting: {
    params: [
      {
        key: 'array',
        label: 'Array',
        type: 'array-int',
        default: [92, 14, 461, 1122, 235, 9, 127],
        placeholder: '92, 14, 461, 1122, 235, 9, 127',
        description: 'Comma-separated integers to sort',
      },
    ],
  },
  graphs: {
    params: [
      {
        key: 'nodeCount',
        label: 'Number of Nodes',
        type: 'number',
        default: 6,
        min: 2,
        max: 20,
        description: 'Total number of nodes in the graph (Starts from 0 to n-1)',
      },
      {
        key: 'edges',
        label: 'Edges',
        type: 'edge-list',
        default: '0-1, 0-2, 1-3, 1-4, 2-4, 3-5, 4-5',
        placeholder: '0-1, 0-2, 1-3, 1-4',
        description: 'Comma-separated undirected edges (e.g., 0-1, 1-3)',
      },
      {
        key: 'startNode',
        label: 'Start Node',
        type: 'number',
        default: 0,
        min: 0,
        description: 'Starting node index for traversal',
      },
    ],
  },
  trees: {
    params: [
      {
        key: 'values',
        label: 'Node Values',
        type: 'array-int',
        default: [10, 5, 15, 3, 7, 12, 20],
        placeholder: '10, 5, 15, 3, 7, 12, 20',
        description:
          'Comma-separated values inserted into BST in order (first value becomes root)',
      },
      {
        key: 'operation',
        label: 'Operation',
        type: 'select',
        default: 'inorder',
        options: [
          { value: 'build', label: 'Generate Tree Only' },
          { value: 'inorder', label: 'Traversal - In-order' },
          { value: 'preorder', label: 'Traversal - Pre-order' },
          { value: 'postorder', label: 'Traversal - Post-order' },
          { value: 'insert', label: 'Insert Values' },
          { value: 'delete', label: 'Delete Values' },
          { value: 'search', label: 'Search Values' },
        ],
        description: 'Operation for the tree',
      },
      {
        key: 'target',
        label: 'Target Value',
        type: 'number-optional',
        enabledWhen: (values) =>
          !['build', 'preorder', 'inorder', 'postorder'].includes(values.operation),
        default: '',
        description: 'Value used in search/insert/delete operations',
      }
    ],
  },
};


export function buildParamsBlock(category, language, params) {
  if (category === 'sorting') return buildSortingBlock(language, params);
  if (category === 'graphs')  return buildGraphBlock(language, params);
  if (category === 'trees')   return buildTreeBlock(language, params);
  return '';
}

function buildSortingBlock(language, params) {
  const arr = `[${params.array.join(', ')}]`;
  if (language === 'python') return `original_arr = ${arr}`;
  return `const originalArr = ${arr};`;
}

function buildGraphBlock(language, params) {
  const edges  = parseEdges(params.edges);
  const matrix = buildAdjacencyMatrix(Number(params.nodeCount), edges);
  const rows   = matrix.map((row) => `    ${JSON.stringify(row)}`).join(',\n');
  if (language === 'python') {
    return `adjacency_matrix = [\n${rows}\n]\nstart = ${params.startNode}`;
  }
  return `const adjacencyMatrix = [\n${rows}\n];\nconst start = ${params.startNode};`;
}

function buildTreeBlock(language, params) {
  const nodes = params.existingTreeNodes || buildBSTNodes(params.values);
  const rootId = params.existingRootId || 1;

  if (language === 'python') {
    const target = (params.target === '' || params.target === null || params.target === undefined)
      ? 'None'
      : JSON.stringify(params.target);
    const rows = nodes
      .map((n) => {
        const children = (n.children || []).map((child) => (
          child === null || child === undefined ? 'None' : child
        ));
        return `    {"id": ${n.id}, "value": ${n.value}, "children": [${children.join(', ')}]}`;
      })
      .join(',\n');
    return `tree_nodes = [\n${rows}\n]\nroot_id = ${rootId}\noperation = "${params.operation}"\ntarget = ${target}`;
  }

  const target = (params.target === '' || params.target === null || params.target === undefined)
    ? 'null'
    : JSON.stringify(params.target);

  const rows = nodes
    .map((n) => {
      const children = (n.children || []).map((child) => (
        child === null || child === undefined ? 'null' : child
      ));
      return `    { id: ${n.id}, value: ${n.value}, children: [${children.join(', ')}] }`;
    })
    .join(',\n');
  return `const treeNodes = [\n${rows}\n];\nconst rootId = ${rootId};\nconst operation = "${params.operation}";\nconst target = ${target};`;
}

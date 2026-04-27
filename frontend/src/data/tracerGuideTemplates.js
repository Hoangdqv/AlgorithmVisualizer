const GUIDE_CONFIG = {
  sorting: {
    title: 'Sorting Tracer Guide',
    moments: [
      'Initial array state',
      'Each comparison between two indices',
      'Each successful swap',
      'Pivot/range changes for partition-based sorts',
      'Final sorted state'
    ],
    metadata: ['comparing', 'swapped', 'selected', 'pivot', 'range', 'variables', 'indexVars'],
    metadataHints: {
      comparing: ' [i, j], [left, right]',
      swapped: ' [i, j]',
      selected: ' [pivotIndex], [minIndex]',
      pivot: ' pivotIndex, pivotValue',
      range: ' [left, right], [start, end], [low, high]',
      variables: ` { 'i': i, 'j': j, 'pivotIndex': pivotIndex, 'minIndex': minIndex }`,
      indexVars: " ['i', 'j'], ['left', 'right']"
    },
    tracerLines: [
      {
        id: 'init',
        title: 'Tracer init',
        always: true,
        python: `tracer = Tracer(
    category='sorting'
)`,
        javascript: `const tracer = new Tracer(
  'sorting'
);`
      },
      {
        id: 'start',
        title: 'Start state',
        always: true,
        python: `tracer.add_state(
    arr.copy()
)`,
        javascript: `tracer.addState(
  [...arr]
);`
      },
      {
        id: 'compare',
        title: 'Compare indices',
        detect: [/for\s+\w+\s+in\s+range|for\s*\(/, />=|<=|==|!=|>|</],
        python: `tracer.add_state(
    arr.copy(),
    comparing=[i, j],
    indexVars=['i', 'j'],
    variables={'i': i, 'j': j}
)`,
        javascript: `tracer.addState(
  [...arr],
  {
    comparing: [i, j],
    indexVars: ['i', 'j'],
    variables: { i, j }
  }
);`
      },
      {
        id: 'swap',
        title: 'Swap happened',
        detect: [/swap|arr\[.*\],\s*arr\[.*\]|temp\s*=|\[arr\[.*\],\s*arr\[.*\]\]\s*=|\[arr\[.*\],\s*arr\[.*\]\]/],
        python: `tracer.add_state(
    arr.copy(),
    swapped=[i, j],
    indexVars=['i', 'j'],
    variables={'i': i, 'j': j}
)`,
        javascript: `tracer.addState(
  [...arr],
  {
    swapped: [i, j],
    indexVars: ['i', 'j'],
    variables: { i, j }
  }
);`
      },
      {
        id: 'select',
        title: 'Selection / pivot focus',
        detect: [/pivot|min|max|select|index|partition/],
        python: `tracer.add_state(
    arr.copy(),
    selected=[i],
    pivot=pivot_idx,
    variables={'i': i, 'pivot_idx': pivot_idx}
)`,
        javascript: `tracer.addState(
  [...arr],
  {
    selected: [i],
    pivot: pivotIndex,
    variables: { i, pivotIndex }
  }
);`
      },
      {
        id: 'final',
        title: 'Final state',
        always: true,
        python: `tracer.add_state(
    arr.copy()
)`,
        javascript: `tracer.addState(
  [...arr],
);`
      }
    ]
  },
  graphs: {
    title: 'Graph Tracer Guide',
    moments: [
      'Initial graph + frontier state',
      'Node being processed',
      'Node discovery and frontier update',
      'Visited set updates',
      'Final traversal result'
    ],
    metadata: ['graph', 'queue', 'stack', 'visited', 'processing', 'discovered', 'variables'],
    metadataHints: {
      graph: ' adjacency list / matrix object',
      queue: ' [0, 1, 2], [...queue]',
      stack: ' [start], [...stack]',
      visited: ' [0, 2, 3], [...visited]',
      processing: ' currentNode',
      discovered: ' neighbor',
      variables: ` { 'currentNode': currentNode, 'neighbor': neighbor, 'step': step }`
    },
    tracerLines: [
      {
        id: 'init',
        title: 'Tracer init',
        always: true,
        python: `tracer = Tracer(
    'graphs',
    'queue',
    'Queue'
)`,
        javascript: `const tracer = new Tracer(
  'graphs',
  'queue',
  'Queue'
);`
      },
      {
        id: 'start',
        title: 'Start graph state',
        always: true,
        python: `tracer.add_state(
    [],
    graph=graph,
    queue=list(queue),
    visited=visited.copy()
)`,
        javascript: `tracer.addState(
  [],
  {
    graph,
    queue: [...queue],
    visited: [...visited],
  }
);`
      },
      {
        id: 'processing',
        title: 'Processing node',
        detect: [/pop\(|shift\(|dequeue|stack|queue/],
        python: `tracer.add_state(
    [],
    graph=graph,
    queue=list(queue),
    visited=visited.copy(),
    processing=current_node
)`,
        javascript: `tracer.addState(
  [],
  {
    graph,
    queue: [...queue],
    visited: [...visited],
    processing: currentNode
  }
);`
      },
      {
        id: 'discover',
        title: 'Discovered neighbor',
        detect: [/neighbor|adj|adjacency|for\s+.*in\s+.*graph|for\s*\(.*of.*\)/],
        python: `tracer.add_state(
    [],
    graph=graph,
    queue=list(queue),
    visited=visited.copy(),
    discovered=neighbor
)`,
        javascript: `tracer.addState(
  [],
  {
    graph,
    queue: [...queue],
    visited: [...visited],
    discovered: neighbor
  }
);`
      },
      {
        id: 'final',
        title: 'Final traversal state',
        always: true,
        python: `tracer.add_state(
    [],
    graph=graph,
    queue=list(queue),
    visited=visited.copy()
)`,
        javascript: `tracer.addState(
  [],
  {
    graph,
    queue: [...queue],
    visited: [...visited],
  }
);`
      }
    ]
  },
  trees: {
    title: 'Tree Tracer Guide',
    moments: [
      'Initial tree structure',
      'Current node + traversal depth',
      'Branch decisions / insert-delete operations',
      'Structure updates after each operation',
      'Final tree state'
    ],
    metadata: ['tree', 'current', 'visited', 'depth', 'variables'],
    metadataHints: {
      tree: ' tree node array (current structure snapshot)',
      current: ' nodeId, null',
      visited: ' [1, 2, 5], [...visited]',
      depth: ' 0, 1, 2 (current depth)',
      variables: ` { 'target': target, 'parent': parent, 'action': action, 'result': result }`
    },
    tracerLines: [
      {
        id: 'init',
        title: 'Tracer init',
        always: true,
        python: `tracer = Tracer(
    'trees',
    'list',
    'List'
)`,
        javascript: `const tracer = new Tracer(
  'trees',
  'list',
  'List'
);`
      },
      {
        id: 'start',
        title: 'Start tree state',
        always: true,
        python: `tracer.add_state(
    [],
    tree=tree,
    current=None,
    depth=0
)`,
        javascript: `tracer.addState(
  [],
  {
    tree,
    current: null,
    depth: 0
  }
);`
      },
      {
        id: 'visit',
        title: 'Current node visit',
        detect: [/node|current|left|right|travers/],
        python: `tracer.add_state(
    [],
    tree=tree,
    current=node_id,
    depth=depth
)`,
        javascript: `tracer.addState(
  [],
  {
    tree,
    current: nodeId,
    depth
  }
);`
      },
      {
        id: 'update',
        title: 'Structure update',
        detect: [/insert|delete|remove|rotate|attach|parent|child/],
        python: `tracer.add_state(
    [],
    tree=tree,
    current=node_id,
    depth=depth
)`,
        javascript: `tracer.addState(
  [],
  {
    tree,
    current: nodeId,
    depth
  }
);`
      },
      {
        id: 'final',
        title: 'Final tree state',
        always: true,
        python: `tracer.add_state(
    [],
    tree=tree,
    current=None
)`,
        javascript: `tracer.addState(
  [],
  {
    tree,
    current: null
  }
);`
      }
    ]
  }
};

const fallbackConfig = {
  title: 'General Tracer Guide',
  moments: [
    'Initial state before processing',
    'Important state changes inside loops/branches',
    'Result state before return'
  ],
  metadata: ['variables'],
  metadataHints: {
    variables: ' { phase, step, current, result }'
  },
  tracerLines: [
    {
      id: 'init',
      title: 'Tracer init',
      always: true,
      python: `tracer = Tracer(
    category='sorting'
)`,
      javascript: `const tracer = new Tracer(
  'sorting'
);`
    },
    {
      id: 'start',
      title: 'Start state',
      always: true,
      python: `tracer.add_state(
    state_data
)`,
      javascript: `tracer.addState(
  stateData
);`
    },
    {
      id: 'update',
      title: 'Important update',
      always: true,
      python: `tracer.add_state(
    state_data,
    variables={'event': 'update'}
)`,
      javascript: `tracer.addState(
  stateData,
  { variables: { event: 'update' } }
);`
    },
    {
      id: 'final',
      title: 'Final state',
      always: true,
      python: `tracer.add_state(
    state_data
)`,
      javascript: `tracer.addState(
  stateData
);`
    }
  ]
};

const toDisplayLanguage = (language) => {
  const normalized = (language || '').toLowerCase();
  return normalized === 'javascript' ? 'JavaScript' : 'Python';
};

export const getTracerGuideConfig = (category, language) => {
  const normalizedCategory = (category || '').toLowerCase();
  const normalizedLanguage = (language || '').toLowerCase();
  const categoryConfig = GUIDE_CONFIG[normalizedCategory] || fallbackConfig;

  return {
    ...categoryConfig,
    category: normalizedCategory,
    language: normalizedLanguage,
    languageLabel: toDisplayLanguage(normalizedLanguage),
    tracerMethod: normalizedLanguage === 'javascript' ? 'addState' : 'add_state'
  };
};

const detectTracerLines = (tracerLines, code) => {
  const normalizedCode = (code || '').toLowerCase();

  return tracerLines.filter(line => {
    // IF always shows, return true
    if (line.always) return true;
    // If no detect patterns, skip this line (return false)
    if (!line.detect || line.detect.length === 0) return false;
    // Check if every pattern in detect matches the code snippet
    return line.detect.every(pattern => pattern.test(normalizedCode));
  });
};

export const getTracerGuideWithDetection = (category, language, code) => {
  const guide = getTracerGuideConfig(category, language);
  const lines = detectTracerLines(guide.tracerLines || [], code);
  const languageKey = guide.language === 'javascript' ? 'javascript' : 'python';

  return {
    ...guide,
    detectedLines: lines.map(line => ({
      id: line.id,
      title: line.title,
      snippet: line[languageKey]
    }))
  };
};

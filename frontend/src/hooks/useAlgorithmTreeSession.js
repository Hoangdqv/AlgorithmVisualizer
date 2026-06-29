import { useCallback, useEffect, useState } from 'react';

export default function useAlgorithmTreeSession(category, currentLanguage) {
  const [treeSession, setTreeSession] = useState(null);

  useEffect(() => {
    setTreeSession(null);
  }, [category, currentLanguage]);

  const inferRootId = useCallback((nodes, fallback = 1) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return fallback;

    const allIds = new Set(nodes.map((node) => node.id));
    const childIds = new Set();

    nodes.forEach((node) => {
      (node.children || []).forEach((childId) => {
        if (childId !== null && childId !== undefined) {
          childIds.add(childId);
        }
      });
    });

    const rootCandidate = [...allIds].find((id) => !childIds.has(id));
    return rootCandidate ?? fallback;
  }, []);

  const getLatestTreeSnapshot = useCallback((statesPayload) => {
    const states = statesPayload?.states || [];
    for (let i = states.length - 1; i >= 0; i -= 1) {
      if (Array.isArray(states[i]?.tree) && states[i].tree.length > 0) {
        return states[i].tree;
      }
    }
    return null;
  }, []);

  return {
    treeSession,
    setTreeSession,
    inferRootId,
    getLatestTreeSnapshot,
    hasTreeSession: Boolean(treeSession?.nodes?.length),
  };
}

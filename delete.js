const repairAndTrimPath = (
  parsedIds, // IDs the AI returned
  pathMap, // The BFS result from buildPathMap
  validPassiveIds, // The allowed subgraph IDs
  classRoot, // The starting node ID
  budget, // passivePoints
) => {
  const rootStr = String(classRoot);
  const finalPathSet = new Set();

  // 1. Force connectivity for every AI-selected node
  for (const id of parsedIds) {
    const numericId = Number(id);

    // Check if the node is even reachable in our graph
    if (pathMap.isReachable(numericId)) {
      const fullPathToNode = pathMap.getPathIds(numericId);

      // Add every node in the chain from root to this target
      fullPathToNode.forEach((pathNodeId) => {
        const sid = String(pathNodeId);
        // We add it if it's valid and NOT the root (since you slice root later)
        if (validPassiveIds.has(sid) && sid !== rootStr) {
          finalPathSet.add(sid);
        }
      });
    }
  }

  // 2. Convert to array
  let result = Array.from(finalPathSet);

  // 3. Smart Trimming if we exceed the budget
  // If the AI was too greedy, we prioritize Notables/Keystones
  // and the fillers that lead to them.
  if (result.length > budget) {
    result = result
      .sort((a, b) => {
        const metaA = nodeIndex[a];
        const metaB = nodeIndex[b];
        const isSpecialA = metaA?.isKeystone || metaA?.isNotable ? 1 : 0;
        const isSpecialB = metaB?.isKeystone || metaB?.isNotable ? 1 : 0;
        return isSpecialB - isSpecialA; // Notables first
      })
      .slice(0, budget);
  }

  return result;
};

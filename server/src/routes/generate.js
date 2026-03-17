import express from "express";
import fs from "fs";
import { aiPrompt, classPrompts } from "../../helpers/aiPrompt.js";
import imgPrompt from "../../helpers/imgPrompt.js";
import { getOpenAIClient } from "../../utils/openai.js";
import { buildGraph } from "../tree/buildGraph.js";

const router = express.Router();
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

const FORBIDDEN_NODE_IDS = new Set([
  9485, 56216, 18407, 22419, 53396, 64370, 52319, 45923, 1207, 13397, 41031,
  23570, 61438, 42350, 42500, 7741, 15507, 1140, 43746, 38143, 55276, 44343,
  17248, 55342,
]);

const rawData = fs.readFileSync("./data/poe2TreeJson.json", "utf8");
const skillTreeData = JSON.parse(rawData);
// Build global graph
const {
  graph: rawGraph,
  nodeIndex,
  nodeOrbitIndex,
  orbit_radii,
} = buildGraph({
  nodes: skillTreeData.passives,
  groups: skillTreeData.groups,
  orbit_radii: skillTreeData.orbit_radii,
  skills_per_orbit: skillTreeData.skills_per_orbit,
});

const graph = {};
for (const [nodeId, neighbors] of Object.entries(rawGraph)) {
  const numericId = Number(nodeId);

  if (FORBIDDEN_NODE_IDS.has(numericId)) continue;

  graph[nodeId] = neighbors.filter(
    (neighborId) => !FORBIDDEN_NODE_IDS.has(Number(neighborId)),
  );
}
const ASCENDANCY_MAP = {
  Witch1: "WITCH",
  Witch2: "WITCH",
  Witch3: "WITCH",
  Ranger1: "RANGER",
  Ranger3: "RANGER",
  Monk1: "MONK",
  Monk2: "MONK",
  Monk3: "MONK",
  Warrior1: "WARRIOR",
  Warrior2: "WARRIOR",
  Warrior3: "WARRIOR",
  Mercenary1: "MERCENARY",
  Mercenary2: "MERCENARY",
  Mercenary3: "MERCENARY",
  Sorceress1: "SORCERESS",
  Sorceress2: "SORCERESS",
  Sorceress3: "SORCERESS",
  Druid1: "DRUID",
  Druid2: "DRUID",
  Huntress1: "HUNTRESS",
  Huntress3: "HUNTRESS",
};

const classRootMap = {
  witch: [54447],
  sorceress: [54447],
  druid: [61525],
  ranger: [50459],
  huntress: [50459],
  mercenary: [50986],
  monk: [44683],
  warrior: [47175],
};

const isAscendancyNode = (nodeId) => {
  const node = nodeIndex[nodeId];
  if (!node) return false;
  if (node.ascendancy) return true;
  const rawNode = skillTreeData.passives[nodeId];
  if (rawNode?.id && rawNode.id.toLowerCase().includes("ascendancy"))
    return true;
  return false;
};

const ascendancyNodeIdSet = new Set(
  Object.keys(nodeIndex)
    .filter((id) => isAscendancyNode(Number(id)))
    .map(Number),
);
console.log(`✅ Detected ${ascendancyNodeIdSet.size} ascendancy nodes`);

// builds parent map from a single root
const buildPathMap = (graph, root) => {
  const parent = { [root]: null };
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    for (const neighbor of graph[node] || []) {
      if (!(neighbor in parent)) {
        parent[neighbor] = node;
        queue.push(neighbor);
      }
    }
  }

  // Full ID chain from root → nodeId
  const getPathIds = (nodeId) => {
    const chain = [];
    let cur = Number(nodeId);
    if (!(cur in parent)) return [];
    while (cur !== null && cur !== undefined) {
      chain.unshift(cur);
      const next = parent[cur];
      cur = next !== undefined ? next : null;
    }
    return chain;
  };

  const isReachable = (nodeId) => Number(nodeId) in parent;

  return { parent, getPathIds, isReachable };
};

const STAT_KEYWORDS = [
  "life",
  "mana",
  "energy shield",
  "armour",
  "evasion",
  "damage",
  "attack speed",
  "cast speed",
  "critical",
  "resistance",
  "flask",
  "charge",
  "regenerat",
];

const ATTRIBUTE_ONLY_PATTERN =
  /^\+\d+ to (any attribute|strength|dexterity|intelligence|all attributes)$/i;

const isAttributeOnlyNode = (meta) => {
  const stats = Array.isArray(meta.stats)
    ? meta.stats
    : meta.stats
      ? [meta.stats]
      : [];
  if (stats.length === 0) return false;
  return stats.every((s) => ATTRIBUTE_ONLY_PATTERN.test(s.trim()));
};

const scoreFillerNode = (nodeId) => {
  const meta = nodeIndex[nodeId];
  if (!meta) return 0;
  if (meta.isKeystone || meta.isNotable) return 0;
  if (isAttributeOnlyNode(meta)) return -3;
  const statsText = (
    Array.isArray(meta.stats) ? meta.stats.join(" ") : meta.stats || ""
  ).toLowerCase();
  let score = 0;
  for (const StatkeyWord of STAT_KEYWORDS) {
    if (statsText.includes(StatkeyWord)) score++;
  }
  return score;
};

const scorePathQuality = (pathIds) => {
  const fillerIds = pathIds.slice(1, -1);
  return fillerIds.reduce((sum, id) => sum + scoreFillerNode(id), 0);
};

const getClassSubgraph = (
  graph,
  nodeIndex,
  roots,
  maxDepth,
  maxNodes,
  filterFn,
) => {
  const queue = roots.map((root) => [root, 0]);
  const visited = new Set(roots);
  const subgraph = {};
  let count = 0;

  while (queue.length && count < maxNodes) {
    const [node, currentDepth] = queue.shift();
    if (!nodeIndex[node] || !filterFn(node)) continue;

    subgraph[node] = {
      stats:
        nodeIndex[node].stats ||
        (nodeIndex[node].name ? [nodeIndex[node].name] : []),
      connections: graph[node] || [],
      orbit: nodeOrbitIndex[node] || 0,
    };
    count++;

    if (currentDepth < maxDepth) {
      graph[node]?.forEach((neigh) => {
        if (!visited.has(neigh)) {
          visited.add(neigh);
          queue.push([neigh, currentDepth + 1]);
        }
      });
    }
  }
  return subgraph;
};

const serializeNotablesForAI = (subgraph, pathMap) => {
  const lines = [];

  for (const [id, node] of Object.entries(subgraph)) {
    const meta = nodeIndex[id];
    if (!meta) continue;
    if (!meta.isKeystone && !meta.isNotable) continue;

    const name = meta.name || id;
    const type = meta.isKeystone ? "[KEYSTONE]" : "[NOTABLE]";
    const stats = Array.isArray(node.stats)
      ? node.stats.join("; ")
      : node.stats || "";
    const statsTrimmed = stats.length > 120 ? stats.slice(0, 120) + "…" : stats;

    const pathIds = pathMap.getPathIds(id);
    const cost = pathIds.length - 1;
    const pathQuality = scorePathQuality(pathIds);

    const fillerIds = pathIds.slice(1, -1).join(",");

    lines.push(
      `${id}|${type}${name}|${statsTrimmed}` +
        `|COST:${cost}` +
        `|PATH_QUALITY:${pathQuality}` +
        `|FILLER_IDS:${fillerIds}`,
    );
  }

  return lines.join("\n");
};

const serializePassiveFillersForAI = (subgraph, pathMap) => {
  const neededFillerIds = new Set();

  for (const [id] of Object.entries(subgraph)) {
    const meta = nodeIndex[id];
    if (!meta || (!meta.isKeystone && !meta.isNotable)) continue;
    const pathIds = pathMap.getPathIds(id);
    pathIds.slice(1, -1).forEach((pid) => neededFillerIds.add(String(pid)));
  }

  const lines = [];
  for (const id of neededFillerIds) {
    if (!subgraph[id]) continue;
    const meta = nodeIndex[id];
    if (!meta) continue;
    const stats = Array.isArray(meta.stats)
      ? meta.stats.join("; ")
      : meta.stats || "";
    const statsTrimmed = stats.length > 80 ? stats.slice(0, 80) + "…" : stats;
    const neighborIds = (subgraph[id].connections || []).join(",");
    lines.push(
      `${id}|${meta.name || id}|${statsTrimmed}|NEIGHBORS:${neighborIds}`,
    );
  }
  return lines.join("\n");
};

const serializeAscendancyForAI = (subgraph) => {
  return Object.entries(subgraph)
    .map(([id, node]) => {
      const meta = nodeIndex[id];
      if (!meta) return null;
      const name = meta.name || id;
      const stats = Array.isArray(node.stats)
        ? node.stats.join("; ")
        : node.stats || "";
      const statsTrimmed =
        stats.length > 100 ? stats.slice(0, 100) + "…" : stats;
      const neighborIds = (node.connections || []).join(",");
      return `${id}|${name}|${statsTrimmed}|NEIGHBORS:${neighborIds}`;
    })
    .filter(Boolean)
    .join("\n");
};

const repairAndTrimPath = (
  parsedIds,
  pathMap,
  validPassiveIds,
  classRoot,
  budget,
) => {
  const rootStr = String(classRoot);

  const required = new Set();
  required.add(rootStr);

  for (const id of parsedIds) {
    if (!validPassiveIds.has(id)) continue;
    const pathIds = pathMap.getPathIds(Number(id));
    if (pathIds.length === 0) continue;
    pathIds.forEach((pid) => {
      const pidStr = String(pid);
      if (validPassiveIds.has(pidStr)) required.add(pidStr);
    });
  }

  const withoutRoot = [...required].filter((id) => id !== rootStr);

  if (withoutRoot.length <= budget) {
    return [rootStr, ...withoutRoot];
  }

  const notableSet = new Set(
    withoutRoot.filter((id) => {
      const m = nodeIndex[id];
      return m && (m.isKeystone || m.isNotable);
    }),
  );

  const protectedFillers = new Set();
  for (const nid of notableSet) {
    const pathIds = pathMap.getPathIds(Number(nid));
    if (pathIds.length === 0) continue;
    pathIds.slice(1, -1).forEach((pid) => {
      const pidStr = String(pid);
      if (validPassiveIds.has(pidStr)) protectedFillers.add(pidStr);
    });
  }

  const kept = [...notableSet, ...protectedFillers];
  return [rootStr, ...kept.slice(0, budget)];
};

// Route
router.post("/", async (req, res) => {
  const openai = getOpenAIClient();
  const { prompt, history, imageUrls, classId } = req.body;
  const userPrompt = prompt;
  const normalizedClassId = classId?.toUpperCase();

  try {
    // Context Gathering
    let conversationHistory = history ? JSON.parse(history) : [];

    const query = encodeURIComponent(userPrompt);
    const searchResponse = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CSE_CX}&q=${query}&num=3`,
    );
    const searchData = await searchResponse.json();
    const snippets = (searchData.items || [])
      .map((i) => `Title: ${i.title}\nSnippet: ${i.snippet}`)
      .join("\n\n");

    // Point budget
    const userLevelMatch = userPrompt.match(/(?:level|points)\s?(\d+)/i);
    const userLevel = userLevelMatch ? parseInt(userLevelMatch[1], 10) : 1;
    const passivePoints = Math.max(0, userLevel - 1);
    const ascendancyPointsAvailable = 9;

    // PASSIVE tree Subgraph
    const roots =
      classRootMap[normalizedClassId.toLowerCase()] || skillTreeData.roots;
    const classRoot = roots[0];

    const passiveSubgraph = getClassSubgraph(
      graph,
      nodeIndex,
      roots,
      passivePoints + 10,
      500,
      (id) => {
        const node = nodeIndex[id];
        if (!node) return false;
        if (FORBIDDEN_NODE_IDS.has(Number(id))) return false;
        if (ascendancyNodeIdSet.has(Number(id))) return false;
        if (
          String(id).includes("cross_class") &&
          normalizedClassId !== "RANGER"
        ) {
          return false;
        }
        return true;
      },
    );

    const validPassiveIds = new Set(Object.keys(passiveSubgraph));
    const pathMap = buildPathMap(graph, classRoot);

    // ASCENDANCY tree Subgraph
    let ascendancySubgraph = {};
    let showAscendancy = false;
    let availableAscendancyNames = [];
    const lowerCPrompt = userPrompt.toLowerCase();
    const ascendancyTriggers = [
      "ascend",
      "ascendancy",
      "ascension",
      "lab",
      "labyrinth",
      "trial",
      "trials",
      "sekhema",
      "chaos",
      "eternal",
      "lab run",
      "ascend class",
      "unlock ascend",
      "my ascendancy",
      "best ascend",
      "which ascend",
      "ascend tree",
      "ascend path",
      "endgame",
      "late game",
      "full build",
      "max build",
      "optimized build",
      "build guide",
      "build planner",
      "passive + ascend",
      "tree",
      "asc tree",
      "asc path",
    ];

    if (userLevel >= 20) showAscendancy = true;
    if (ascendancyTriggers.some((t) => lowerCPrompt.includes(t)))
      showAscendancy = true;
    if (
      lowerCPrompt.includes("only passive") ||
      lowerCPrompt.includes("no ascendancy") ||
      lowerCPrompt.includes("no lab") ||
      lowerCPrompt.includes("ignore ascend") ||
      lowerCPrompt.includes("no tree")
    ) {
      showAscendancy = false;
    }

    if (showAscendancy) {
      const ascRoots = Object.values(nodeIndex)
        .filter(
          (n) =>
            n.isAscendancyStart &&
            n.ascendancy &&
            ASCENDANCY_MAP[n.ascendancy] === normalizedClassId,
        )
        .map((n) => n.id);

      availableAscendancyNames = [
        ...new Set(
          Object.values(nodeIndex)
            .filter(
              (n) =>
                n.ascendancy &&
                ASCENDANCY_MAP[n.ascendancy] === normalizedClassId,
            )
            .map((n) => n.ascendancy),
        ),
      ];

      ascendancySubgraph = getClassSubgraph(
        graph,
        nodeIndex,
        ascRoots,
        12,
        150,
        (nodeId) => {
          const node = nodeIndex[nodeId];
          if (!node || !node.ascendancy) return false;
          return ASCENDANCY_MAP[node.ascendancy] === normalizedClassId;
        },
      );
    }

    const validAscendancyIds = new Set(Object.keys(ascendancySubgraph));

    const notablesData = serializeNotablesForAI(passiveSubgraph, pathMap);
    const fillersData = serializePassiveFillersForAI(passiveSubgraph, pathMap);
    const ascendancyData = serializeAscendancyForAI(ascendancySubgraph);
    const rootName = nodeIndex[classRoot]?.name || "Class Start";

    const enhancedSystemPrompt = `${aiPrompt}
## PATH OF EXILE 2 PASSIVE TREE — ALLOCATION RULES

ROOT NODE: ${classRoot} (${rootName}) — always included, does not count toward your budget.
Point budget: ${passivePoints} + 3 passive points.

### DATA FORMAT

NOTABLES & KEYSTONES:
  id|[TYPE]Name|stats|COST:N|PATH_QUALITY:N|FILLER_IDS:id,id,...

  COST         = points needed to reach this node from root (path fillers + the notable itself)
  PATH_QUALITY = quality score of the filler nodes on the path. HIGHER is better.
  NEGATIVE = path goes through wasteful +5 attribute nodes. Prefer PATH_QUALITY >= 0.
  FILLER_IDS   = IDs of the small nodes you must pass through — ALL must be included when you pick this notable

FILLER NODES:
  id|name|stats
  Small nodes on notable paths. Required when their notable is selected.

${
  showAscendancy
    ? `ASCENDANCY NODES:
  id|name|stats|NEIGHBORS:id,id,...
  All nodes in the ascendancy tree. Every node costs exactly 1 point (small, notable, keystone alike).
  Read the stats and pick the best connected path of exactly ${ascendancyPointsAvailable} nodes.
  Use NEIGHBORS (these are node IDs) to verify adjacency before selecting.`
    : ""
}

### HOW TO BUILD THE PATH

1. Understand the user's build goal — damage type, playstyle, defense layer.

2. Scan NOTABLES & KEYSTONES. For each candidate notable, evaluate:
   - Are the stats relevant to the build goal?
   - What is the COST? Can you afford it within ${passivePoints} points?
   - What is the PATH_QUALITY? Negative quality means wasted points on attribute nodes.
   A good notable has high relevance AND reasonable COST AND PATH_QUALITY >= 0.

3. Select your target notables. For each one, its FILLER_IDS are mandatory.
   If two notables share path nodes, those shared nodes count only ONCE.
   Running total (excl. root) must not exceed ${passivePoints}.

4. After notables + fillers are locked in, if points remain, note that
   the server will automatically fill remaining points with connected filler nodes.
   You do not need to manually select extra fillers.

5. Before writing output: count all IDs (excluding root) = exactly ${passivePoints}.
  No duplicates. Every node must connect back to root through selected nodes.
  
### CRITICAL RULE: NO FLOATING NODES
Every ID you put in PASSIVE_NODE_IDS must form a single continuous line back to the ROOT. 
If you pick a Notable, you MUST also list every ID found in its FILLER_IDS field. 
Failure to include the filler IDs will result in a broken build.
      ${
        showAscendancy
          ? `6. Ascendancy: choose ONE from ${availableAscendancyNames.join(", ")}.
   Pick exactly ${ascendancyPointsAvailable} connected nodes from that ascendancy only.
   Use NEIGHBORS (IDs) to trace a valid connected path. Include small bridge nodes between notables.`
          : ""
      }

### OUTPUT — NO DEVIATIONS
      ASCENDANCY CHOSEN: [name or if none do NOT write about it at all]
PASSIVE_NODE_IDS: "id1","id2","id3",...   <- EXACTLY ${passivePoints} unique IDs, root excluded
ASCENDANCY_NODE_IDS: "idA","idB",...      <- EXACTLY ${showAscendancy ? ascendancyPointsAvailable : 0} unique IDs (or blank)
in a sperate paragraph explain your REASONING, Explain your build choices and path — use node NAMES not IDs.

---
### NOTABLES & KEYSTONES
${notablesData}

      ---
### FILLER NODES
${fillersData}
${showAscendancy ? `\n---\n### ASCENDANCY NODES\n${ascendancyData}` : ""}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      messages: [
        {
          role: "system",
          content:
            enhancedSystemPrompt + "\n\n" + (classPrompts[classId] || ""),
        },
        ...conversationHistory,
        {
          role: "user",
          content: `Context:\n${snippets}\n\nUser: ${userPrompt}`,
        },
      ],
      max_completion_tokens: 3000,
    });

    // Token usage logging
    const usage = response.usage;
    console.log("Token usage:", usage);
    console.log(`\u001b[31m Prompt: ${usage.prompt_tokens}\u001b[0m`);
    console.log(`\u001b[32mCompletion: ${usage.completion_tokens}\u001b[0m`);
    console.log(`\u001b[34mTotal: ${usage.total_tokens}\u001b[0m`);
    // token usage logging ends here

    const choice = response.choices?.[0];
    const finishReason = choice?.finish_reason;
    const content = choice?.message?.content ?? null;

    console.log(`✅ OpenAI response received | finish_reason: ${finishReason}`);

    if (!content) {
      console.error(
        "❌ No response content received. finish_reason:",
        finishReason,
      );
      console.error("Full choice object:", JSON.stringify(choice, null, 2));
      return res.status(500).json({
        error:
          "The AI returned an empty response. This usually means the output was cut off (max_completion_tokens too low) or the model refused the request.",
        finish_reason: finishReason ?? "unknown",
      });
    }

    // Parse passive IDs
    const passiveMatch = content.match(/PASSIVE_NODE_IDS:\s*([\d",\s]+)/);
    const parsedPassiveIds = passiveMatch
      ? passiveMatch[1]
          .replace(/"/g, "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    // Deduplicate, exclude non-passive IDs, cap at passivePoints
    const seenPassive = new Set();
    const cleanedPassiveIds = parsedPassiveIds.filter((id) => {
      if (!id) return false;
      if (!validPassiveIds.has(id)) return false;
      if (ascendancyNodeIdSet.has(Number(id))) return false;
      if (seenPassive.has(id)) return false;
      seenPassive.add(id);
      return true;
    });

    const repairedIds = repairAndTrimPath(
      cleanedPassiveIds,
      pathMap,
      validPassiveIds,
      classRoot,
      passivePoints,
    );

    const passiveNodeIds = repairedIds
      .filter((id) => String(id) !== String(classRoot))
      .slice(0, passivePoints);

    const ascendancyMatch = content.match(/ASCENDANCY_NODE_IDS:\s*([\d",\s]*)/);
    const parsedAscendancyIds = ascendancyMatch
      ? ascendancyMatch[1]
          .replace(/"/g, "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    // Deduplicate, hard-filter to valid ascendancy IDs, cap at 9 (8 nodes + 1 ascendancy root node)
    const seenAsc = new Set();
    const ascendancyNodeIdsResult = parsedAscendancyIds
      .filter((id) => {
        if (!id) return false;
        if (!validAscendancyIds.has(id)) return false;
        if (seenAsc.has(id)) return false;
        seenAsc.add(id);
        return true;
      })
      .slice(0, ascendancyPointsAvailable);

    return res.json({
      response: content,
      passiveNodeIds,
      ascendancyNodeIds: ascendancyNodeIdsResult,
    });
  } catch (error) {
    console.error("❌ Critical Error:", error?.message || error);
    console.error("Stack:", error?.stack);
    res.status(500).json({
      error: error?.message || "Server error",
    });
  }
});

export default router;

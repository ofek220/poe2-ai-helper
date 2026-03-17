import express from "express";
import fs from "fs";
import { aiPrompt, classPrompts } from "../../helpers/aiPrompt.js";
import imgPrompt from "../../helpers/imgPrompt.js";
import { getOpenAIClient } from "../../utils/openai.js";
import { buildGraph } from "../tree/buildGraph.js";

const router = express.Router();
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_CSE_CX = process.env.GOOGLE_CSE_CX;

// --- 1. GLOBAL DATA LOADING (Happens once when server starts) ---
console.log("⏳ Loading Skill Tree data...");
const rawData = fs.readFileSync("./data/poe2TreeJson.json", "utf8");
const skillTreeData = JSON.parse(rawData);

// Build the global graph references
const { graph, nodeIndex, nodeOrbitIndex, orbit_radii } = buildGraph({
  nodes: skillTreeData.passives,
  groups: skillTreeData.groups,
  orbit_radii: skillTreeData.orbit_radii,
  skills_per_orbit: skillTreeData.skills_per_orbit,
});

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

console.log("✅ Skill tree graph cached and memory stabilized.");

// --- 2. HELPER FUNCTIONS ---

// NEW: Pre-compute which node IDs belong to which ascendancy
// This lets us filter them out of passive subgraph reliably
const ascendancyNodeIds = new Set(
  Object.values(nodeIndex)
    .filter((n) => n.ascendancyName)
    .map((n) => n.id),
);

const serializeForAI = (subgraph) => {
  return Object.entries(subgraph)
    .map(([id, node]) => {
      const stats = Array.isArray(node.stats)
        ? node.stats.join(";")
        : node.stats || "No stats";

      const conns = Array.isArray(node.connections)
        ? node.connections.join(",")
        : "";

      return `${id}|${node.orbit || 0}|${stats}|${conns}`;
    })
    .join("\n");
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

// --- 3. ROUTER ---

router.post("/", async (req, res) => {
  const openai = getOpenAIClient();
  const { prompt, history, imageUrls, classId } = req.body;
  const userPrompt = prompt;
  const normalizedClassId = classId?.toUpperCase();

  try {
    // Context Gathering (History & Search)
    let conversationHistory = history ? JSON.parse(history) : [];
    const query = encodeURIComponent(userPrompt);
    const searchResponse = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_SEARCH_API_KEY}&cx=${GOOGLE_CSE_CX}&q=${query}&num=3`,
    );
    const searchData = await searchResponse.json();
    const snippets = (searchData.items || [])
      .map((i) => `Title: ${i.title}\nSnippet: ${i.snippet}`)
      .join("\n\n");

    //  Point Calculations
    const userLevelMatch = userPrompt.match(/(?:level|points)\s?(\d+)/i);
    const userLevel = userLevelMatch ? parseInt(userLevelMatch[1], 10) : 1;
    const passivePoints = Math.max(0, userLevel - 1);
    const ascendancyPointsAvailable = 8;

    // --- PASSIVE Subgraph Generation ---
    // FIX: Strictly exclude ALL ascendancy nodes from passive subgraph
    const roots =
      classRootMap[normalizedClassId.toLowerCase()] || skillTreeData.roots;

    const passiveSubgraph = getClassSubgraph(
      graph,
      nodeIndex,
      roots,
      passivePoints + 10,
      400,
      (id) => {
        const node = nodeIndex[id];
        if (!node) return false;

        // FIX: Hard exclude any node that has an ascendancyName
        if (node.ascendancyName) return false;

        // FIX: Hard exclude nodes that are in the global ascendancy set
        if (ascendancyNodeIds.has(id)) return false;

        if (
          String(id).includes("cross_class") &&
          normalizedClassId !== "RANGER"
        )
          return false;
        return true;
      },
    );

    // Build a Set of valid passive node IDs so we can reference it in the prompt
    const validPassiveIds = new Set(Object.keys(passiveSubgraph));

    // --- ASCENDANCY Subgraph Generation ---
    let ascendancySubgraph = {};
    let showAscendancy = false;
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
    ];

    // FIX: Only show ascendancy if level >= 20 OR user explicitly asked
    if (userLevel >= 20) {
      showAscendancy = true;
    }
    if (ascendancyTriggers.some((trigger) => lowerCPrompt.includes(trigger))) {
      showAscendancy = true;
    }

    if (
      lowerCPrompt.includes("only passive") ||
      lowerCPrompt.includes("no ascendancy") ||
      lowerCPrompt.includes("no lab") ||
      lowerCPrompt.includes("ignore ascend")
    ) {
      showAscendancy = false;
    }

    // Collect all ascendancy roots for this class so we can tell the AI which ones exist
    let ascendancyRootsByName = {};

    if (showAscendancy) {
      const ascRoots = Object.values(nodeIndex)
        .filter(
          (n) =>
            n.is_ascendancy_starting_node &&
            ASCENDANCY_MAP[n.ascendancyName] === normalizedClassId,
        )
        .map((n) => n.id);

      // FIX: Group ascendancy starting nodes by their ascendancyName
      // so we know which IDs belong to which ascendancy
      Object.values(nodeIndex)
        .filter(
          (n) =>
            n.is_ascendancy_starting_node &&
            ASCENDANCY_MAP[n.ascendancyName] === normalizedClassId,
        )
        .forEach((n) => {
          if (!ascendancyRootsByName[n.ascendancyName]) {
            ascendancyRootsByName[n.ascendancyName] = n.id;
          }
        });

      ascendancySubgraph = getClassSubgraph(
        graph,
        nodeIndex,
        ascRoots,
        12,
        150,
        (nodeId) => {
          const node = nodeIndex[nodeId];
          if (!node || !node.ascendancyName) return false;
          const belongsToClass =
            ASCENDANCY_MAP[node.ascendancyName] === normalizedClassId;
          return belongsToClass;
        },
      );
    }

    // Build the set of valid ascendancy IDs per ascendancy name for prompt reference
    // FIX: Label each ascendancy node with its ascendancyName in the serialized data
    const serializeAscendancyForAI = (subgraph) => {
      return Object.entries(subgraph)
        .map(([id, node]) => {
          const stats = Array.isArray(node.stats)
            ? node.stats.join(";")
            : node.stats || "No stats";
          const conns = Array.isArray(node.connections)
            ? node.connections.join(",")
            : "";
          // FIX: Include the ascendancyName label so AI knows which ascendancy each node belongs to
          const ascName = nodeIndex[id]?.ascendancyName || "unknown";
          return `${id}|${ascName}|${node.orbit || 0}|${stats}|${conns}`;
        })
        .join("\n");
    };

    // Build Compact Prompt
    const compactPassive = serializeForAI(passiveSubgraph);
    const compactAscendancy = serializeAscendancyForAI(ascendancySubgraph);

    // FIX: List which ascendancy names are available for this class so AI picks exactly one
    const availableAscendancyNames = [
      ...new Set(
        Object.values(ascendancySubgraph)
          .map(
            (_, idx) =>
              nodeIndex[Object.keys(ascendancySubgraph)[idx]]?.ascendancyName,
          )
          .filter(Boolean),
      ),
    ];

    // FIX: Rewritten system prompt with much stricter, clearer rules
    const enhancedSystemPrompt = `${aiPrompt}

## PATH OF EXILE 2 BUILD RULES — READ CAREFULLY AND FOLLOW EXACTLY

### PASSIVE TREE RULES
- The passive tree is a large shared graph. Your selected class starts at node ${roots[0]}.
- You MUST allocate exactly ${passivePoints} passive nodes.
- EVERY passive node you pick MUST be reachable by a connected path starting from root node ${roots[0]}.
- You CANNOT skip nodes — each picked node must connect to at least one other picked node in a continuous chain from the root.
- ONLY pick nodes from the PASSIVE section below. These are the ONLY valid passive node IDs.
- NEVER pick any node that is NOT listed in the PASSIVE section below.
- Ascendancy nodes are COMPLETELY SEPARATE and must NEVER appear in PASSIVE_NODE_IDS.

### ASCENDANCY TREE RULES
- Ascendancy visibility: ${showAscendancy ? "INCLUDED" : "NOT INCLUDED"}
- ${
      showAscendancy
        ? `You MUST pick ONE ascendancy from this list: ${availableAscendancyNames.join(", ")}
- After choosing ONE ascendancy, allocate exactly ${ascendancyPointsAvailable} nodes from that ascendancy ONLY.
- In the ASCENDANCY section below, each node is labeled: id|ascendancyName|orbit|stats|connections
- ONLY use nodes whose ascendancyName matches your chosen ascendancy.
- NEVER mix nodes from different ascendancies.
- ASCENDANCY_NODE_IDS must contain EXACTLY ${ascendancyPointsAvailable} node IDs.`
        : `Do NOT mention or recommend ascendancy. ASCENDANCY_NODE_IDS must be empty.`
    }

### OUTPUT FORMAT — MANDATORY, NO EXCEPTIONS
ASCENDANCY CHOSEN: [exact ascendancyName from the list, or "None"]
PASSIVE_NODE_IDS: "id1","id2","id3",...  (exactly ${passivePoints} IDs, all from PASSIVE section, connected path from root ${roots[0]})
ASCENDANCY_NODE_IDS: "idA","idB",...  (exactly ${showAscendancy ? ascendancyPointsAvailable : 0} IDs, all from chosen ascendancy only, or empty if not shown)
REASONING: Brief explanation of choices

### SUBGRAPH DATA

PASSIVE NODES (id|orbit|stats|connections) — ONLY pick IDs from this list:
${compactPassive}

${
  showAscendancy
    ? `ASCENDANCY NODES (id|ascendancyName|orbit|stats|connections) — ONLY pick from your ONE chosen ascendancy:
${compactAscendancy}`
    : ""
}`;

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
      max_completion_tokens: 1500,
    });

    // token usage logging
    const usage = response.usage;
    console.log("Token usage:", usage);
    console.log(`\u001b[31m Prompt: ${usage.prompt_tokens}\u001b[0m`);
    console.log(`\u001b[32mCompletion: ${usage.completion_tokens}\u001b[0m`);
    console.log(`\u001b[34mTotal: ${usage.total_tokens}\u001b[0m`);

    console.log("✅ OpenAI response received:", response);
    const content = response.choices[0].message.content;

    // --- 7. Parsing Results ---
    const passiveMatch = content.match(/PASSIVE_NODE_IDS:\s*([\d",\s]+)/);
    const parsedPassiveIds = passiveMatch
      ? passiveMatch[1]
          .replace(/"/g, "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    // FIX: After parsing, hard-filter passive IDs to only include nodes
    // that actually exist in the passive subgraph (never ascendancy nodes)
    const passiveNodeIds = parsedPassiveIds.filter((id) =>
      validPassiveIds.has(id),
    );

    const ascendancyMatch = content.match(
      /ASCENDANCY_NODE_IDS:\s*(["\d",\s]+)/,
    );
    const parsedAscendancyIds = ascendancyMatch
      ? ascendancyMatch[1]
          .replace(/"/g, "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    // FIX: Hard-cap ascendancy node IDs to max 8 and only valid ascendancy nodes
    const validAscendancyIds = new Set(Object.keys(ascendancySubgraph));
    const ascendancyNodeIdsResult = parsedAscendancyIds
      .filter((id) => validAscendancyIds.has(id))
      .slice(0, ascendancyPointsAvailable);

    return res.json({
      response: content,
      passiveNodeIds,
      ascendancyNodeIds: ascendancyNodeIdsResult,
    });
  } catch (error) {
    console.error("❌ Critical Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

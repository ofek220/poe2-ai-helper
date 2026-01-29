import express from "express";
import { treeData } from "../tree/loadTree.js";
import { buildGraph } from "../tree/buildGraph.js";

const router = express.Router();

const { passives, groups, orbit_radii, skills_per_orbit } = treeData;

const { graph, nodeIndex, connectionSplines, nodeOrbitIndex } = buildGraph({
  nodes: passives,
  groups,
  orbit_radii,
  skills_per_orbit,
});

router.get("/full", (req, res) => {
  try {
    res.json({
      graph,
      nodeIndex,
      connectionSplines,
      nodeOrbitIndex,
      orbit_radii,
      skills_per_orbit,
    });
  } catch (err) {
    console.error("Error serving tree:", err);
    res.status(500).json({ error: "Failed to serve tree data" });
  }
});

export default router;

import { buildNodeIndex } from "./nodeIndex.js";

export const buildGraph = ({
  nodes,
  groups,
  orbit_radii,
  skills_per_orbit,
}) => {
  const graph = {};
  const connectionSplines = {};
  const tempCoords = {};
  const classRoots = {};
  const nodeOrbitIndex = {};

  groups.forEach((group) => {
    group.passives.forEach((nodeRef) => {
      const nodeId = nodeRef.hash;
      const nodeData = nodes[nodeId];

      if (!nodeData) return;

      const orbitIndex = nodeRef.radius;
      const radius = orbit_radii[orbitIndex];
      const skillsInOrbit = skills_per_orbit[orbitIndex];

      const angle = (2 * Math.PI * nodeRef.position_clockwise) / skillsInOrbit;

      const offsetX = radius * Math.sin(angle);
      const offsetY = -radius * Math.cos(angle);

      const x = group.x + offsetX;
      const y = group.y + offsetY;

      tempCoords[nodeId] = {
        x,
        y,
        groupX: group.x,
        groupY: group.y,
      };

      // Store orbit index for each node - determines arc radius
      nodeOrbitIndex[nodeId] = orbitIndex;

      const nameUpper = nodeData.name ? nodeData.name.toUpperCase() : "";

      if (nameUpper === "TEMPLAR") {
        classRoots["TEMPLAR"] = { x, y };
        classRoots["DRUID"] = { x, y };
      }
      if (nameUpper === "WITCH") {
        classRoots["WITCH"] = { x, y };
        classRoots["SORCERESS"] = { x, y };
      }
      if (nameUpper === "RANGER") {
        classRoots["RANGER"] = { x, y };
        classRoots["HUNTRESS"] = { x, y };
      }
      if (nameUpper === "DUELIST") {
        classRoots["DUELIST"] = { x, y };
        classRoots["MERCENARY"] = { x, y };
      }
      if (nameUpper === "SIX") {
        classRoots["MONK"] = { x, y };
        classRoots["SHADOW"] = { x, y };
      }
      if (nameUpper === "MARAUDER") {
        classRoots["WARRIOR"] = { x, y };
        classRoots["MARAUDER"] = { x, y };
      }
    });
  });

  // console.log("📍 Class Roots Found:", Object.keys(classRoots));

  const nodeIndex = buildNodeIndex(nodes, tempCoords, classRoots);

  groups.forEach((group) => {
    group.passives.forEach((nodeRef) => {
      const nodeId = nodeRef.hash;
      if (!nodeIndex[nodeId]) return;

      if (!graph[nodeId]) graph[nodeId] = [];

      nodeRef.connections.forEach((targetId, connectionIndex) => {
        if (nodeIndex[targetId]) {
          if (!graph[nodeId].includes(targetId)) {
            graph[nodeId].push(targetId);
          }

          if (!graph[targetId]) graph[targetId] = [];
          if (!graph[targetId].includes(nodeId)) {
            graph[targetId].push(nodeId);
          }

          // Store spline data for connections
          const connectionKey = `${Math.min(nodeId, targetId)}_${Math.max(nodeId, targetId)}`;
          if (!connectionSplines[connectionKey]) {
            const splineX = nodeRef.splines?.[connectionIndex * 2] ?? 0;
            const splineY = nodeRef.splines?.[connectionIndex * 2 + 1] ?? 0;

            connectionSplines[connectionKey] = {
              from: nodeId,
              to: targetId,
              splineOffsets: [splineX, splineY],
            };
          }
        }
      });
    });
  });

  return { graph, nodeIndex, connectionSplines, nodeOrbitIndex, orbit_radii };
};

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import "../../styles/canvas.css";
import { getAuthHeaders } from "../auth/Auth.jsx";

const ASCENDANCY_DATA = {
  Witch: ["Infernalist", "Blood Mage", "Lich", "Abyssal Lich"],
  Ranger: ["Deadeye", "Pathfinder"], //  Arcane Archer
  Monk: ["Invoker", "Acolyte of Chayula"], // Martial Artist
  Warrior: ["Titan", "Warbringer", "Smith of Kitava"],
  // Templar: ["Inquisitor", "Heretic", "Guardian"],
  // Shadow: ["Assassin", "Phantom", "Saboteur"],
  Mercenary: ["Tactician", "Witchhunter", "Gemling Legionnaire"],
  Sorceress: ["Stormweaver", "Chronomancer", "Disciple of Varashta"],
  // Duelist: ["Deathmarked", "Gladiator", "Champion"],
  // Marauder: ["Warlord", "Berserker", "Chieftain"],
  Druid: ["Oracle", "Shaman"],
  Huntress: ["Amazon", "Ritualist"], // Beastmaster
};

const ASCENDANCY_OPTIONS = ["None", ...Object.values(ASCENDANCY_DATA).flat()];

const CLASS_START_MAP = {
  TEMPLAR: "TEMPLAR",
  DRUID: "TEMPLAR",
  WITCH: "WITCH",
  SORCERESS: "WITCH",
  RANGER: "RANGER",
  HUNTRESS: "RANGER",
  DUELIST: "DUELIST",
  MERCENARY: "DUELIST",
  MONK: "SIX",
  SHADOW: "SIX",
  WARRIOR: "MARAUDER",
  MARAUDER: "MARAUDER",
};

const NAME_TO_ID = {};
Object.entries(ASCENDANCY_DATA).forEach(([className, names]) => {
  names.forEach((name, index) => {
    NAME_TO_ID[name] = `${className}${index + 1}`;
  });
});

// override for currently inactive ascendancies
const OVERRIDES = {
  // Witch
  Infernalist: "Witch1", // Infernalist
  "Blood Mage": "Witch2", // Blood Mage
  Lich: "Witch3", // Lich
  "Abyssal Lich": "Witch3", // Abyssal Lich

  // Ranger
  Deadeye: "Ranger1", // Deadeye
  // Arcane Archer: "Ranger2", // Arcane Archer (not in the game yet)
  Pathfinder: "Ranger3", // Pathfinder

  // Monk
  "Martial Artist": "Monk1", // Martial Artist
  Invoker: "Monk2", // invoker -- json has master of elements
  "Acolyte of Chayula": "Monk3", // Acolyte of Chayula

  // Templar (inactive)
  // Inquisitor:   "Templar1", // Inquisitor
  // Heretic:      "Templar2", // Heretic
  // Guardian:     "Templar3", // Guardian

  // Shadow (inactive)
  // Assassin:     "Shadow1", // Assassin
  // Phantom:      "Shadow2", // Phantom
  // Saboteur:     "Shadow3", // Saboteur

  // Warrior
  Titan: "Warrior1", // Titan
  Brute: "Warrior2", // Warbringer -- json has Brute
  "Smith of Kitava": "Warrior3", // Smith of Kitava

  // Mercenary
  Tactician: "Mercenary1", // Tactician
  Witchhunter: "Mercenary2", // Witchhunter
  Gambler: "Mercenary3", //  Gemling Legionnaire -- json has gambler

  // Sorceress
  Stormweaver: "Sorceress1", // Stormweaver
  Chronomancer: "Sorceress2", // Chronomancer
  "Disciple of Varashta": "Sorceress3", // Disciple of Varashta

  // Duelist (inactive)
  // Deathmarked:  "Duelist1", // Deathmarked
  // Gladiator:    "Duelist2", // Gladiator
  // Champion:     "Duelist3", // Champion

  // Marauder (inactive)
  // Warlord:      "Marauder1", // Warlord
  // Berserker:    "Marauder2", // Berserker
  // Chieftain:    "Marauder3", // Chieftain

  // Druid
  Oracle: "Druid1", // Oracle
  Shaman: "Druid2", // Shaman
  // "[DNT] Unused": "Druid3", // not in the game yet

  // Huntress
  Amazon: "Huntress1", // Amazon
  // Beastmaster:  "Huntress2", // Beastmaster
  Ritualist: "Huntress3", // Ritualist
};
Object.assign(NAME_TO_ID, OVERRIDES);

const findShortestPath = (
  graph,
  startIds,
  targetId,
  visibleHashes,
  allHashes,
) => {
  if (!startIds.length || !targetId) return [];
  targetId = String(targetId);
  startIds = startIds.map(String);

  if (startIds.includes(targetId)) return [targetId];

  // Use allHashes for traversal if provided, otherwise fall back to visibleHashes
  const traversalSet = allHashes || visibleHashes;

  const visited = new Set();
  const parent = {};
  const queue = [];

  startIds.forEach((start) => {
    if (traversalSet.has(start)) {
      queue.push(start);
      visited.add(start);
      parent[start] = null;
    }
  });

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === targetId) {
      const path = [];
      let curr = targetId;
      while (curr !== null) {
        path.push(curr);
        curr = parent[curr];
      }
      path.reverse();
      // Filter out invisible hub nodes (mastery etc.) from the returned path
      return path.filter((id) => visibleHashes.has(id));
    }

    const neighbors = graph[current] ?? [];
    for (const neighbor of neighbors) {
      const neighborStr = String(neighbor);
      if (!visited.has(neighborStr) && traversalSet.has(neighborStr)) {
        visited.add(neighborStr);
        parent[neighborStr] = current;
        queue.push(neighborStr);
      }
    }
  }
  return [];
};

const SkillTreeCanvas = () => {
  const canvasRef = useRef(null);
  const iconCacheRef = useRef({});

  const [graph, setGraph] = useState({});
  const [nodeIndex, setNodeIndex] = useState({});
  const [path, setPath] = useState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedClass, setSelectedClass] = useState("None");
  const [selectedAscendancy, setSelectedAscendancy] = useState("None");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [imagesLoaded, setImagesLoaded] = useState(0);

  // Pan and zoom state
  const [scale, setScale] = useState(0.05);
  const lastTouchDistanceRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const canvasBoundaryRef = useRef(null);
  const hasInitialCentered = useRef(false);
  const isMobile = window.innerWidth <= 768;
  const hasMovedRef = useRef(false);

  const treeDataRef = useRef({
    graph,
    nodeIndex,
    visibleNodes: { list: [], hashes: new Set() },
    path,
    selectedNodes,
    hoveredNode,
    scale,
    pan,
    imagesLoaded,
  });

  // Get active node data based on current class or ascendancy
  const getActiveNodeData = (node, currentClass, currentAscendancy) => {
    if (!node || typeof node.options !== "object" || node.options === null) {
      return node;
    }

    if (
      currentAscendancy &&
      currentAscendancy !== "None" &&
      node.options[currentAscendancy]
    ) {
      return { ...node, ...node.options[currentAscendancy] };
    }

    if (currentClass && currentClass !== "None" && node.options[currentClass]) {
      return { ...node, ...node.options[currentClass] };
    }

    return node;
  };

  const visibleNodes = useMemo(() => {
    const list = Object.values(nodeIndex)
      .map((node) => {
        let isCorrectClassStart = false;
        if (node.isClassStart && selectedClass !== "None") {
          const selectedUpper = selectedClass.toUpperCase();
          const nodeNameUpper = (node.name || "").toUpperCase();
          const targetBaseName = CLASS_START_MAP[selectedUpper];
          isCorrectClassStart = nodeNameUpper === targetBaseName;
        }

        const processedNode =
          selectedClass === "None"
            ? node
            : getActiveNodeData(node, selectedClass, selectedAscendancy);

        return { ...processedNode, _isCorrectClassStart: isCorrectClassStart };
      })
      .filter((node) => {
        const nodeName = (node.name || "").toLowerCase().trim();
        if (nodeName.includes("mastery") || nodeName === "") return false;

        if (node.isClassStart) {
          if (selectedClass === "None") return true;
          return node._isCorrectClassStart;
        }

        // Oracle - The Unseen Path Logic
        if (node.unlockConstraint?.ascendancy === "Oracle") {
          const requiredNodeHashes = (node.unlockConstraint.nodes || []).map(
            String,
          );
          const isUnseenPathSelected = selectedNodes.some((hash) =>
            requiredNodeHashes.includes(String(hash)),
          );
          if (!isUnseenPathSelected) return false;
        }

        // None - Base Tree Logic
        if (selectedClass === "None") {
          return !node.ascendancy;
        }

        // Ascendancy Nodes- Only show if they match the selected Ascendancy
        const currentAscId = NAME_TO_ID[selectedAscendancy];
        if (node.ascendancy) {
          return node.ascendancy === currentAscId;
        }

        return true;
      });

    return {
      list,
      hashes: new Set(list.map((n) => String(n.hash))),
    };
  }, [nodeIndex, selectedAscendancy, selectedNodes, selectedClass]);

  const startNodeId = useMemo(() => {
    if (selectedClass === "None") {
      const witchRoot = visibleNodes.list.find(
        (n) => n.isClassStart && n.name?.toUpperCase() === "WITCH",
      );
      return witchRoot?.hash ? String(witchRoot.hash) : null;
    }

    if (selectedAscendancy === "None") {
      const selectedUpper = selectedClass.toUpperCase();
      const targetBaseName = CLASS_START_MAP[selectedUpper];

      const classRoot = visibleNodes.list.find(
        (n) => n.isClassStart && n.name?.toUpperCase() === targetBaseName,
      );

      return classRoot?.hash ? String(classRoot.hash) : null;
    } else {
      const targetAscId = NAME_TO_ID[selectedAscendancy];
      const ascRoot = visibleNodes.list.find(
        (n) => n.ascendancy === targetAscId && n.isAscendancyStart,
      );
      return ascRoot?.hash ? String(ascRoot.hash) : null;
    }
  }, [selectedClass, selectedAscendancy, visibleNodes]);

  // Update the data ref whenever React state changes
  useEffect(() => {
    treeDataRef.current = {
      graph,
      nodeIndex,
      visibleNodes,
      path,
      selectedNodes,
      hoveredNode,
      scale,
      pan,
      imagesLoaded,
      startNodeId,
    };
  }, [
    graph,
    nodeIndex,
    visibleNodes,
    path,
    selectedNodes,
    hoveredNode,
    scale,
    pan,
    imagesLoaded,
    startNodeId,
  ]);

  const regularPointsSpent = useMemo(() => {
    return selectedNodes.filter((hash) => {
      const node = nodeIndex[hash];
      return (
        node &&
        !node.isClassStart &&
        !node.isAscendancyStart &&
        !node.ascendancy
      );
    }).length;
  }, [selectedNodes, nodeIndex]);

  const ascendancyPointsSpent = useMemo(() => {
    return selectedNodes.filter((hash) => {
      const node = nodeIndex[hash];
      return (
        node && node.ascendancy && !node.isClassStart && !node.isAscendancyStart
      );
    }).length;
  }, [selectedNodes, nodeIndex]);

  // Load tree data
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/tree/full`, {
      headers: getAuthHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        setGraph(data.graph);
        setNodeIndex(data.nodeIndex);
      })
      .catch((err) => console.error("Error loading tree:", err));
  }, []);

  // draw canvas
  const drawTree = useCallback(() => {
    const canvas = canvasRef.current;
    const {
      graph,
      nodeIndex,
      visibleNodes,
      path,
      selectedNodes,
      hoveredNode,
      scale,
      pan,
    } = treeDataRef.current;
    const { width, height } = dimensionsRef.current;

    if (!canvas || !graph || !nodeIndex || Object.keys(nodeIndex).length === 0)
      return;

    const ctx = canvas.getContext("2d");

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(scale, 0, 0, scale, pan.x, pan.y);

    const { list, hashes } = visibleNodes;

    // Draw Connections
    for (const [nodeId, neighbors] of Object.entries(graph)) {
      const node = nodeIndex[nodeId];
      const nodeHashStr = node ? String(node.hash) : null;

      if (!node || !hashes.has(nodeHashStr)) continue;

      for (const neighborId of neighbors) {
        const neighbor = nodeIndex[neighborId];
        const neighborHashStr = neighbor ? String(neighbor.hash) : null;

        if (!neighbor || !hashes.has(neighborHashStr)) continue;

        const indexA = path.indexOf(nodeHashStr);
        const indexB = path.indexOf(neighborHashStr);
        const isPathLink =
          indexA !== -1 && indexB !== -1 && Math.abs(indexA - indexB) === 1;

        ctx.beginPath();
        ctx.strokeStyle = isPathLink ? "#fbbf24" : "#444";
        ctx.lineWidth = isPathLink ? 15 : 7;
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(neighbor.x, neighbor.y);
        ctx.stroke();

        // Highlight selected connections
        if (
          !selectedNodes.includes(nodeHashStr) ||
          !selectedNodes.includes(neighborHashStr)
        )
          continue;
        ctx.beginPath();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 15;
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(neighbor.x, neighbor.y);
        ctx.stroke();
      }
    }

    // Draw Nodes
    for (const node of list) {
      const nodeHashStr = String(node.hash);
      const isInPath = path.includes(nodeHashStr);
      const isHovered = hoveredNode === node.hash;
      const isSelected = selectedNodes.includes(nodeHashStr);

      let radius = node.isKeystone ? 90 : node.isNotable ? 60 : 45;

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      const key = node.icon ? node.icon.toLowerCase() : null;
      const img = key ? iconCacheRef.current[key] : null;
      if (img && img.__loaded && !img.__error) {
        const imgSize = radius * 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(
          img,
          node.x - imgSize / 2,
          node.y - imgSize / 2,
          imgSize,
          imgSize,
        );
        ctx.restore();
      }
      // node border color
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      if (isHovered) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 5;
      } else if (isSelected) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 5;
      } else if (isInPath) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 5;
      } else if (node.isKeystone) {
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 3;
      } else if (node.isNotable) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      if (img?.__error) {
        ctx.fillStyle = "#ff000046";
        ctx.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2);
      }
    }
  }, []);

  // handle resize
  useEffect(() => {
    if (!canvasBoundaryRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;

        dimensionsRef.current = { width, height };

        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = width;
          canvas.height = height;
          drawTree();
        }
      }
    });

    resizeObserver.observe(canvasBoundaryRef.current);
    return () => resizeObserver.disconnect();
  }, [drawTree]);

  // Centering canvas on load
  useEffect(() => {
    const hasData = Object.keys(nodeIndex).length > 0;
    const { width, height } = dimensionsRef.current;
    const hasSize = width > 0 && height > 0;

    if (hasData && hasSize && !hasInitialCentered.current) {
      const witchNode = Object.values(nodeIndex).find(
        (n) => n.isClassStart && n.name?.toUpperCase() === "WITCH",
      );

      const targetX = witchNode?.x || 0;
      const targetY = witchNode?.y || 0;
      const initialScale = 0.09;

      setScale(initialScale);
      setPan({
        x: width / 2 - targetX * initialScale,
        y: height / 2 - targetY * initialScale,
      });

      hasInitialCentered.current = true;
    }
  }, [nodeIndex]);

  //  DRAW TRIGGER ON STATE CHANGE
  useEffect(() => {
    drawTree();
  }, [
    drawTree,
    graph,
    nodeIndex,
    hoveredNode,
    path,
    selectedNodes,
    scale,
    pan,
    visibleNodes,
    imagesLoaded,
  ]);

  // handle class and ascendancy change
  const handleClassChange = (newClass) => {
    setSelectedClass(newClass);
    setSelectedAscendancy("None");
    setPath([]);
    setSelectedNodes([]);
  };
  const handleAscendancyChange = (newAscendancy) => {
    setSelectedAscendancy(newAscendancy);
    setPath([]);
    setSelectedNodes([]);
  };

  // find the shortest path
  useEffect(() => {
    if (
      !hoveredNode ||
      !startNodeId ||
      !graph ||
      Object.keys(graph).length === 0
    ) {
      setPath([]);
      return;
    }

    const starts = selectedNodes.length > 0 ? selectedNodes : [startNodeId];
    if (typeof findShortestPath !== "undefined") {
      const calculatedPath = findShortestPath(
        graph,
        starts,
        hoveredNode,
        visibleNodes.hashes,
      );
      setPath(calculatedPath);
    }
  }, [hoveredNode, selectedNodes, startNodeId, graph, visibleNodes.hashes]);

  // icons Loading Logic
  useEffect(() => {
    if (!Object.keys(nodeIndex).length) return;
    const cache = iconCacheRef.current;

    const isGitHub = window.location.hostname.includes("github.io");
    const publicUrl = isGitHub ? "/poe2-ai-helper" : "";

    const loadIcon = (iconPath) => {
      if (!iconPath) return;
      const key = iconPath.toLowerCase();
      if (cache[key]) return;

      const img = new Image();
      img.__loaded = false;

      img.onload = () => {
        img.__loaded = true;
        setImagesLoaded((prev) => prev + 1);
      };

      // img.onerror = () => {
      //   console.error(`Failed to load: ${img.src}`);
      // };

      img.src = key.startsWith("/")
        ? `${import.meta.env.BASE_URL}assets${key}`
        : key;
      cache[key] = img;
    };

    Object.values(nodeIndex).forEach((node) => {
      loadIcon(node.icon);
      if (node.options) {
        Object.values(node.options).forEach((opt) => loadIcon(opt.icon));
      }
    });
  }, [nodeIndex]);

  // mouse
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  // Mouse wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.01, Math.min(2, scale * zoomFactor));

      const worldX = (mouseX - pan.x) / scale;
      const worldY = (mouseY - pan.y) / scale;

      setPan({
        x: mouseX - worldX * newScale,
        y: mouseY - worldY * newScale,
      });
      setScale(newScale);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [scale, pan]);

  // handle touch events for panning and zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleStart = (e) => handleTouchStart(e);
    const handleMove = (e) => handleTouchMove(e);
    const handleEnd = (e) => handleTouchEnd(e);

    canvas.addEventListener("touchstart", handleStart, { passive: false });
    canvas.addEventListener("touchmove", handleMove, { passive: false });
    canvas.addEventListener("touchend", handleEnd, { passive: false });

    return () => {
      canvas.removeEventListener("touchstart", handleStart);
      canvas.removeEventListener("touchmove", handleMove);
      canvas.removeEventListener("touchend", handleEnd);
    };
  }, [scale, pan]);

  // Handle mouse events for panning and zooming
  const handleMouseDown = (e) => {
    isPanningRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    canvasRef.current.style.cursor = "grabbing";
  };

  const handleMouseUp = () => {
    isPanningRef.current = false;
    canvasRef.current.style.cursor = "grab";
  };
  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Handle panning
    if (isPanningRef.current) {
      const mousePanDx = e.clientX - lastMouseRef.current.x;
      const mousePanDy = e.clientY - lastMouseRef.current.y;

      setPan({
        x: pan.x + mousePanDx,
        y: pan.y + mousePanDy,
      });

      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle hover detection
    const worldX = (mx - pan.x) / scale;
    const worldY = (my - pan.y) / scale;

    let foundNode = null;

    // fixed detection radius that scales with zoom
    const detectionRadius = 50;

    for (const node of visibleNodes.list) {
      const mouseHitDx = node.x - worldX;
      const mouseHitDy = node.y - worldY;
      if (
        Math.sqrt(mouseHitDx * mouseHitDx + mouseHitDy * mouseHitDy) <
        detectionRadius
      ) {
        foundNode = node.hash;
        break;
      }
    }
    setHoveredNode(foundNode);
  };

  // Helper to find which node was clicked/tapped
  const getNodeAtPosition = useCallback(
    (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;

      const worldX = (mx - pan.x) / scale;
      const worldY = (my - pan.y) / scale;

      const detectionRadius = 50;

      for (const node of visibleNodes.list) {
        const dx = node.x - worldX;
        const dy = node.y - worldY;
        if (Math.sqrt(dx * dx + dy * dy) < detectionRadius) {
          return node.hash;
        }
      }
      return null;
    },
    [pan, scale, visibleNodes.list],
  );

  const touchStartPosRef = useRef({ x: 0, y: 0 });

  const handleTouchStart = (e) => {
    e.preventDefault();

    if (e.touches.length > 0) {
      setMousePos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      touchStartPosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }

    hasMovedRef.current = false;

    if (e.touches.length === 1) {
      isPanningRef.current = true;
      lastMouseRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    } else if (e.touches.length === 2) {
      isPanningRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      lastTouchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();

    if (e.touches.length === 1) {
      const jitterDx = e.touches[0].clientX - touchStartPosRef.current.x;
      const jitterDy = e.touches[0].clientY - touchStartPosRef.current.y;
      if (Math.sqrt(jitterDx * jitterDx + jitterDy * jitterDy) > 16) {
        hasMovedRef.current = true;
      }
    } else {
      hasMovedRef.current = true;
    }

    const rect = canvasRef.current.getBoundingClientRect();

    if (e.touches.length === 1 && isPanningRef.current) {
      const touch = e.touches[0];
      const panDx = touch.clientX - lastMouseRef.current.x;
      const panDy = touch.clientY - lastMouseRef.current.y;

      setMousePos({ x: touch.clientX, y: touch.clientY });
      setPan((prev) => ({
        x: prev.x + panDx,
        y: prev.y + panDy,
      }));

      lastMouseRef.current = { x: touch.clientX, y: touch.clientY };

      const mx = touch.clientX - rect.left;
      const my = touch.clientY - rect.top;
      const panWorldX = (mx - pan.x) / scale;
      const panWorldY = (my - pan.y) / scale;

      const detectionRadius = 60;

      let foundNode = null;
      for (const node of visibleNodes.list) {
        const hitDx = node.x - panWorldX;
        const hitDy = node.y - panWorldY;
        if (Math.sqrt(hitDx * hitDx + hitDy * hitDy) < detectionRadius) {
          foundNode = node.hash;
          break;
        }
      }
      setHoveredNode(foundNode);
    } else if (
      e.touches.length === 2 &&
      lastTouchDistanceRef.current !== null
    ) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );

      const zoomFactor = currentDist / lastTouchDistanceRef.current;
      if (Math.abs(zoomFactor - 1) < 0.01) return;

      const midX =
        (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      const zoomWorldX = (midX - pan.x) / scale;
      const zoomWorldY = (midY - pan.y) / scale;

      const newScale = Math.max(0.008, Math.min(6, scale * zoomFactor));

      setScale(newScale);
      setPan({
        x: midX - zoomWorldX * newScale,
        y: midY - zoomWorldY * newScale,
      });

      lastTouchDistanceRef.current = currentDist;
      setHoveredNode(null);
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    isPanningRef.current = false;
    lastTouchDistanceRef.current = null;

    if (e.changedTouches.length === 1 && !hasMovedRef.current) {
      const touch = e.changedTouches[0];
      const clickedHash = getNodeAtPosition(touch.clientX, touch.clientY);
      if (clickedHash) {
        handleNodeClick(clickedHash);
      }
    }

    setHoveredNode(null);
    hasMovedRef.current = false;
  };

  const handleNodeClick = useCallback(
    (clickedHash) => {
      if (!clickedHash || !startNodeId) return;

      const clickedStr = String(clickedHash);
      if (clickedStr === startNodeId) return;

      setSelectedNodes((prevSelected) => {
        const isAlreadySelected = prevSelected.includes(clickedStr);

        const starts =
          prevSelected.length > 0 ? [...prevSelected] : [startNodeId];

        const fullPath = findShortestPath(
          graph,
          starts,
          clickedStr,
          visibleNodes.hashes,
        );

        if (fullPath.length === 0) return prevSelected;

        if (!isAlreadySelected) {
          const newSet = new Set([...prevSelected, ...fullPath]);
          return Array.from(newSet);
        }

        let newSelected = prevSelected.filter((id) => id !== clickedStr);
        if (newSelected.length === 0) return [];

        const visited = new Set([startNodeId]);
        const queue = [startNodeId];

        while (queue.length > 0) {
          const curr = queue.shift();
          for (const neigh of graph[curr] || []) {
            const nStr = String(neigh);
            if (!visited.has(nStr) && newSelected.includes(nStr)) {
              visited.add(nStr);
              queue.push(nStr);
            }
          }
        }

        // Only keep nodes that are both reachable AND visible
        return Array.from(visited).filter((id) => visibleNodes.hashes.has(id));
      });
    },
    [startNodeId, graph, visibleNodes.hashes],
  );

  return (
    <div className="topCanvasDiv" ref={canvasBoundaryRef}>
      <div className="canvasWrapper">
        {/* 1. class menu */}
        <div className="classMenu">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label className="selectLabel">Class:</label>
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="select"
            >
              <option value="None">None (Base Tree)</option>
              {Object.keys(ASCENDANCY_DATA).map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* Ascendancy selector (hidden if None is selected) */}
          {selectedClass !== "None" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label className="selectLabel">Ascendancy:</label>
              <select
                className="select"
                value={selectedAscendancy}
                onChange={(e) => {
                  setSelectedAscendancy(e.target.value);
                  handleAscendancyChange(e.target.value);
                }}
              >
                <option value="None">None</option>
                {ASCENDANCY_DATA[selectedClass].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* CANVAS */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            isPanningRef.current = false;
            setHoveredNode(null);
          }}
          onClick={(e) => {
            const clickedHash = getNodeAtPosition(e.clientX, e.clientY);
            if (clickedHash) {
              handleNodeClick(clickedHash);
            }
          }}
          style={{
            display: "block",
            cursor: "grab",
            width: "100%",
            height: "100%",
          }}
        />

        {/* CONTROLS INFO */}
        <div className="controlInfo">
          <div className="desktopControls">
            Controls
            <div>🖱️ Drag to pan</div>
            <div>🔍 Wheel to zoom</div>
            <div>👆 Click to allocate</div>
          </div>
          <div style={{ color: "#fbbf24", fontWeight: "bold" }}>
            Points: {regularPointsSpent}
          </div>
          <div
            style={{ marginTop: "5px", color: "#fbbf24", fontWeight: "bold" }}
          >
            Ascendancy Points: {ascendancyPointsSpent}
          </div>
        </div>

        {/* TOOLTIP */}
        {hoveredNode &&
          nodeIndex[hoveredNode] &&
          (() => {
            const containerRect =
              canvasBoundaryRef.current?.getBoundingClientRect();
            const tooltipLeft = isMobile
              ? mousePos.x - (containerRect?.left ?? 0) + 15
              : pan.x + nodeIndex[hoveredNode].x * scale + 20;
            const tooltipTop = isMobile
              ? mousePos.y - (containerRect?.top ?? 0) - 60
              : pan.y + nodeIndex[hoveredNode].y * scale + 20;

            return (
              <div
                className="tooltipContainer"
                style={{
                  left: `${tooltipLeft}px`,
                  top: `${tooltipTop}px`,
                }}
              >
                {(() => {
                  const activeNode = hoveredNode
                    ? visibleNodes.list.find(
                        (n) => String(n.hash) === String(hoveredNode),
                      )
                    : null;

                  if (!activeNode) return null;

                  return (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "8px",
                        }}
                      >
                        <strong
                          style={{
                            fontSize: "1.2em",
                            color: activeNode.isKeystone
                              ? "#dc2626"
                              : activeNode.isNotable
                                ? "#3b82f6"
                                : "#e2e8f0",
                          }}
                        >
                          {activeNode.name}
                        </strong>
                      </div>

                      {activeNode.stats && activeNode.stats.length > 0 && (
                        <div style={{ fontSize: "0.95em", lineHeight: "1.4" }}>
                          {activeNode.stats.map((stat, i) => (
                            <div
                              key={i}
                              style={{ color: "#93c5fd", marginBottom: "2px" }}
                            >
                              {stat}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            );
          })()}
      </div>
    </div>
  );
};

export default SkillTreeCanvas;

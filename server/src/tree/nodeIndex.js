const ASCENDANCY_MAP = {
  Witch1: "WITCH", // Infernalist
  Witch2: "WITCH", // Blood Mage
  Witch3: "WITCH", // Lich
  Ranger1: "RANGER", // Deadeye
  // Ranger2: "RANGER", // Arcane Archer
  Ranger3: "RANGER", // Pathfinder
  Monk1: "MONK", // Martial Artist
  Monk2: "MONK", // invoker -- json has master of elements
  Monk3: "MONK", // Acolyte of Chayula
  // Templar1: "TEMPLAR", // Inquisitor
  // Templar2: "TEMPLAR", // Heretic
  // Templar3: "TEMPLAR", // Guardian
  // Shadow1: "SHADOW", // Assassin
  // Shadow2: "SHADOW", // Phantom
  // Shadow3: "SHADOW", // Saboteur
  Warrior1: "WARRIOR", // Titan
  Warrior2: "WARRIOR", // Brute
  Warrior3: "WARRIOR", // Smith of Kitava
  Mercenary1: "MERCENARY", // Tactician
  Mercenary2: "MERCENARY", // Witchhunter
  Mercenary3: "MERCENARY", // Gambler
  Sorceress1: "SORCERESS", // Stormweaver
  Sorceress2: "SORCERESS", // Chronomancer
  Sorceress3: "SORCERESS", // Disciple of Varashta
  // Duelist1: "DUELIST", // Deathmarked
  // Duelist2: "DUELIST", // Gladiator
  // Duelist3: "DUELIST", // Champion
  // Marauder1: "MARAUDER", // Warlord
  // Marauder2: "MARAUDER", // Berserker
  // Marauder3: "MARAUDER", // Chieftain
  Druid1: "DRUID", // Oracle
  Druid2: "DRUID", // Shaman
  // Druid3: "DRUID", // [DNT] Unused
  Huntress1: "HUNTRESS", // Amazon
  // Huntress2: "HUNTRESS", // Beastmaster
  Huntress3: "HUNTRESS", // Ritualist
};

const nodeDisplayValue = (node, selectedClass, field) => {
  if (!selectedClass || !node.options || !node.options[selectedClass]) {
    return node[field];
  }
  return node.options[selectedClass][field] ?? node[field];
};

export const buildNodeIndex = (
  passives,
  tempCoords,
  classRoots,
  selectedClass = null,
) => {
  const index = {};

  const ascendancyAnchors = {};
  for (const p of Object.values(passives)) {
    if (p.is_ascendancy_starting_node && p.ascendancy) {
      ascendancyAnchors[p.ascendancy] = tempCoords[p.hash];
    }
  }

  for (const passive of Object.values(passives)) {
    const id = passive.hash;
    const coords = tempCoords[id];
    if (!coords) continue;

    let finalX = coords.x;
    let finalY = coords.y;

    if (passive.ascendancy) {
      const parentClassName = ASCENDANCY_MAP[passive.ascendancy];
      const targetClassPos = classRoots[parentClassName];
      const myAnchorCoords = ascendancyAnchors[passive.ascendancy];

      if (targetClassPos && myAnchorCoords) {
        const dx = coords.x - myAnchorCoords.x;
        const dy = coords.y - myAnchorCoords.y;

        const angle = Math.atan2(targetClassPos.y, targetClassPos.x);
        const distanceFromRoot = -200;
        const distanceX = Math.cos(angle) * distanceFromRoot;
        const distanceY = Math.sin(angle) * distanceFromRoot;

        finalX = targetClassPos.x + dx + distanceX;
        finalY = targetClassPos.y + dy + distanceY;
      }
    }
    index[id] = {
      id,
      hash: id,
      name: nodeDisplayValue(passive, selectedClass, "name"),
      stats: nodeDisplayValue(passive, selectedClass, "stats") ?? [],
      icon: nodeDisplayValue(passive, selectedClass, "icon") ?? passive.icon,
      options: passive.options || null,
      ascendancy: passive.ascendancy || null,
      type: classifyNode(passive),
      cost: passive.skill_points ?? 1,
      isKeystone: passive.is_keystone,
      isNotable: passive.is_notable,
      isJewel: passive.is_jewel_socket,
      isClassStart: passive.is_class_start,
      isAscendancyStart: passive.is_ascendancy_starting_node,
      x: finalX,
      y: finalY,
      unlockConstraint: passive.unlockConstraint,
    };
  }

  return index;
};

const classifyNode = (p) => {
  if (p.is_keystone) return "keystone";
  if (p.is_notable) return "notable";
  if (p.is_jewel_socket) return "jewel";
  return "small";
};

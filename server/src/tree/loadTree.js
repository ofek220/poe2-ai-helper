import fs from "fs";

const filePath = new URL("../../data/poe2TreeJson.json", import.meta.url);

const raw = fs.readFileSync(filePath, "utf8");

export const treeData = JSON.parse(raw);

console.log("POE2 Tree Loaded!");
console.log("Groups:", treeData.groups.length);
console.log("Passives:", Object.keys(treeData.passives).length);
console.log("notable nodes");

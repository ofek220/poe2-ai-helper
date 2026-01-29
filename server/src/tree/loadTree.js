import fs from "fs";
import { parse } from "jsonc-parser";

const filePath = new URL("../../data/poe2TreeJson.jsonc", import.meta.url);

const raw = fs.readFileSync(filePath, "utf8");

export const treeData = parse(raw);

console.log("POE2 Tree Loaded!");
console.log("Groups:", treeData.groups.length);
console.log("Passives:", Object.keys(treeData.passives).length);

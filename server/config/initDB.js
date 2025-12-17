import fs from "fs";
import pool from "./db.js";

export const initDB = async () => {
  try {
    const schema = fs.readFileSync(
      new URL("./schema.sql", import.meta.url),
      "utf8"
    );
    await pool.query(schema);
    console.log("✅ Database schema loaded successfully!");
  } catch (err) {
    console.error("❌ Error loading schema:", err);
  }
};

import dotenv from "dotenv";
import { join } from "path";
dotenv.config({ path: join(process.cwd(), "../.env") });
console.log("Loaded DATABASE_URL:", process.env.DATABASE_URL);

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("neon")
    ? { rejectUnauthorized: false }
    : false,
});

pool
  .connect()
  .then(() => console.log("✅ Connected to Neon database"))
  .catch((err) => console.error("❌ DB connection error:", err));

export default pool;

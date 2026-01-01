import dotenv from "dotenv";
import { join } from "path";
import pg from "pg";

dotenv.config({ path: join(process.cwd(), "../.env") });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("neon")
    ? { rejectUnauthorized: false }
    : false,
});

(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to the database");
    client.release();
  } catch (err) {
    console.error("❌ Database connection failed", err);
    process.exit(1);
  }
})();

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

export default pool;

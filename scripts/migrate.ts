import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../src/db/index";
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL in .env first.");
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Versioned migrations applied successfully.");
} finally {
  await pool.end();
}

import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? "");
if (
  !testUrl.pathname.endsWith("_test") ||
  !["127.0.0.1", "localhost"].includes(testUrl.hostname)
)
  throw new Error(
    "TEST_DATABASE_URL must point to a local database ending in _test.",
  );
const name = testUrl.pathname.slice(1);
if (!/^[a-z0-9_]+$/.test(name)) throw new Error("Invalid test database name");
const adminUrl = new URL(testUrl);
adminUrl.pathname = "/postgres";
const admin = new Pool({ connectionString: adminUrl.toString() });
try {
  const result = await admin.query(
    "SELECT 1 FROM pg_database WHERE datname=$1",
    [name],
  );
  if (!result.rowCount) await admin.query(`CREATE DATABASE "${name}"`);
} finally {
  await admin.end();
}
const testPool = new Pool({ connectionString: testUrl.toString() });
try {
  await migrate(drizzle(testPool), { migrationsFolder: "./drizzle" });
  console.log("Isolated test database ready.");
} finally {
  await testPool.end();
}

import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const url = new URL(
  process.env.DATABASE_URL ??
    "postgresql://sgi:sgi_local_dev@localhost:54329/sgi_one",
);
if (!["localhost", "127.0.0.1"].includes(url.hostname))
  throw new Error("Temporary PostgreSQL must use localhost.");
const directory = resolve("artifacts/postgres-local");
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  port: Number(url.port),
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(directory, "PG_VERSION"))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const dbName = url.pathname.slice(1);
const result = await client.query(
  "SELECT 1 FROM pg_database WHERE datname=$1",
  [dbName],
);
if (!result.rowCount) await pg.createDatabase(dbName);
await client.end();
console.log(
  `Real PostgreSQL running on localhost:${url.port}; temporary fallback for environments without Docker. Ctrl+C to stop.`,
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 10000);

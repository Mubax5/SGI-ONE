import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

process.chdir(fileURLToPath(new URL(".", import.meta.url)));
for (const name of ["DATABASE_URL", "BETTER_AUTH_URL", "BETTER_AUTH_SECRET"]) {
  if (!process.env[name])
    throw new Error(`Missing application setting: ${name}`);
}
if (process.env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
}
const authUrl = new URL(process.env.BETTER_AUTH_URL);
if (
  authUrl.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(authUrl.hostname)
) {
  throw new Error("BETTER_AUTH_URL must use HTTPS outside local development.");
}
const environment = { ...process.env, NODE_ENV: "production" };
function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${script} failed (${code}).`)),
    );
  });
}
const bootstrapPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 30_000,
  query_timeout: 120_000,
});
const client = await bootstrapPool.connect();
try {
  await client.query("SELECT pg_advisory_lock(7341001)");
  await run("deployment/migrate.mjs");
  if (process.env.DEMO_SEED_ENABLED === "true")
    await run("deployment/seed.mjs");
} finally {
  await client.query("SELECT pg_advisory_unlock(7341001)");
  client.release();
  await bootstrapPool.end();
}
const server = spawn(process.execPath, ["server.js"], {
  env: {
    ...environment,
    HOSTNAME: "0.0.0.0",
    PORT: process.env.PORT || "8080",
  },
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.kill(signal));
server.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.once("exit", (code) => {
  process.exitCode = code ?? 1;
});

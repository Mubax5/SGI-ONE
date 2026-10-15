import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import { build } from "esbuild";

const workspace = resolve(import.meta.dirname, "..");
const destination = resolve(workspace, "artifacts/azure/app");
if (!destination.startsWith(`${workspace}${sep}artifacts${sep}`)) {
  throw new Error("Deployment output must be inside workspace artifacts.");
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(resolve(workspace, ".next/standalone"), destination, {
  recursive: true,
  filter: (source) => !/^\.env(?:\.|$)/.test(basename(source)),
});
for (const [source, target] of [
  [".next/static", ".next/static"],
  ["public", "public"],
  ["drizzle", "drizzle"],
  ["scripts/start-azure.mjs", "start-azure.mjs"],
]) {
  await cp(resolve(workspace, source), resolve(destination, target), {
    recursive: true,
  });
}
await build({
  absWorkingDir: workspace,
  entryPoints: { migrate: "scripts/migrate.ts", seed: "scripts/seed.ts" },
  outdir: resolve(destination, "deployment"),
  outExtension: { ".js": ".mjs" },
  platform: "node",
  target: "node24",
  format: "esm",
  bundle: true,
  external: ["pg"],
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
const metadata = JSON.parse(
  await readFile(resolve(destination, "package.json"), "utf8"),
);
metadata.scripts = { start: "node start-azure.mjs" };
await writeFile(
  resolve(destination, "package.json"),
  `${JSON.stringify(metadata, null, 2)}\n`,
);
console.log(
  "Azure deployment package: artifacts/azure/app (environment files excluded).",
);

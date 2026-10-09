import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(
    ".env",
    template
      .replace(
        "replace-with-a-random-secret-at-least-32-characters",
        randomBytes(48).toString("base64url"),
      )
      .replace("DEMO_PASSWORD=", "DEMO_PASSWORD=SgiDemo2026!")
      .replace("DEMO_SEED_ENABLED=false", "DEMO_SEED_ENABLED=true"),
  );
  console.log(
    "Created local .env with a generated authentication secret and demo seed settings.",
  );
} else console.log("Existing .env preserved.");
console.log(
  "Next: npm run db:up, npm run db:migrate, npm run db:seed, npm run dev. Configure private R2 credentials in .env for file operations.",
);

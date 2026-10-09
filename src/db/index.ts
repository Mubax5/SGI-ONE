import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { sgiPool?: Pool };
export const pool =
  globalDb.sgiPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
if (process.env.NODE_ENV !== "production") globalDb.sgiPool = pool;
export const db = drizzle(pool, { schema });
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

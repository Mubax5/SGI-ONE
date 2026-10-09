import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { user, session, account, verification, rateLimit } from "@/db/schema";
export const auth = betterAuth({
  appName: "SGI One",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:4310",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, rateLimit },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 30,
    cookieCache: { enabled: false },
  },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
  advanced: {
    useSecureCookies:
      process.env.BETTER_AUTH_URL?.startsWith("https://") ?? false,
  },
});

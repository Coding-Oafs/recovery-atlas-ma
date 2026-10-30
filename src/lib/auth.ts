import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { Pool } from "pg";
import { publicSiteUrl } from "./site";
import { createHmac, randomUUID } from "node:crypto";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : publicSiteUrl);
const connectionString = process.env.DATABASE_URL?.replace(
  /sslmode=require\b/,
  "sslmode=verify-full",
);
const pool = new Pool({
  connectionString,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});
function buildAuth() {
  return betterAuth({
    appName: "Recovery Atlas",
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET,
    database: pool,
    trustedOrigins: [new URL(baseURL).origin],
    user: { modelName: "atlas_user", deleteUser: { enabled: true } },
    session: {
      modelName: "atlas_session",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
      cookieCache: { enabled: false },
    },
    account: { modelName: "atlas_account" },
    verification: { modelName: "atlas_verification" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 15,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "atlas_auth_rate_limit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/username": { window: 60, max: 8 },
        "/sign-up/email": { window: 600, max: 5 },
      },
      customStorage: {
        async consume(key, rule) {
          const hash = createHmac(
              "sha256",
              process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET!,
            )
              .update("auth:" + key)
              .digest("hex"),
            now = Date.now(),
            cutoff = now - rule.window * 1000;
          const { rows } = await pool.query(
            'INSERT INTO atlas_auth_rate_limit(id,key,count,"lastRequest") VALUES($1,$2,1,$3) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN atlas_auth_rate_limit."lastRequest"<$4 THEN 1 ELSE atlas_auth_rate_limit.count+1 END,"lastRequest"=CASE WHEN atlas_auth_rate_limit."lastRequest"<$4 THEN $3 ELSE atlas_auth_rate_limit."lastRequest" END RETURNING count,"lastRequest"',
            [randomUUID(), hash, now, cutoff],
          );
          return {
            allowed: rows[0].count <= rule.max,
            retryAfter:
              rows[0].count <= rule.max
                ? null
                : Math.max(
                    1,
                    Math.ceil(
                      (Number(rows[0].lastRequest) + rule.window * 1000 - now) /
                        1000,
                    ),
                  ),
          };
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => ({
            data: { ...session, ipAddress: null, userAgent: null },
          }),
        },
      },
    },
    advanced: {
      cookiePrefix: "recovery-atlas",
      defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (value) => /^[a-z0-9_]{3,30}$/i.test(value),
      }),
      passkey({
        rpName: "Recovery Atlas",
        rpID: new URL(baseURL).hostname,
        origin: new URL(baseURL).origin,
        schema: { passkey: { modelName: "atlas_passkey" } },
        advanced: { webAuthnChallengeCookie: "recovery-atlas-passkey" },
      }),
    ],
  });
}
let instance: ReturnType<typeof buildAuth> | undefined;
export function getAuth() {
  return (instance ??= buildAuth());
}

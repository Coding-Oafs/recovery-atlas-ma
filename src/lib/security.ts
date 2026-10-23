import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
export function equal(a: string, b: string) {
  const x = createHash("sha256").update(a).digest(),
    y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}
function sign(value: string) {
  if (!process.env.SESSION_SECRET) throw Error("Session secret not configured");
  return createHmac("sha256", process.env.SESSION_SECRET)
    .update(value)
    .digest("hex");
}
export function createSession() {
  const expires = String(Date.now() + 8 * 3600000);
  return `${expires}.${sign(expires)}`;
}
export function validSession(token: string) {
  if (!process.env.SESSION_SECRET) return false;
  const [time, sig] = token.split(".");
  return (
    !!sig &&
    /^\d+$/.test(time) &&
    Number(time) > Date.now() &&
    Number(time) < Date.now() + 9 * 3600000 &&
    equal(sig, sign(time))
  );
}
export async function isAdmin() {
  return validSession((await cookies()).get("atlas_admin")?.value ?? "");
}
export async function assertAdmin() {
  if (!(await isAdmin())) throw Error("Unauthorized");
}
export async function sameOrigin() {
  const h = await headers(),
    origin = h.get("origin");
  if (!origin) return false;
  try {
    const target = new URL(origin);
    const configured = process.env.APP_ORIGIN
      ? new URL(process.env.APP_ORIGIN).host
      : null;
    return (
      target.host === (h.get("x-forwarded-host") ?? h.get("host")) ||
      target.host === configured
    );
  } catch {
    return false;
  }
}
export async function rateLimit(scope: string, max: number, minutes = 60) {
  const h = await headers(),
    ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = createHmac(
    "sha256",
    process.env.SESSION_SECRET ?? "local-development",
  )
    .update(`${scope}:${ip}`)
    .digest("hex");
  const rows =
    await db()`INSERT INTO rate_limits(key,count,expires_at) VALUES(${key},1,now()+${minutes}*interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.expires_at<now() THEN 1 ELSE rate_limits.count+1 END, expires_at=CASE WHEN rate_limits.expires_at<now() THEN now()+${minutes}*interval '1 minute' ELSE rate_limits.expires_at END RETURNING count`;
  return rows[0].count <= max;
}

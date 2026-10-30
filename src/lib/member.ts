import "server-only";
import { headers } from "next/headers";
import { getAuth } from "./auth";
export async function member() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Robots-Tag": "noindex, nofollow",
};

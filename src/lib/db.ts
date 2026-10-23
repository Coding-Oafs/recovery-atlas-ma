import "server-only";
import { neon } from "@neondatabase/serverless";
import { unstable_cache } from "next/cache";
import seed from "../../data/resources.json";
import { resourceSchema, type Resource } from "./types";
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  return neon(process.env.DATABASE_URL);
}
export const getResources = unstable_cache(
  async (): Promise<{
    resources: Resource[];
    mode: "database" | "snapshot";
  }> => {
    if (!process.env.DATABASE_URL)
      return {
        resources: seed.map((r) => resourceSchema.parse(r)),
        mode: "snapshot",
      };
    try {
      const rows =
        await db()`SELECT data FROM resources WHERE published = true ORDER BY data->>'name' LIMIT 50`;
      return {
        resources: rows.map((r) => resourceSchema.parse(r.data)),
        mode: "database",
      };
    } catch {
      console.error("Directory read failed; serving dated public snapshot");
      return {
        resources: seed.map((r) => resourceSchema.parse(r)),
        mode: "snapshot",
      };
    }
  },
  ["public-directory-v2"],
  { revalidate: 300, tags: ["resources"] },
);

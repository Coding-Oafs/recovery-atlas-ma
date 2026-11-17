import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { bundledResources } from "./catalog";
import { regionStates } from "./region";
import manifest from "../../data/national-manifest.json";
export const getCoverage = unstable_cache(
  async () => {
    if (!process.env.DATABASE_URL) {
      const rows = bundledResources();
      return {
        reviewedAt: manifest.generatedAt,
        mode: "snapshot",
        total: rows.length,
        mapped: rows.filter((r) => r.lat !== null).length,
        nationalOnline: rows.filter(
          (r) =>
            r.state === "US" &&
            r.kind === "meeting" &&
            r.formats.includes("online"),
        ).length,
        states: regionStates.map((state) => ({
          state,
          listings: rows.filter((r) => r.state === state).length,
          mapped: rows.filter((r) => r.state === state && r.lat !== null)
            .length,
          meetings: rows.filter((r) => r.state === state && r.meeting).length,
          aaPhysical: rows.filter(
            (r) =>
              r.state === state &&
              r.fellowship === "AA" &&
              r.formats.includes("in-person"),
          ).length,
          providers: rows.filter(
            (r) => r.state === state && r.kind === "provider",
          ).length,
          treatment: rows.filter(
            (r) => r.state === state && r.categories.includes("treatment"),
          ).length,
          mentalHealth: rows.filter(
            (r) => r.state === state && r.categories.includes("mental-health"),
          ).length,
          counseling: rows.filter(
            (r) => r.state === state && r.categories.includes("counseling"),
          ).length,
          support: rows.filter(
            (r) => r.state === state && r.categories.includes("support"),
          ).length,
        })),
        approaches: [
          ...new Set(rows.filter((r) => r.meeting).map((r) => r.fellowship)),
        ].map((name) => ({
          name,
          listings: rows.filter((r) => r.meeting && r.fellowship === name)
            .length,
        })),
      };
    }
    const sql = db();
    const [states, approaches] = await Promise.all([
      sql`SELECT resource_state AS state,count(*)::int AS listings,count(location)::int AS mapped,count(*) FILTER(WHERE resource_kind='meeting')::int AS meetings,count(*) FILTER(WHERE data->>'fellowship'='AA' AND data->'formats' ? 'in-person')::int AS "aaPhysical",count(*) FILTER(WHERE resource_kind='provider')::int AS providers,count(*) FILTER(WHERE data->'categories' ? 'treatment')::int AS treatment,count(*) FILTER(WHERE data->'categories' ? 'mental-health')::int AS "mentalHealth",count(*) FILTER(WHERE data->'categories' ? 'counseling')::int AS counseling,count(*) FILTER(WHERE data->'categories' ? 'support')::int AS support FROM resources WHERE published GROUP BY resource_state`,
      sql`SELECT data->>'fellowship' AS name,count(*)::int AS listings FROM resources WHERE published AND resource_kind='meeting' GROUP BY 1`,
    ]);
    const jurisdictions = regionStates.map(
      (state) =>
        states.find((r) => r.state === state) ?? {
          state,
          listings: 0,
          mapped: 0,
          meetings: 0,
          aaPhysical: 0,
          providers: 0,
          treatment: 0,
          mentalHealth: 0,
          counseling: 0,
          support: 0,
        },
    );
    return {
      reviewedAt: new Date().toISOString().slice(0, 10),
      mode: "database",
      total: states.reduce((n, s) => n + Number(s.listings), 0),
      mapped: states.reduce((n, s) => n + Number(s.mapped), 0),
      nationalOnline: Number(
        states.find((s) => s.state === "US")?.listings || 0,
      ),
      states: jurisdictions,
      approaches,
    };
  },
  ["national-coverage-v3-attendance"],
  { revalidate: 300, tags: ["resources"] },
);

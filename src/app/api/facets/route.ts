import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { bundledResources } from "@/lib/catalog";
const facets = unstable_cache(
  async () => {
    if (!process.env.DATABASE_URL)
      return Object.fromEntries(
        ["services", "languages", "populations", "payment"].map((k) => [
          k,
          [
            ...new Set(
              bundledResources().flatMap(
                (r) =>
                  r[k as "services" | "languages" | "populations" | "payment"],
              ),
            ),
          ].sort(),
        ]),
      );
    const [cached] =
      await db()`SELECT data FROM atlas_directory_stats WHERE id='facets'`;
    if (cached) return cached.data;
    const rows =
      await db()`SELECT k.field,jsonb_agg(DISTINCT v.value ORDER BY v.value) AS values FROM resources r CROSS JOIN LATERAL(VALUES('services',r.data->'services'),('languages',r.data->'languages'),('populations',r.data->'populations'),('payment',r.data->'payment')) k(field,items) CROSS JOIN LATERAL jsonb_array_elements_text(k.items) v(value) WHERE r.published=true GROUP BY k.field`;
    const result = Object.fromEntries(rows.map((r) => [r.field, r.values]));
    const insurance =
      await db()`SELECT DISTINCT i->>'name' AS name FROM resources CROSS JOIN LATERAL jsonb_array_elements(data->'insurance') i WHERE published=true`;
    result.payment = [
      ...new Set([...(result.payment ?? []), ...insurance.map((r) => r.name)]),
    ].sort();
    return result;
  },
  ["directory-facets-v2-national-meetings"],
  { revalidate: 3600, tags: ["resources"] },
);
export async function GET() {
  try {
    return NextResponse.json(await facets(), {
      headers: { "Cache-Control": "public, s-maxage=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Filter options unavailable" },
      { status: 503 },
    );
  }
}

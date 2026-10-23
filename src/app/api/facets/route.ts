import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
const facets = unstable_cache(
  async () => {
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
  ["directory-facets-v1"],
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

import { NextRequest, NextResponse } from "next/server";
import { mapInput } from "@/lib/search-input";
import { sameOrigin, rateLimit } from "@/lib/security";
import { queryDirectory } from "@/lib/directory-query";
export async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const parsed = mapInput.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid map request" },
        { status: 400 },
      );
    if (!(await rateLimit("map", 600, 10)))
      return NextResponse.json(
        { error: "Please pause before moving the map again." },
        { status: 429 },
      );
    const { filters, saved, bounds, zoom } = parsed.data;
    return NextResponse.json(
      await queryDirectory(filters, saved, 1, { map: { bounds, zoom } }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Map results temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}

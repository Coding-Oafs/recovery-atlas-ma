import { NextRequest, NextResponse } from "next/server";
import { getCountyCoverage, countyOptions } from "@/lib/county-coverage";
import { isRegionState } from "@/lib/region";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams,
    state = p.get("state") || "";
  if (state && !isRegionState(state))
    return NextResponse.json(
      { error: "Invalid jurisdiction" },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      p.get("list") === "1"
        ? { counties: countyOptions(state) }
        : await getCountyCoverage({
            state,
            query: (p.get("q") || "").slice(0, 100),
            page: Math.max(1, Math.min(200, Number(p.get("page")) || 1)),
            program: p.get("program") || "aaPhysical",
            missing: p.get("missing") === "yes",
          }),
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json(
      { error: "County coverage is temporarily unavailable." },
      { status: 503 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { searchInput as input } from "@/lib/search-input";
import { sameOrigin, rateLimit } from "@/lib/security";
import { queryDirectory } from "@/lib/directory-query";
import { gzipSync } from "node:zlib";
export async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid search filters" },
        { status: 400 },
      );
    if (!(await rateLimit("search", 180, 10)))
      return NextResponse.json(
        { error: "Please pause before searching again." },
        { status: 429 },
      );
    const { filters, saved, limit, offset } = parsed.data;
    const body = gzipSync(
      JSON.stringify(await queryDirectory(filters, saved, limit, { offset })),
    );
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
        "Cache-Control": "no-store",
        Vary: "Accept-Encoding",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Search is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}

import { NextResponse } from "next/server";
import { getCoverage } from "@/lib/coverage";
export async function GET() {
  try {
    return NextResponse.json(await getCoverage(), {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Coverage counts are temporarily unavailable." },
      { status: 503 },
    );
  }
}

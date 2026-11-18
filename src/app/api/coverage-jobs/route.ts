import { NextRequest, NextResponse } from "next/server";
import { authorizeCron } from "@/lib/security";
import { db } from "@/lib/db";
import { refreshDirectoryStats } from "@/lib/refresh-directory-stats";
import { revalidateTag } from "next/cache";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  if (!authorizeCron(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = db();
    const coverage = await refreshDirectoryStats(sql);
    revalidateTag("resources", "max");
    return NextResponse.json({
      total: coverage.total,
      generatedAt: coverage.reviewedAt,
    });
  } catch (error) {
    console.error("Directory coverage refresh failed", error);
    return NextResponse.json(
      { error: "Coverage aggregate refresh unavailable" },
      { status: 503 },
    );
  }
}

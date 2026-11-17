import { NextRequest, NextResponse } from "next/server";
import { equal } from "@/lib/security";
import { db } from "@/lib/db";
import { refreshDirectoryStats } from "@/lib/refresh-directory-stats";
import { refreshCityCoverage } from "@/lib/refresh-city-coverage";
import { refreshCountyCoverage } from "@/lib/refresh-county-coverage";
import { revalidateTag } from "next/cache";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !equal(
      request.headers.get("authorization") || "",
      "Bearer " + process.env.CRON_SECRET,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const sql = db();
    await refreshCountyCoverage(sql);
    await refreshCityCoverage(sql);
    const coverage = await refreshDirectoryStats(sql);
    revalidateTag("resources", "max");
    return NextResponse.json({
      total: coverage.total,
      generatedAt: coverage.reviewedAt,
    });
  } catch {
    return NextResponse.json(
      { error: "Coverage aggregate refresh unavailable" },
      { status: 503 },
    );
  }
}

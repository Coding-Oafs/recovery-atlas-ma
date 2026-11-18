import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authorizeCron } from "@/lib/security";
import { db } from "@/lib/db";
import { refreshCityCoverage } from "@/lib/refresh-city-coverage";
import { refreshCountyCoverage } from "@/lib/refresh-county-coverage";

export const maxDuration = 300;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scope: string }> },
) {
  if (!authorizeCron(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scope } = await params;
  if (scope !== "city" && scope !== "county")
    return NextResponse.json(
      { error: "Unknown coverage scope" },
      { status: 404 },
    );

  try {
    const sql = db();
    const assignments =
      scope === "county"
        ? await refreshCountyCoverage(sql, 10000)
        : await refreshCityCoverage(sql);
    revalidateTag("resources", "max");
    return NextResponse.json({
      scope,
      assignments,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`Coverage refresh failed for ${scope}`, error);
    return NextResponse.json(
      { error: "Coverage refresh unavailable" },
      { status: 503 },
    );
  }
}

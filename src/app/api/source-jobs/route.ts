import { NextRequest, NextResponse } from "next/server";
import { equal } from "@/lib/security";
import { runSourceJobs } from "@/lib/source-jobs";
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
    const results = await runSourceJobs();
    revalidateTag("resources", "max");
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Source queue unavailable" },
      { status: 503 },
    );
  }
}

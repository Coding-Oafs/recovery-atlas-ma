import { NextRequest, NextResponse } from "next/server";
import { equal } from "@/lib/security";
import { checkSources } from "@/lib/maintenance";
export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !equal(
      request.headers.get("authorization") ?? "",
      `Bearer ${process.env.CRON_SECRET}`,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ checked: await checkSources() });
  } catch {
    return NextResponse.json(
      { error: "Source checks failed" },
      { status: 503 },
    );
  }
}

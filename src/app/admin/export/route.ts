import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/security";
import { db } from "@/lib/db";
export async function GET() {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db()`SELECT data FROM resources ORDER BY id`;
  return new Response(
    JSON.stringify(
      rows.map((r) => r.data),
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="recovery-atlas-resources.json"',
        "Cache-Control": "no-store",
      },
    },
  );
}

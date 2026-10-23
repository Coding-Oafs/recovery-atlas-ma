import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/security";
import { db } from "@/lib/db";
export async function GET(request: Request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const after = new URL(request.url).searchParams.get("after") ?? "";
  const rows =
    await db()`SELECT id,data FROM resources WHERE id>${after} ORDER BY id LIMIT 1000`;
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
        "X-Next-Cursor": rows.length === 1000 ? rows.at(-1)!.id : "",
      },
    },
  );
}

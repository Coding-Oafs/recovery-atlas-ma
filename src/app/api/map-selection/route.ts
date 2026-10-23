import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sameOrigin } from "@/lib/security";
export async function POST(req: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const data = await req.json();
    if (
      !Array.isArray(data.ids) ||
      data.ids.length > 100 ||
      !data.ids.every(
        (x: unknown) => typeof x === "string" && /^[a-z0-9-]{1,150}$/.test(x),
      )
    )
      return NextResponse.json({ error: "Invalid selection" }, { status: 400 });
    const rows =
      await db()`SELECT id,data->>'name' AS name FROM resources WHERE id=ANY(${data.ids}::text[]) AND published=true ORDER BY data->>'name'`;
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(
      { error: "Selection unavailable" },
      { status: 503 },
    );
  }
}

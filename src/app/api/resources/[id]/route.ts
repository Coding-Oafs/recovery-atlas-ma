import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,150}$/.test(id))
    return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
  try {
    const rows =
      await db()`SELECT data FROM resources WHERE id=${id} AND published=true`;
    if (!rows.length)
      return NextResponse.json(
        { error: "Resource not found" },
        { status: 404 },
      );
    return NextResponse.json(rows[0].data, {
      headers: { "Cache-Control": "public, s-maxage=120" },
    });
  } catch {
    return NextResponse.json(
      { error: "Resource unavailable" },
      { status: 503 },
    );
  }
}

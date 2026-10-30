import { NextResponse } from "next/server";
import { member, privateHeaders } from "@/lib/member";
import { db } from "@/lib/db";
export async function GET() {
  try {
    const user = await member();
    if (!user)
      return NextResponse.json(
        { moderator: false },
        { headers: privateHeaders },
      );
    const [row] =
      await db()`SELECT 1 FROM atlas_community_role WHERE user_id=${user.id}`;
    return NextResponse.json({ moderator: !!row }, { headers: privateHeaders });
  } catch {
    return NextResponse.json(
      { error: "Status unavailable" },
      { status: 503, headers: privateHeaders },
    );
  }
}

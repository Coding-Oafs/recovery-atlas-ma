import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { privateHeaders } from "@/lib/member";
import { communityMember, requireAdult, CommunityError } from "@/lib/community";
import { rateLimit } from "@/lib/security";
export async function GET(request: NextRequest) {
  try {
    const { user, profile } = await communityMember();
    requireAdult(profile);
    if (!(await rateLimit("people:" + user.id, 60, 10)))
      return NextResponse.json(
        { error: "Please pause before searching again." },
        { status: 429, headers: privateHeaders },
      );
    const q = (request.nextUrl.searchParams.get("q") ?? "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(q))
      return NextResponse.json({ people: [] }, { headers: privateHeaders });
    const people =
      await db()`SELECT user_id AS id,handle,display_name AS "displayName",bio,region,languages,accepts_requests AS "acceptsRequests" FROM atlas_profile p WHERE p.user_id<>${user.id} AND p.discoverable AND p.adult_confirmed AND p.guidelines_at IS NOT NULL AND NOT p.suspended AND p.handle LIKE ${q.replace(/_/g, "\\_") + "%"} AND NOT EXISTS(SELECT 1 FROM atlas_block b WHERE (b.blocker=${user.id} AND b.blocked=p.user_id) OR (b.blocked=${user.id} AND b.blocker=p.user_id)) ORDER BY p.handle LIMIT 20`;
    return NextResponse.json({ people }, { headers: privateHeaders });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "People search unavailable.",
      },
      {
        status: e instanceof CommunityError ? e.status : 503,
        headers: privateHeaders,
      },
    );
  }
}

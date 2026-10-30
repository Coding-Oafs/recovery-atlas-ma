import { NextRequest, NextResponse } from "next/server";
import { communityMember, CommunityError, profileInput } from "@/lib/community";
import { privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
import { db } from "@/lib/db";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: privateHeaders });
export async function GET() {
  try {
    const { profile } = await communityMember();
    return reply({ profile: profile ?? null });
  } catch (e) {
    return reply(
      {
        error: e instanceof CommunityError ? e.message : "Profile unavailable.",
      },
      e instanceof CommunityError ? e.status : 503,
    );
  }
}
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const { user } = await communityMember();
    if (!(await rateLimit("profile:" + user.id, 30, 10)))
      return reply(
        { error: "Please wait before updating your profile again." },
        429,
      );
    const body = profileInput.parse(await request.json());
    if (
      (body.discoverable || body.acceptsRequests) &&
      (!body.adultConfirmed || !body.guidelinesAccepted)
    )
      return reply(
        {
          error:
            "Community discovery and messaging are for adults who accept the guidelines.",
        },
        400,
      );
    const [row] =
      await db()`INSERT INTO atlas_profile(user_id,handle,display_name,bio,region,languages,discoverable,accepts_requests,adult_confirmed,guidelines_at) VALUES(${user.id},${user.username ?? user.name},${body.displayName},${body.bio},${body.region},${body.languages}::text[],${body.discoverable},${body.acceptsRequests},${body.adultConfirmed},CASE WHEN ${body.guidelinesAccepted} THEN now() ELSE NULL END) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,bio=EXCLUDED.bio,region=EXCLUDED.region,languages=EXCLUDED.languages,discoverable=EXCLUDED.discoverable,accepts_requests=EXCLUDED.accepts_requests,adult_confirmed=EXCLUDED.adult_confirmed,guidelines_at=EXCLUDED.guidelines_at,updated_at=now() RETURNING *`;
    return reply({ profile: row });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "Could not save your profile. Check the fields and try again.",
      },
      e instanceof CommunityError ? e.status : 400,
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
import {
  communityMember,
  ownConversation,
  encryptPrivate,
  decryptPrivate,
  CommunityError,
} from "@/lib/community";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
export async function GET() {
  try {
    const { user } = await communityMember();
    const blocked =
      await db()`SELECT b.blocked AS id,p.handle,p.display_name AS "displayName" FROM atlas_block b LEFT JOIN atlas_profile p ON p.user_id=b.blocked WHERE b.blocker=${user.id} ORDER BY b.created_at DESC LIMIT 200`;
    return reply({ blocked });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "Safety settings unavailable.",
      },
      e instanceof CommunityError ? e.status : 503,
    );
  }
}
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const { user } = await communityMember();
    if (!(await rateLimit("community-safety:" + user.id, 30, 60)))
      throw new CommunityError("Please wait before submitting again.", 429);
    const body = z
      .discriminatedUnion("action", [
        z.object({
          action: z.literal("block"),
          userId: z.string().max(128),
          blocked: z.boolean(),
        }),
        z.object({
          action: z.literal("report"),
          conversationId: z.uuid(),
          messageId: z.string().regex(/^\d{1,20}$/),
          reason: z.string().trim().min(5).max(1000),
        }),
      ])
      .parse(await request.json());
    const sql = db();
    if (body.action === "block") {
      if (body.userId === user.id) throw new CommunityError("Invalid member.");
      if (body.blocked)
        await sql`INSERT INTO atlas_block(blocker,blocked) SELECT ${user.id},id FROM atlas_user WHERE id=${body.userId} ON CONFLICT DO NOTHING`;
      else
        await sql`DELETE FROM atlas_block WHERE blocker=${user.id} AND blocked=${body.userId}`;
      return reply({ ok: true });
    }
    const c = await ownConversation(body.conversationId, user.id);
    const [message] =
      await sql`SELECT sender_id,body_encrypted,created_at FROM atlas_message WHERE id=${body.messageId}::bigint AND conversation_id=${body.conversationId}::uuid`;
    if (!message || message.sender_id === user.id)
      throw new CommunityError("Choose a message you received.");
    const evidence = encryptPrivate(
      JSON.stringify({
        message: decryptPrivate(message.body_encrypted),
        sentAt: message.created_at,
        conversationId: c.id,
      }),
    );
    await sql`INSERT INTO atlas_community_report(reporter_id,subject_id,reason,evidence_encrypted) VALUES(${user.id},${message.sender_id},${body.reason},${evidence})`;
    return reply({ ok: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "Could not save this safety request.",
      },
      e instanceof CommunityError ? e.status : 400,
    );
  }
}

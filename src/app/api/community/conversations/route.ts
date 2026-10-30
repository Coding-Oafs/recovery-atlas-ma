import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
import {
  communityMember,
  requireAdult,
  encryptPrivate,
  CommunityError,
} from "@/lib/community";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
export async function GET() {
  try {
    const { user, profile } = await communityMember();
    requireAdult(profile);
    const rows =
      await db()`SELECT c.id,c.status,c.requester=${user.id} AS outgoing,c.updated_at AS "updatedAt",(SELECT count(*)::int FROM atlas_message m WHERE m.conversation_id=c.id AND m.sender_id<>${user.id} AND m.id>COALESCE((SELECT last_message_id FROM atlas_message_read WHERE user_id=${user.id} AND conversation_id=c.id),0)) AS unread,p.display_name AS "displayName",p.handle,p.user_id AS "peerId",EXISTS(SELECT 1 FROM atlas_block b WHERE (b.blocker=${user.id} AND b.blocked=p.user_id) OR (b.blocked=${user.id} AND b.blocker=p.user_id)) AS blocked FROM atlas_conversation c JOIN atlas_profile p ON p.user_id=CASE WHEN c.requester=${user.id} THEN c.recipient ELSE c.requester END WHERE (c.requester=${user.id} OR c.recipient=${user.id}) ORDER BY c.updated_at DESC LIMIT 100`;
    return reply({ conversations: rows });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "Conversations unavailable.",
      },
      e instanceof CommunityError ? e.status : 503,
    );
  }
}
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const { user, profile } = await communityMember();
    requireAdult(profile);
    if (!(await rateLimit("request:" + user.id, 10, 60)))
      return reply(
        { error: "Please wait before sending another request." },
        429,
      );
    const body = z
      .object({
        recipient: z.string().min(1).max(128),
        intro: z.string().trim().min(1).max(400),
      })
      .parse(await request.json());
    if (body.recipient === user.id)
      throw new CommunityError("Choose another member.");
    if (/https?:\/\/|www\./i.test(body.intro))
      throw new CommunityError("Keep first requests free of links.");
    const sql = db(),
      intro = encryptPrivate(body.intro);
    const result = await sql.transaction([
      sql`SELECT id FROM atlas_user WHERE id=${user.id} FOR UPDATE`,
      sql`WITH eligible AS(SELECT p.user_id FROM atlas_profile p WHERE p.user_id=${body.recipient} AND p.discoverable AND p.accepts_requests AND p.adult_confirmed AND p.guidelines_at IS NOT NULL AND NOT p.suspended AND NOT EXISTS(SELECT 1 FROM atlas_block b WHERE (b.blocker=${user.id} AND b.blocked=p.user_id) OR (b.blocked=${user.id} AND b.blocker=p.user_id)) AND (SELECT count(*) FROM atlas_conversation WHERE requester=${user.id} AND created_at>now()-interval '1 day')<10),added AS(INSERT INTO atlas_conversation(requester,recipient) SELECT ${user.id},user_id FROM eligible ON CONFLICT DO NOTHING RETURNING id),message AS(INSERT INTO atlas_message(conversation_id,sender_id,body_encrypted) SELECT id,${user.id},${intro} FROM added RETURNING conversation_id) SELECT conversation_id AS id FROM message`,
    ]);
    const row = result[1][0];
    if (!row) {
      const [existing] =
        await sql`SELECT id,status FROM atlas_conversation WHERE (requester=${user.id} AND recipient=${body.recipient}) OR (recipient=${user.id} AND requester=${body.recipient})`;
      if (existing) return reply({ id: existing.id, status: existing.status });
      throw new CommunityError(
        "This member cannot receive your request, or the daily request limit has been reached.",
      );
    }
    return reply({ id: row.id, status: "pending" }, 201);
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "Could not send the request. Check your message and try again.",
      },
      e instanceof CommunityError ? e.status : 400,
    );
  }
}

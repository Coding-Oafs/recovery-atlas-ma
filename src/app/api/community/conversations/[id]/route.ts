import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
import {
  communityMember,
  requireAdult,
  ownConversation,
  decryptPrivate,
  encryptPrivate,
  CommunityError,
} from "@/lib/community";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, profile } = await communityMember();
    requireAdult(profile);
    const { id } = await params,
      conversation = await ownConversation(id, user.id);
    if (conversation.blocked)
      throw new CommunityError("This conversation is blocked.", 403);
    const before = request.nextUrl.searchParams.get("before") ?? "",
      after = request.nextUrl.searchParams.get("after") ?? "";
    if (
      (before && !/^\d{1,18}$/.test(before)) ||
      (after && !/^\d{1,18}$/.test(after)) ||
      (before && after)
    )
      throw new CommunityError("Invalid page.");
    const sql = db();
    const rows = after
      ? await sql`SELECT id::text,sender_id AS "senderId",body_encrypted,created_at AS "createdAt" FROM atlas_message WHERE conversation_id=${id}::uuid AND id>${after}::bigint ORDER BY id ASC LIMIT 51`
      : await sql`SELECT id::text,sender_id AS "senderId",body_encrypted,created_at AS "createdAt" FROM atlas_message WHERE conversation_id=${id}::uuid AND (${before}='' OR id<NULLIF(${before},'')::bigint) ORDER BY id DESC LIMIT 51`;
    const page = rows.slice(0, 50);
    if (!after) page.reverse();
    return reply({
      status: conversation.status,
      outgoing: conversation.requester === user.id,
      messages: page.map((r) => ({
        id: r.id,
        mine: r.senderId === user.id,
        body: decryptPrivate(r.body_encrypted),
        createdAt: r.createdAt,
      })),
      older: !after && rows.length > 50 ? rows[49].id : null,
      moreAfter: !!after && rows.length > 50 ? rows[49].id : null,
    });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError ? e.message : "Messages unavailable.",
      },
      e instanceof CommunityError ? e.status : 503,
    );
  }
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const { user, profile } = await communityMember();
    requireAdult(profile);
    const { id } = await params,
      conversation = await ownConversation(id, user.id);
    if (conversation.blocked)
      throw new CommunityError("This conversation is blocked.", 403);
    const body = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("respond"), accept: z.boolean() }),
        z.object({
          action: z.literal("read"),
          messageId: z.string().regex(/^\d{1,18}$/),
        }),
        z.object({
          action: z.literal("message"),
          body: z.string().trim().min(1).max(2000),
        }),
      ])
      .parse(await request.json());
    const sql = db();
    if (body.action === "read") {
      await sql`INSERT INTO atlas_message_read(user_id,conversation_id,last_message_id) SELECT ${user.id},${id}::uuid,id FROM atlas_message WHERE id=${body.messageId}::bigint AND conversation_id=${id}::uuid ON CONFLICT(user_id,conversation_id) DO UPDATE SET last_message_id=GREATEST(atlas_message_read.last_message_id,excluded.last_message_id)`;
      return reply({ ok: true });
    }
    if (body.action === "respond") {
      if (
        conversation.recipient !== user.id ||
        conversation.status !== "pending"
      )
        throw new CommunityError(
          "Only the recipient can respond to a pending request.",
          403,
        );
      await sql`UPDATE atlas_conversation SET status=${body.accept ? "accepted" : "declined"},updated_at=now() WHERE id=${id}::uuid AND recipient=${user.id} AND status='pending'`;
      return reply({ ok: true });
    }
    if (conversation.status !== "accepted")
      throw new CommunityError(
        "Wait until this request is accepted before sending more messages.",
        403,
      );
    if (!(await rateLimit("message:" + user.id, 30, 10)))
      throw new CommunityError(
        "Please pause before sending more messages.",
        429,
      );
    const encrypted = encryptPrivate(body.body);
    const result = await sql.transaction([
      sql`SELECT id FROM atlas_conversation WHERE id=${id}::uuid FOR UPDATE`,
      sql`INSERT INTO atlas_message(conversation_id,sender_id,body_encrypted) SELECT c.id,${user.id},${encrypted} FROM atlas_conversation c WHERE c.id=${id}::uuid AND c.status='accepted' AND (${user.id}=c.requester OR ${user.id}=c.recipient) AND NOT EXISTS(SELECT 1 FROM atlas_block b WHERE (b.blocker=c.requester AND b.blocked=c.recipient) OR (b.blocker=c.recipient AND b.blocked=c.requester)) AND (SELECT count(*) FROM atlas_profile WHERE user_id IN(c.requester,c.recipient) AND NOT suspended AND adult_confirmed AND guidelines_at IS NOT NULL)=2 AND (SELECT count(*) FROM atlas_message WHERE sender_id=${user.id} AND created_at>now()-interval '1 hour')<100 RETURNING id`,
      sql`UPDATE atlas_conversation SET updated_at=now() WHERE id=${id}::uuid`,
    ]);
    if (!result[1].length)
      throw new CommunityError(
        "The message could not be sent. This conversation may be unavailable or a sending limit was reached.",
        403,
      );
    return reply({ ok: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CommunityError
            ? e.message
            : "Message could not be sent. Check its length and try again.",
      },
      e instanceof CommunityError ? e.status : 400,
    );
  }
}

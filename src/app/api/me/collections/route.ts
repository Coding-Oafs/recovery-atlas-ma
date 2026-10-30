import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { member, privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
export async function GET() {
  try {
    const user = await member();
    if (!user)
      return reply({ error: "Sign in to organize saved resources." }, 401);
    const sql = db(),
      [collections, items] = await Promise.all([
        sql`SELECT id,name FROM atlas_saved_collection WHERE user_id=${user.id} ORDER BY name`,
        sql`SELECT s.resource_id AS id,s.collection_id AS "collectionId",r.resource_name AS name FROM atlas_saved_resource s JOIN resources r ON r.id=s.resource_id WHERE s.user_id=${user.id} ORDER BY r.resource_name`,
      ]);
    return reply({ collections, items });
  } catch {
    return reply({ error: "Saved lists unavailable." }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const user = await member();
    if (!user) return reply({ error: "Sign in first." }, 401);
    if (!(await rateLimit("collections:" + user.id, 120, 10)))
      return reply({ error: "Please pause before changing lists again." }, 429);
    const body = z
        .discriminatedUnion("action", [
          z.object({
            action: z.literal("create"),
            name: z.string().trim().min(1).max(60),
          }),
          z.object({ action: z.literal("delete"), id: z.uuid() }),
          z.object({
            action: z.literal("assign"),
            resourceId: z.string().regex(/^[a-z0-9-]{1,150}$/),
            collectionId: z.uuid().nullable(),
          }),
        ])
        .parse(await request.json()),
      sql = db();
    if (body.action === "create") {
      const r = await sql.transaction([
        sql`SELECT id FROM atlas_user WHERE id=${user.id} FOR UPDATE`,
        sql`INSERT INTO atlas_saved_collection(user_id,name) SELECT ${user.id},${body.name} WHERE (SELECT count(*) FROM atlas_saved_collection WHERE user_id=${user.id})<20 ON CONFLICT(user_id,name) DO NOTHING RETURNING id`,
      ]);
      if (!r[1].length)
        return reply(
          { error: "Choose a new name. You can keep up to 20 lists." },
          400,
        );
    } else if (body.action === "delete")
      await sql`DELETE FROM atlas_saved_collection WHERE id=${body.id}::uuid AND user_id=${user.id}`;
    else {
      const rows =
        await sql`UPDATE atlas_saved_resource SET collection_id=${body.collectionId}::uuid WHERE user_id=${user.id} AND resource_id=${body.resourceId} AND (${body.collectionId}::uuid IS NULL OR EXISTS(SELECT 1 FROM atlas_saved_collection WHERE id=${body.collectionId}::uuid AND user_id=${user.id})) RETURNING resource_id`;
      if (!rows.length)
        return reply({ error: "Saved resource or list unavailable." }, 404);
    }
    return reply({ ok: true });
  } catch {
    return reply(
      { error: "Could not change this list. Check its name and try again." },
      400,
    );
  }
}

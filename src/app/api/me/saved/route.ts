import { NextRequest, NextResponse } from "next/server";
import { member, privateHeaders } from "@/lib/member";
import { db } from "@/lib/db";
import { sameOrigin, rateLimit } from "@/lib/security";
import { savedSchema } from "@/lib/search-input";
import { z } from "zod";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
export async function GET() {
  try {
    const user = await member();
    if (!user)
      return reply({ error: "Sign in to access your saved list." }, 401);
    const rows =
      await db()`SELECT resource_id AS id FROM atlas_saved_resource WHERE user_id=${user.id} ORDER BY saved_at,resource_id`;
    return reply({ ids: rows.map((r) => r.id) });
  } catch {
    return reply({ error: "Your saved list is temporarily unavailable." }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const user = await member();
    if (!user) return reply({ error: "Sign in to save across devices." }, 401);
    if (!(await rateLimit("account-saves", 180, 10)))
      return reply(
        { error: "Please wait before changing your saved list again." },
        429,
      );
    const body = await request.json(),
      sql = db();
    const change = z
      .object({
        id: z.string().regex(/^[a-z0-9-]{1,150}$/),
        saved: z.boolean(),
      })
      .safeParse(body);
    if (change.success) {
      const { id, saved } = change.data;
      if (saved) {
        await sql.transaction([
          sql`SELECT id FROM atlas_user WHERE id=${user.id} FOR UPDATE`,
          sql`INSERT INTO atlas_saved_resource(user_id,resource_id) SELECT ${user.id},id FROM resources WHERE id=${id} AND published AND (SELECT count(*) FROM atlas_saved_resource WHERE user_id=${user.id})<1000 ON CONFLICT DO NOTHING`,
        ]);
        const [row] =
          await sql`SELECT 1 AS present FROM atlas_saved_resource WHERE user_id=${user.id} AND resource_id=${id}`;
        if (!row)
          return reply(
            {
              error:
                "Could not save this resource. Lists can contain up to 1,000 published resources.",
            },
            400,
          );
      } else
        await sql`DELETE FROM atlas_saved_resource WHERE user_id=${user.id} AND resource_id=${id}`;
      return reply({ ok: true });
    }
    const merge = z.object({ importIds: savedSchema }).safeParse(body);
    if (!merge.success)
      return reply({ error: "Invalid saved resources." }, 400);
    const ids = [...new Set(merge.data.importIds)];
    await sql.transaction([
      sql`SELECT id FROM atlas_user WHERE id=${user.id} FOR UPDATE`,
      sql`INSERT INTO atlas_saved_resource(user_id,resource_id) SELECT ${user.id},r.id FROM resources r WHERE r.id=ANY(${ids}::text[]) AND r.published AND NOT EXISTS(SELECT 1 FROM atlas_saved_resource s WHERE s.user_id=${user.id} AND s.resource_id=r.id) ORDER BY r.id LIMIT GREATEST(0,1000-(SELECT count(*)::int FROM atlas_saved_resource WHERE user_id=${user.id})) ON CONFLICT DO NOTHING`,
    ]);
    const rows =
      await sql`SELECT resource_id AS id FROM atlas_saved_resource WHERE user_id=${user.id} ORDER BY saved_at,resource_id`;
    return reply({
      ids: rows.map((r) => r.id),
      notImported: ids.filter((id) => !rows.some((r) => r.id === id)).length,
    });
  } catch {
    return reply(
      { error: "Could not update your account saves. Please try again." },
      503,
    );
  }
}

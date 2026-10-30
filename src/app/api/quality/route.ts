import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { member, privateHeaders } from "@/lib/member";
import { sameOrigin, rateLimit } from "@/lib/security";
import { resourceSchema } from "@/lib/types";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: privateHeaders });
const url = z.url().refine((v) => new URL(v).protocol === "https:");
export async function GET() {
  try {
    const user = await member();
    if (!user) return reply({ error: "Sign in first." }, 401);
    const claims =
      await db()`SELECT c.id,c.resource_id AS "resourceId",c.role,c.status,r.resource_name AS name FROM atlas_provider_claim c JOIN resources r ON r.id=c.resource_id WHERE c.user_id=${user.id} ORDER BY c.created_at DESC`;
    return reply({ claims });
  } catch {
    return reply({ error: "Update requests unavailable." }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (!(await sameOrigin())) return reply({ error: "Invalid origin" }, 403);
  try {
    const user = await member();
    if (!user) return reply({ error: "Sign in first." }, 401);
    if (!(await rateLimit("quality-submission:" + user.id, 12, 60)))
      return reply(
        { error: "Please wait before submitting another update." },
        429,
      );
    const body = await request.json(),
      sql = db();
    if (body.action === "claim") {
      const b = z
        .object({
          resourceId: z.string().regex(/^[a-z0-9-]{1,150}$/),
          role: z.string().trim().min(3).max(100),
          evidenceUrl: url,
          notes: z.string().trim().min(10).max(1000),
        })
        .parse(body);
      const rows =
        await sql`INSERT INTO atlas_provider_claim(user_id,resource_id,role,evidence_url,notes) SELECT ${user.id},id,${b.role},${b.evidenceUrl},${b.notes} FROM resources WHERE id=${b.resourceId} AND published ON CONFLICT(user_id,resource_id) DO UPDATE SET role=EXCLUDED.role,evidence_url=EXCLUDED.evidence_url,notes=EXCLUDED.notes,status='pending',reviewed_at=NULL RETURNING id`;
      if (!rows.length) return reply({ error: "Listing unavailable." }, 404);
      return reply({ ok: true });
    }
    const b = z
      .object({
        action: z.literal("propose"),
        resourceId: z.string().regex(/^[a-z0-9-]{1,150}$/),
        changes: z.object({
          phone: z.string().max(70),
          hours: z.string().max(500),
          intake: z.string().max(1000),
          availability: z.string().max(200),
        }),
        sourceUrl: url,
        reason: z.string().trim().min(10).max(1000),
      })
      .parse(body);
    const [claim] =
      await sql`SELECT 1 FROM atlas_provider_claim WHERE user_id=${user.id} AND resource_id=${b.resourceId} AND status='approved'`;
    if (!claim)
      return reply(
        {
          error:
            "An administrator must approve your organization update access first.",
        },
        403,
      );
    const [row] =
      await sql`SELECT data FROM resources WHERE id=${b.resourceId} AND published`;
    if (!row) return reply({ error: "Listing unavailable." }, 404);
    const proposed = resourceSchema.parse({
        ...row.data,
        ...b.changes,
        sourceUrl: b.sourceUrl,
        sourceCheckedAt: new Date().toISOString().slice(0, 10),
      }),
      fingerprint = createHash("sha256")
        .update(JSON.stringify({ id: b.resourceId, proposed }))
        .digest("hex");
    await sql`INSERT INTO atlas_quality_proposal(resource_id,submitted_by,source,proposal,before_data,reason,fingerprint) VALUES(${b.resourceId},${user.id},'organization-submitted',${JSON.stringify(proposed)}::jsonb,${JSON.stringify(row.data)}::jsonb,${b.reason},${fingerprint}) ON CONFLICT(fingerprint) DO NOTHING`;
    return reply({ ok: true });
  } catch {
    return reply(
      { error: "Check the required fields and official https source link." },
      400,
    );
  }
}

"use server";
import { z } from "zod";
import { assertAdmin, sameOrigin } from "@/lib/security";
import { db } from "@/lib/db";
import { resourceSchema } from "@/lib/types";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
export async function reviewQuality(form: FormData) {
  await assertAdmin();
  if (!(await sameOrigin())) throw Error("Invalid origin");
  const id = z.uuid().parse(form.get("id")),
    kind = z.enum(["claim", "proposal"]).parse(form.get("kind")),
    action = z.enum(["approve", "dismiss"]).parse(form.get("action")),
    sql = db();
  if (kind === "claim") {
    await sql.transaction([
      sql`UPDATE atlas_provider_claim SET status=${action === "approve" ? "approved" : "dismissed"},reviewed_at=now() WHERE id=${id}::uuid`,
      sql`INSERT INTO audit_events(action,resource_id,after_data) VALUES('organization-access-review',${id},${JSON.stringify({ action })}::jsonb)`,
    ]);
  } else {
    const [p] =
      await sql`SELECT * FROM atlas_quality_proposal WHERE id=${id}::uuid AND status IN ('pending','conflict')`;
    if (!p) throw Error("Pending proposal not found");
    if (action === "dismiss") {
      await sql.transaction([
        sql`UPDATE atlas_quality_proposal SET status='dismissed',reviewed_at=now() WHERE id=${id}::uuid AND status IN ('pending','conflict')`,
        sql`INSERT INTO audit_events(action,resource_id,after_data) VALUES('quality-proposal-dismissed',${p.resource_id},${JSON.stringify({ proposalId: id })}::jsonb)`,
      ]);
    } else {
      if (p.status !== "pending")
        throw Error(
          "Compare this conflict with the full listing and make a reviewed manual edit.",
        );
      const data = resourceSchema.parse(p.proposal);
      const result = await sql.transaction([
        sql`SELECT id FROM resources WHERE id=${p.resource_id} FOR UPDATE`,
        sql`WITH changed AS (UPDATE resources SET data=${JSON.stringify(data)}::jsonb,location=CASE WHEN ${data.lng}::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${data.lng}::float8,${data.lat}::float8),4326)::geography END,updated_at=now() WHERE id=${p.resource_id} AND data=${JSON.stringify(p.before_data)}::jsonb AND EXISTS(SELECT 1 FROM atlas_quality_proposal WHERE id=${id}::uuid AND status='pending') RETURNING id), reviewed AS (UPDATE atlas_quality_proposal SET status=CASE WHEN EXISTS(SELECT 1 FROM changed) THEN 'approved' ELSE 'conflict' END,reviewed_at=now() WHERE id=${id}::uuid AND status='pending' RETURNING status), audited AS (INSERT INTO audit_events(action,resource_id,before_data,after_data) SELECT 'quality-proposal-reviewed',id,${JSON.stringify(p.before_data)}::jsonb,${JSON.stringify(data)}::jsonb FROM changed) SELECT status FROM reviewed`,
      ]);
      if (result[1][0]?.status !== "approved") {
        redirect("/admin/quality?conflict=1");
      }
      revalidateTag("resources", { expire: 0 });
    }
  }
  redirect("/admin/quality?updated=1");
}

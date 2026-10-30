"use server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security";
import { requireModerator } from "@/lib/moderator";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function moderateReport(form: FormData) {
  const actor = await requireModerator();
  if (!(await sameOrigin())) throw Error("Invalid origin");
  const id = z.uuid().parse(form.get("id")),
    action = z
      .enum(["reviewed", "dismissed", "suspend"])
      .parse(form.get("action")),
    sql = db();
  const [report] =
    await sql`SELECT * FROM atlas_community_report WHERE id=${id}::uuid`;
  if (!report) throw Error("Report not found");
  if (action === "suspend") {
    const [protectedRole] =
      await sql`SELECT 1 FROM atlas_community_role WHERE user_id=${report.subject_id}`;
    if (protectedRole)
      throw Error(
        "A site administrator must review reports involving a moderator. This account was not paused.",
      );
  }
  await sql.transaction([
    sql`UPDATE atlas_community_report SET status=${action === "dismissed" ? "dismissed" : "reviewed"},reviewed_at=now() WHERE id=${id}::uuid`,
    sql`UPDATE atlas_profile SET suspended=true,discoverable=false,accepts_requests=false,updated_at=now() WHERE user_id=${action === "suspend" ? report.subject_id : null} AND NOT EXISTS(SELECT 1 FROM atlas_community_role WHERE user_id=atlas_profile.user_id)`,
    sql`INSERT INTO audit_events(action,resource_id,after_data) VALUES('community-moderation',${id},${JSON.stringify({ actor: actor.id, action, subject: report.subject_id })}::jsonb)`,
  ]);
  revalidatePath("/moderation");
  redirect("/moderation?updated=1");
}
export async function reinstateMember(form: FormData) {
  const actor = await requireModerator();
  if (!(await sameOrigin())) throw Error("Invalid origin");
  const id = z.string().min(1).max(128).parse(form.get("id")),
    sql = db();
  await sql.transaction([
    sql`UPDATE atlas_profile SET suspended=false,updated_at=now() WHERE user_id=${id}`,
    sql`INSERT INTO audit_events(action,resource_id,after_data) VALUES('community-reinstate',${id},${JSON.stringify({ actor: actor.id })}::jsonb)`,
  ]);
  revalidatePath("/moderation");
  redirect("/moderation?updated=1");
}

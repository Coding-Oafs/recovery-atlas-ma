"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  assertAdmin,
  createSession,
  equal,
  rateLimit,
  sameOrigin,
} from "@/lib/security";
import { db } from "@/lib/db";
import { resourceSchema } from "@/lib/types";
async function guard() {
  await assertAdmin();
  if (!(await sameOrigin())) throw Error("Invalid origin");
}
export async function login(form: FormData) {
  if (!(await sameOrigin())) redirect("/admin?error=origin");
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET)
    redirect("/admin?error=configuration");
  if (!(await rateLimit("admin-login", 8, 15))) redirect("/admin?error=rate");
  const password = String(form.get("password") ?? "");
  if (password.length > 200 || !equal(password, process.env.ADMIN_PASSWORD!))
    redirect("/admin?error=credentials");
  (await cookies()).set("atlas_admin", createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 3600,
  });
  redirect("/admin");
}
export async function logout() {
  await guard();
  (await cookies()).delete("atlas_admin");
  redirect("/admin");
}
export async function reviewSubmission(form: FormData) {
  await guard();
  const id = String(form.get("id") ?? ""),
    status = String(form.get("status"));
  if (
    !/^[\da-f-]{36}$/i.test(id) ||
    !["reviewed", "dismissed"].includes(status)
  )
    throw Error("Invalid submission");
  const sql = db();
  await sql.transaction([
    sql`UPDATE submissions SET status=${status} WHERE id=${id}::uuid`,
    sql`INSERT INTO audit_events(action,resource_id,after_data) VALUES('review-submission',${id},${JSON.stringify({ status })}::jsonb)`,
  ]);
  revalidatePath("/admin");
}
export async function saveResource(form: FormData) {
  await guard();
  const id = String(form.get("id"));
  const sql = db();
  const rows = await sql`SELECT data FROM resources WHERE id=${id}`;
  if (!rows.length) throw Error("Resource not found");
  const before = rows[0].data;
  const next = { ...before };
  for (const key of [
    "name",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "website",
    "description",
    "hours",
    "intake",
    "paymentNote",
    "sourceUrl",
    "sourceName",
    "sourceCheckedAt",
    "availability",
  ])
    next[key] = String(form.get(key) ?? "");
  for (const key of [
    "services",
    "languages",
    "accessibility",
    "populations",
    "payment",
  ])
    next[key] = String(form.get(key) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  next.lat = String(form.get("lat") ?? "").trim()
    ? Number(form.get("lat"))
    : null;
  next.lng = String(form.get("lng") ?? "").trim()
    ? Number(form.get("lng"))
    : null;
  next.coordinateAccuracy = String(
    form.get("coordinateAccuracy") ?? "unavailable",
  );
  next.verifiedAt = String(form.get("verifiedAt") ?? "") || null;
  const count = Math.min(
    30,
    Math.max(0, Number(form.get("insuranceCount")) || 0),
  );
  next.insurance = Array.from({ length: count }, (_, i) =>
    Object.fromEntries(
      ["name", "plan", "status", "note", "sourceUrl", "checkedAt"].map((k) => [
        k,
        String(form.get(`insurance_${i}_${k}`) ?? "").trim(),
      ]),
    ),
  ).filter((p) => p.name);
  if (before.meeting) {
    next.meeting = {
      ...before.meeting,
      days: form.getAll("meetingDay").map(Number),
      time: String(form.get("meetingTime")),
      duration: form.get("meetingDuration")
        ? Number(form.get("meetingDuration"))
        : null,
      joinUrl: String(form.get("meetingJoinUrl") ?? "").trim() || null,
      notes: String(form.get("meetingNotes") ?? ""),
    };
  }
  const r = resourceSchema.parse(next);
  const published = form.get("published") === "on";
  await sql.transaction([
    sql`UPDATE resources SET data=${JSON.stringify(r)}::jsonb,published=${published},location=CASE WHEN ${r.lng}::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${r.lng}::float8,${r.lat}::float8),4326)::geography END,updated_at=now() WHERE id=${id}`,
    sql`INSERT INTO audit_events(action,resource_id,before_data,after_data) VALUES('edit-resource',${id},${JSON.stringify(before)}::jsonb,${JSON.stringify(r)}::jsonb)`,
  ]);
  revalidateTag("resources", { expire: 0 });
  revalidatePath("/admin");
  redirect("/admin?updated=1");
}
export async function importResources(form: FormData) {
  await guard();
  const raw = String(form.get("json") ?? "");
  if (raw.length > 250000) redirect("/admin?error=import-size");
  let resources;
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length < 1 || data.length > 100)
      throw Error();
    resources = data.map((r) => resourceSchema.parse(r));
    if (new Set(resources.map((r) => r.id)).size !== resources.length)
      throw Error();
  } catch {
    redirect("/admin?error=import-validation");
  }
  const sql = db();
  const queries = resources!.map(
    (r) =>
      sql`INSERT INTO resources(id,data,location) VALUES(${r.id},${JSON.stringify(r)}::jsonb,CASE WHEN ${r.lng}::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${r.lng}::float8,${r.lat}::float8),4326)::geography END) ON CONFLICT(id) DO NOTHING`,
  );
  await sql.transaction([
    ...queries,
    sql`INSERT INTO sync_runs(source,status,details) VALUES('admin-reviewed-json','completed',${JSON.stringify({ submitted: resources!.length, policy: "insert-only; existing edits preserved" })}::jsonb)`,
  ]);
  revalidateTag("resources", { expire: 0 });
  redirect("/admin?imported=1");
}

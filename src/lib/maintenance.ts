import "server-only";
import { db } from "./db";
const hosts = new Set([
  "www.mass.gov",
  "aaboston.org",
  "recoverydharma.org",
  "meetings.smartrecovery.org",
  "adcare.com",
  "www.bmc.org",
  "www.mcleanhospital.org",
  "www.spectrumhealthsystems.org",
  "www.massgeneralbrigham.org",
]);
export async function checkSources() {
  const sql = db();
  const rows =
    await sql`SELECT r.id,r.data->>'sourceUrl' AS url FROM resources r LEFT JOIN LATERAL(SELECT checked_at FROM source_checks WHERE resource_id=r.id ORDER BY checked_at DESC LIMIT 1)c ON true WHERE r.published=true ORDER BY c.checked_at ASC NULLS FIRST LIMIT 6`;
  for (const row of rows) {
    let status: number | null = null,
      error: string | null = null;
    try {
      const url = new URL(row.url);
      if (url.protocol !== "https:" || !hosts.has(url.hostname))
        throw Error("Domain requires administrator review");
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      });
      status = response.status;
      if (status >= 400)
        error =
          status === 403
            ? "Source blocks automated checks; manual review required"
            : "Source returned an error; manual review required";
    } catch {
      error = "Link check unavailable; manual review required";
    }
    await sql`INSERT INTO source_checks(resource_id,status,error) VALUES(${row.id},${status},${error})`;
  }
  await sql.transaction([
    sql`DELETE FROM rate_limits WHERE expires_at<now()-interval '1 day'`,
    sql`DELETE FROM atlas_auth_rate_limit WHERE "lastRequest" < extract(epoch FROM now()-interval '1 day')*1000`,
    sql`DELETE FROM atlas_session WHERE "expiresAt"<now()`,
    sql`DELETE FROM atlas_verification WHERE "expiresAt"<now()`,
    sql`INSERT INTO sync_runs(source,status,details) VALUES('source-link-check','completed',${JSON.stringify({ checked: rows.length, note: "No source review or verification dates changed" })}::jsonb)`,
  ]);
  return rows.length;
}

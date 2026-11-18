import { writeFile } from "node:fs/promises";
/** Activate only inserted release members; administrator-touched records are excluded. */
export async function activateCoverageRelease({
  sql,
  providerHashSql,
  progressFile,
}) {
  const releases = [
    "national-providers-20261117",
    "additional-practices-20261117",
    "local-meetings-20261117",
  ];
  let activated = 0;
  for (const release of [...releases].reverse()) {
    let cursor = "";
    while (true) {
      const [result] = await sql.query(
        `WITH chunk AS MATERIALIZED(SELECT resource_id FROM atlas_import_release_member WHERE release_id=$1 AND resource_id>$2 ORDER BY resource_id LIMIT 15000),changed AS(UPDATE resources r SET published=true,provider_baseline_hash=CASE WHEN r.resource_source LIKE 'NPPES%' THEN ${providerHashSql("r.data")} ELSE r.provider_baseline_hash END,updated_at=now() FROM chunk c WHERE r.id=c.resource_id AND NOT r.published AND NOT EXISTS(SELECT 1 FROM audit_events a WHERE a.resource_id=r.id AND a.created_at>=r.created_at AND a.action NOT IN('census-address-interpolation','official-source-refresh')) RETURNING r.id) SELECT (SELECT count(*)::int FROM changed) AS count,(SELECT max(resource_id) FROM chunk) AS cursor`,
        [release, cursor],
      );
      activated += result.count;
      if (!result.cursor) break;
      cursor = result.cursor;
      await writeFile(
        progressFile,
        JSON.stringify(
          {
            status: "activating",
            release,
            activated,
            cursor,
            at: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
    }
  }
  await sql.query(
    "UPDATE atlas_import_release SET status='activated',activated_at=now() WHERE id=ANY($1::text[])",
    [releases],
  );
  await sql.query(
    "INSERT INTO audit_events(action,after_data)VALUES('national-coverage-release-activation',$1::jsonb)",
    [JSON.stringify({ releases, activated })],
  );
  await writeFile(
    progressFile,
    JSON.stringify(
      { status: "activated", activated, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  return { activated };
}

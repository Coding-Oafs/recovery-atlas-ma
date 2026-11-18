import { providerHashSql } from "./provider-store";
import type { PipelineSql } from "./source-pipeline-store";

const releaseIds = [
  "national-providers-20261117",
  "additional-practices-20261117",
  "local-meetings-20261117",
];

/** A bounded release batch shares a transaction with its checkpoint. */
export async function publishStagedProviderBatch(
  sql: PipelineSql,
  jobId: string,
) {
  const [result] = await sql.query(
    `WITH job AS MATERIALIZED (
       SELECT j.id, j.config FROM atlas_source_job j
       JOIN atlas_import_release r ON r.id=j.config->>'release'
       WHERE j.id=$1 AND j.enabled AND j.adapter='release-activation'
         AND r.id=ANY($2::text[]) AND r.status='staged'
       FOR UPDATE OF j SKIP LOCKED
     ), batch AS MATERIALIZED (
       SELECT member.resource_id FROM job
       JOIN atlas_import_release_member member ON member.release_id=job.config->>'release'
       WHERE member.resource_id>COALESCE(job.config->>'cursor','')
         AND member.resource_id<job.config->>'end'
       ORDER BY member.resource_id LIMIT 15000
     ), published AS (
       UPDATE resources r SET published=true,
         provider_baseline_hash=CASE WHEN r.resource_source LIKE 'NPPES%'
           THEN ${providerHashSql("r.data")} ELSE r.provider_baseline_hash END,
         updated_at=now()
       FROM batch WHERE r.id=batch.resource_id AND NOT r.published
       AND NOT EXISTS (
         SELECT 1 FROM audit_events a WHERE a.resource_id=r.id AND a.created_at>=r.created_at
           AND a.action NOT IN('census-address-interpolation','official-source-refresh')
       ) RETURNING r.id
     ), progress AS (
       SELECT count(*)::int AS scanned, max(resource_id) AS cursor,
         (SELECT count(*)::int FROM published) AS published FROM batch
     ) UPDATE atlas_source_job s SET
       config=CASE WHEN progress.cursor IS NULL THEN job.config
         ELSE jsonb_set(job.config,'{cursor}',to_jsonb(progress.cursor)) END,
       enabled=progress.scanned>0
       FROM job,progress WHERE s.id=job.id
       RETURNING progress.scanned,progress.published,NOT s.enabled AS complete`,
    [jobId, releaseIds],
  );
  if (!result) {
    await sql.query(
      "UPDATE atlas_source_job SET enabled=false WHERE id=$1 AND adapter='release-activation'",
      [jobId],
    );
    return { scanned: 0, published: 0, complete: true };
  }
  if (result.complete) {
    await sql.query(
      `WITH finished AS (
         UPDATE atlas_import_release r SET status='activated',activated_at=now()
         WHERE r.id=ANY($1::text[]) AND r.status='staged'
           AND EXISTS (SELECT 1 FROM atlas_source_job j WHERE j.adapter='release-activation' AND j.config->>'release'=r.id)
           AND NOT EXISTS (SELECT 1 FROM atlas_source_job j WHERE j.adapter='release-activation' AND j.config->>'release'=r.id AND j.enabled)
         RETURNING id
       ) INSERT INTO audit_events(action,after_data)
       SELECT 'national-coverage-release-activation',jsonb_build_object('release',id) FROM finished`,
      [releaseIds],
    );
  }
  return result;
}

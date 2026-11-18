import type { Resource } from "./types";
import { resourceSchema } from "./types";
import { meetingSignature } from "./meeting-import";
import {
  sourceFacts,
  sameFacts,
  fingerprint,
  mergeSourceFacts,
} from "./source-pipeline-core";
export type PipelineSql = {
  query: (text: string, values?: any[]) => Promise<any[]>;
};
/** Insert-only on first contact; later source changes apply only against an unchanged baseline. */
export async function installMeetingCapture(
  sql: PipelineSql,
  sourceId: string,
  rows: Resource[],
  options: { publish?: boolean; release?: string; complete?: boolean } = {},
) {
  const counts = {
    scanned: rows.length,
    added: 0,
    duplicate: 0,
    unchanged: 0,
    updated: 0,
    queued: 0,
  };
  if (!rows.length) throw Error("No usable schedules");
  const existing = await sql.query(
    "SELECT id,data,published FROM resources WHERE published AND resource_kind='meeting' AND resource_state=ANY($1::text[]) AND data->>'fellowship'=$2 UNION SELECT id,data,published FROM resources WHERE id=ANY($3::text[])",
    [
      [...new Set(rows.map((r) => r.state))],
      rows[0].fellowship,
      rows.map((r) => r.id),
    ],
  );
  const identities = await sql.query(
    "SELECT r.id,r.data,r.published FROM atlas_meeting_identity i JOIN resources r ON r.id=i.resource_id WHERE i.fingerprint=ANY($1::text[])",
    [rows.map(meetingSignature)],
  );
  existing.push(
    ...identities.filter((r) => !existing.some((e) => e.id === r.id)),
  );
  const ids = new Map<string, any>(existing.map((r) => [r.id, r])),
    signatures = new Map(existing.map((r) => [meetingSignature(r.data), r]));
  const members = new Map<string, any>(
    (
      await sql.query(
        "SELECT external_id,resource_id,facts FROM atlas_source_member WHERE source_id=$1",
        [sourceId],
      )
    ).map((r) => [r.external_id, r]),
  );
  const reviewed: { id: string; before: Resource }[] = [];
  const added: Resource[] = [],
    seen: {
      external: string;
      id: string;
      facts: unknown;
      signature: string;
    }[] = [];
  for (const fresh of rows) {
    const tracked = members.get(fresh.id),
      signature = meetingSignature(fresh),
      old =
        ids.get(tracked?.resource_id || fresh.id) || signatures.get(signature);
    if (!old) {
      if (
        fresh.meeting?.endsOn &&
        fresh.meeting.endsOn < new Date().toISOString().slice(0, 10)
      )
        continue;
      added.push(fresh);
      const entry = {
        pending: true,
        id: fresh.id,
        data: fresh,
        published: options.publish !== false,
      };
      ids.set(fresh.id, entry);
      signatures.set(signature, entry);
      counts.added++;
      seen.push({
        external: fresh.id,
        id: fresh.id,
        facts: sourceFacts(fresh),
        signature,
      });
      continue;
    }
    if (old.id !== fresh.id) counts.duplicate++;
    if (old.pending) {
      seen.push({
        external: fresh.id,
        id: old.id,
        facts: sourceFacts(old.data),
        signature,
      });
      continue;
    }
    const before = sourceFacts(old.data);
    if (sameFacts(before, sourceFacts(fresh))) {
      counts.unchanged++;
      reviewed.push({ id: old.id, before: old.data });
    } else {
      const proposed = resourceSchema.parse(mergeSourceFacts(old.data, fresh));
      if (
        tracked &&
        sameFacts(before, tracked.facts) &&
        old.published &&
        options.publish !== false
      ) {
        const changed = await sql.query(
          `WITH changed AS(UPDATE resources SET data=$2::jsonb,location=CASE WHEN $2::jsonb->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(($2::jsonb->>'lng')::float8,($2::jsonb->>'lat')::float8),4326)::geography END,updated_at=now() WHERE id=$1 AND data=$3::jsonb RETURNING id) INSERT INTO audit_events(action,resource_id,before_data,after_data) SELECT 'official-source-refresh',id,$3::jsonb,$2::jsonb FROM changed RETURNING resource_id`,
          [old.id, JSON.stringify(proposed), JSON.stringify(old.data)],
        );
        counts.updated += changed.length;
        if (changed.length) {
          old.data = proposed;
          await sql.query(
            "DELETE FROM atlas_resource_county WHERE resource_id=$1 AND $2::boolean",
            [
              old.id,
              proposed.address !== before.address ||
                proposed.state !== before.state ||
                proposed.city !== before.city,
            ],
          );
        }
      } else {
        const result = await sql.query(
          `INSERT INTO atlas_quality_proposal(resource_id,source,proposal,before_data,reason,fingerprint) VALUES($1,$2,$3::jsonb,$4::jsonb,'Official source schedule or location changed; compare with local edits before applying.',$5) ON CONFLICT(fingerprint)DO NOTHING RETURNING id`,
          [
            old.id,
            sourceId,
            JSON.stringify(proposed),
            JSON.stringify(old.data),
            fingerprint({ id: old.id, facts: sourceFacts(fresh) }),
          ],
        );
        counts.queued += result.length;
      }
    }
    seen.push({
      external: fresh.id,
      id: old.id,
      facts: sourceFacts(fresh),
      signature,
    });
  }
  for (let i = 0; i < added.length; i += 150) {
    const chunk = added.slice(i, i + 150);
    const inserted = await sql.query(
      `INSERT INTO resources(id,data,location,published) SELECT r->>'id',r,CASE WHEN r->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,$2 FROM jsonb_array_elements($1::jsonb)r ON CONFLICT(id)DO NOTHING RETURNING id`,
      [JSON.stringify(chunk), options.publish !== false],
    );
    if (options.release && inserted.length)
      await sql.query(
        "INSERT INTO atlas_import_release_member(release_id,resource_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING",
        [options.release, inserted.map((r) => r.id)],
      );
  }
  for (let i = 0; i < seen.length; i += 250) {
    const chunk = seen.slice(i, i + 250);
    await sql.query(
      `INSERT INTO atlas_source_member(source_id,external_id,resource_id,facts) SELECT $1,r->>'external',r->>'id',r->'facts' FROM jsonb_array_elements($2::jsonb)r ON CONFLICT(source_id,external_id)DO UPDATE SET facts=EXCLUDED.facts,last_seen_at=now(),missing_since=NULL`,
      [sourceId, JSON.stringify(chunk)],
    );
    await sql.query(
      `INSERT INTO atlas_meeting_identity(fingerprint,resource_id) SELECT r->>'signature',r->>'id' FROM jsonb_array_elements($1::jsonb)r ON CONFLICT DO NOTHING`,
      [JSON.stringify(chunk)],
    );
  }
  for (let i = 0; i < reviewed.length; i += 250)
    await sql.query(
      `UPDATE resources r SET data=jsonb_set(data,'{sourceCheckedAt}',to_jsonb($2::text)) FROM jsonb_array_elements($1::jsonb)s WHERE r.id=s->>'id' AND r.data=s->'before' AND COALESCE(r.data->>'sourceCheckedAt','')<$3 AND r.published`,
      [
        JSON.stringify(reviewed.slice(i, i + 250)),
        new Date().toISOString().slice(0, 10),
        new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
      ],
    );
  if (options.complete)
    await sql.query(
      "UPDATE atlas_source_member SET missing_since=COALESCE(missing_since,now()) WHERE source_id=$1 AND NOT(external_id=ANY($2::text[]))",
      [sourceId, seen.map((r) => r.external)],
    );
  return counts;
}

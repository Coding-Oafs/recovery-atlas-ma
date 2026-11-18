import type { PipelineSql } from "./source-pipeline-store";
/** Bounded assignment uses points and actual boundaries, never city-name guessing. */
export async function refreshCountyCoverage(
  sql: PipelineSql,
  limit = 50000,
  aggregate = true,
) {
  const [result] = await sql.query(
    `WITH pending AS MATERIALIZED(SELECT r.id,r.resource_state,r.location,r.data->>'coordinateAccuracy' AS accuracy FROM resources r LEFT JOIN atlas_resource_county x ON x.resource_id=r.id LEFT JOIN atlas_county_unassigned u ON u.resource_id=r.id WHERE r.published AND r.location IS NOT NULL AND r.resource_state<>'US' AND x.resource_id IS NULL AND (u.resource_id IS NULL OR u.checked_at<r.updated_at) ORDER BY r.id LIMIT $1),points AS MATERIALIZED(SELECT DISTINCT resource_state,location::geometry AS point FROM pending),point_counties AS MATERIALIZED(SELECT p.resource_state,p.point,c.fips FROM points p CROSS JOIN LATERAL(SELECT fips FROM atlas_county c WHERE c.state=p.resource_state AND c.boundary&&p.point AND ST_Covers(c.boundary,p.point) ORDER BY fips LIMIT 1)c),mapped AS MATERIALIZED(SELECT r.id,r.accuracy,c.fips FROM pending r JOIN point_counties c ON c.resource_state=r.resource_state AND c.point=r.location::geometry),assigned AS(INSERT INTO atlas_resource_county(resource_id,county_fips,accuracy) SELECT id,fips,CASE WHEN accuracy='address' THEN 'address' ELSE 'approximate' END FROM mapped ON CONFLICT(resource_id)DO NOTHING RETURNING resource_id),failed AS(INSERT INTO atlas_county_unassigned(resource_id) SELECT id FROM pending WHERE NOT EXISTS(SELECT 1 FROM mapped m WHERE m.id=pending.id) ON CONFLICT(resource_id)DO UPDATE SET checked_at=now() RETURNING resource_id) SELECT (SELECT count(*)::int FROM assigned) AS assigned,(SELECT count(*)::int FROM pending) AS scanned,(SELECT count(*)::int FROM failed) AS unassigned`,
    [limit],
  );
  if (aggregate)
    await sql.query(
      `INSERT INTO atlas_county_coverage(county_fips,counts,generated_at) SELECT c.fips,jsonb_build_object('listings',count(r.id),'aaPhysical',count(r.id) FILTER(WHERE r.data->>'fellowship'='AA' AND r.data->'formats' ? 'in-person'),'naPhysical',count(r.id) FILTER(WHERE r.data->>'fellowship'='NA' AND r.data->'formats' ? 'in-person'),'smartPhysical',count(r.id) FILTER(WHERE r.data->>'fellowship'='SMART Recovery' AND r.data->'formats' ? 'in-person'),'providers',count(r.id) FILTER(WHERE r.resource_kind='provider'),'support',count(r.id) FILTER(WHERE r.data->'categories' ? 'support'),'approximate',count(r.id) FILTER(WHERE x.accuracy='approximate'),'address',count(r.id) FILTER(WHERE x.accuracy='address')),now() FROM atlas_county c LEFT JOIN atlas_resource_county x ON x.county_fips=c.fips LEFT JOIN resources r ON r.id=x.resource_id AND r.published GROUP BY c.fips ON CONFLICT(county_fips)DO UPDATE SET counts=EXCLUDED.counts,generated_at=EXCLUDED.generated_at`,
    );
  return result;
}

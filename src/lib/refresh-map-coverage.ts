import type { PipelineSql } from "./source-pipeline-store";

// Keep one row per displayed coordinate for the unfiltered, low-zoom map.
export async function refreshMapCoverage(sql: PipelineSql) {
  await sql.query(`
    WITH points AS (
      SELECT location::geometry AS point, min(id) AS id,
        min(resource_kind) AS kind, count(*)::int AS weight
      FROM resources
      WHERE published AND location IS NOT NULL
        AND (
          resource_kind <> 'meeting' OR NULLIF(data->'meeting'->>'endsOn','') IS NULL
          OR (data->'meeting'->>'endsOn')::date
            >= (now() AT TIME ZONE COALESCE(data->'meeting'->>'timezone','UTC'))::date
        )
      GROUP BY location::geometry
    )
    INSERT INTO atlas_directory_stats(id,data)
    SELECT 'map-points', COALESCE(jsonb_agg(jsonb_build_object(
      'lng', ST_X(point), 'lat', ST_Y(point),
      'id', CASE WHEN weight=1 THEN id END,
      'kind', CASE WHEN weight=1 THEN kind END, 'weight', weight
    )), '[]') FROM points
    ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,generated_at=now()
  `);
}

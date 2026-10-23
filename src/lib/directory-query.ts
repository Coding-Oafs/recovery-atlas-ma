import "server-only";
import { db } from "./db";
import type { Filters } from "./types";
export async function queryDirectory(
  f: Filters,
  saved: string[],
  limit: number,
) {
  const values: unknown[] = [];
  const param = (v: unknown) => {
    values.push(v);
    return "$" + values.length;
  };
  const where = ["published=true"];
  const has = (path: string, value: string) => `${path} ? ${param(value)}`;
  if (f.category !== "all") where.push(has("data->'categories'", f.category));
  if (f.format) {
    const formats =
      f.format === "online"
        ? ["online", "hybrid"]
        : f.format === "in-person"
          ? ["in-person", "hybrid"]
          : [f.format];
    where.push(
      "(" + formats.map((s) => has("data->'formats'", s)).join(" OR ") + ")",
    );
  }
  if (f.fellowship) where.push(`data->>'fellowship'=${param(f.fellowship)}`);
  if (f.payment) {
    const p = param(f.payment);
    where.push(
      `(data->'payment' ? ${p} OR EXISTS(SELECT 1 FROM jsonb_array_elements(data->'insurance') i WHERE i->>'name'=${p}))`,
    );
  }
  for (const [field, value] of [
    ["services", f.service],
    ["languages", f.language],
    ["populations", f.population],
  ] as const)
    if (value) where.push(has(`data->'${field}'`, value));
  if (f.accessibility)
    where.push(has("data->'accessibility'", "Wheelchair access"));
  if (f.day !== "")
    where.push(
      `data->'meeting'->'days' @> ${param(JSON.stringify([Number(f.day)]))}::jsonb`,
    );
  if (f.savedOnly) where.push(`id=ANY(${param(saved)}::text[])`);
  for (const word of f.query.trim().split(/\s+/).filter(Boolean).slice(0, 10)) {
    const escaped = word.replace(/[\\%_]/g, "\\$&");
    where.push(
      `concat_ws(' ',data->>'name',data->>'city',data->>'address',data->>'description',data->>'fellowship',data->>'services',data->>'languages',data->>'populations',data->>'payment',data->>'insurance') ILIKE ${param("%" + escaped + "%")}`,
    );
  }
  const online =
    "(data->>'kind'='meeting' AND data->'formats' ? 'online' AND NOT(data->'formats' ? 'hybrid'))";
  let distance = "NULL::float8";
  if (f.center) {
    const lng = param(f.center.lng),
      lat = param(f.center.lat);
    const point = `ST_SetSRID(ST_MakePoint(${lng}::float8,${lat}::float8),4326)::geography`;
    distance = `ST_Distance(location,${point})/1609.344`;
    where.push(
      `(${online} OR ST_DWithin(location,${point},${param(f.radius * 1609.344)}::float8))`,
    );
  }
  if (f.bounds) {
    const [w, s, e, n] = f.bounds;
    where.push(
      `(${online} OR ST_Intersects(location,ST_MakeEnvelope(${param(w)}::float8,${param(s)}::float8,${param(e)}::float8,${param(n)}::float8,4326)::geography))`,
    );
  }
  const next = `(SELECT min(((d::date + (data->'meeting'->>'time')::time)::timestamp AT TIME ZONE 'America/New_York')) FROM generate_series((now() AT TIME ZONE 'America/New_York')::date, (now() AT TIME ZONE 'America/New_York')::date+7,interval '1 day') d WHERE data->'meeting'->'days' @> to_jsonb(ARRAY[extract(dow from d)::int]) AND ((d::date + (data->'meeting'->>'time')::time)::timestamp AT TIME ZONE 'America/New_York') >= now())`;
  const meetingOrder =
    f.category === "meetings" || f.format === "online" || f.soon;
  const nextColumn = meetingOrder
    ? `CASE WHEN data->'meeting' IS NOT NULL AND data->'meeting' <> 'null'::jsonb THEN ${next} ELSE NULL END`
    : "NULL::timestamptz";
  const order = meetingOrder
    ? "next_meeting NULLS LAST, name"
    : f.center
      ? "distance NULLS LAST, name"
      : "name";
  const query = `WITH matched AS MATERIALIZED(SELECT id,data,location,data->>'name' AS name,${distance} AS distance,${nextColumn} AS next_meeting FROM resources WHERE ${where.join(" AND ")}),filtered AS MATERIALIZED(SELECT * FROM matched ${f.soon ? "WHERE next_meeting<=now()+interval '3 hours'" : ""}), page AS(SELECT data FROM filtered ORDER BY ${order} LIMIT ${param(limit)}),points AS(SELECT id,data->>'kind' AS kind,(data->>'lat')::float8 AS lat,(data->>'lng')::float8 AS lng FROM filtered WHERE location IS NOT NULL) SELECT (SELECT count(*) FROM filtered) AS total,COALESCE((SELECT jsonb_agg(data) FROM page),'[]') AS resources,COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM points p),'[]') AS pins,(SELECT count(*) FROM filtered WHERE location IS NULL) AS online_or_unmapped`;
  const rows = await db().query(query, values);
  return {
    ...rows[0],
    total: Number(rows[0].total),
    online_or_unmapped: Number(rows[0].online_or_unmapped),
  };
}

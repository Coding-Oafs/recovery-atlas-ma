import "server-only";
import { db } from "./db";
import type { Filters } from "./types";
import { meetingTimeBounds, hasMeetingTimeFilter } from "./meeting-time";
export async function queryDirectory(
  f: Filters,
  saved: string[],
  limit: number,
  options: {
    map?: { bounds: number[]; zoom: number };
    selection?: { bounds: number[]; offset: number };
    offset?: number;
  } = {},
) {
  const values: unknown[] = [];
  const param = (v: unknown) => {
    values.push(v);
    return "$" + values.length;
  };
  const where = ["published=true"];
  if (f.state) where.push(`resource_state=${param(f.state)}`);
  if (hasMeetingTimeFilter(f)) where.push(`resource_kind='meeting'`);
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
    "(resource_kind='meeting' AND data->'formats' ? 'online' AND NOT(data->'formats' ? 'hybrid'))";
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
      `(${online} OR ST_Intersects(location::geometry,ST_MakeEnvelope(${param(w)}::float8,${param(s)}::float8,${param(e)}::float8,${param(n)}::float8,4326)))`,
    );
  }
  const view = options.map?.bounds ?? options.selection?.bounds;
  if (view) {
    const [w, s, e, n] = view;
    where.push(
      `ST_Intersects(location::geometry,ST_MakeEnvelope(${param(w)}::float8,${param(s)}::float8,${param(e)}::float8,${param(n)}::float8,4326))`,
    );
  }
  const meetingOrder =
    f.category === "meetings" ||
    f.format === "online" ||
    hasMeetingTimeFilter(f);
  const bounds = meetingTimeBounds(f),
    start = meetingOrder ? param(bounds.start.toISOString()) : "now()",
    end = bounds.end ? param(bounds.end.toISOString()) : null;
  const zone =
    "COALESCE(NULLIF(data->'meeting'->>'timezone',''),'America/New_York')";
  const candidate =
    "((d::date + (data->'meeting'->>'time')::time)::timestamp AT TIME ZONE " +
    zone +
    ")";
  const conditions = [candidate + ">=" + start + "::timestamptz"];
  if (end) conditions.push(candidate + "<" + end + "::timestamptz");
  if (f.day) conditions.push("extract(dow from d)=" + param(Number(f.day)));
  if (f.startAfter || f.startBefore) {
    const local =
      "(" +
      candidate +
      " AT TIME ZONE " +
      param(f.timeZone || "America/New_York") +
      ")::time";
    const after = f.startAfter
        ? local + ">=" + param(f.startAfter) + "::time"
        : null,
      before = f.startBefore
        ? local + "<" + param(f.startBefore) + "::time"
        : null;
    conditions.push(
      after && before
        ? "(" +
            after +
            (f.startAfter! > f.startBefore! ? " OR " : " AND ") +
            before +
            ")"
        : (after || before)!,
    );
  }
  const next = `(SELECT min(${candidate}) FROM generate_series((${start}::timestamptz AT TIME ZONE ${zone})::date, (${start}::timestamptz AT TIME ZONE ${zone})::date+34,interval '1 day') d WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(data->'meeting'->'exceptions','[]'::jsonb)) e WHERE e->>'date'=d::date::text AND e->>'cancelled'='true') AND data->'meeting'->'days' @> to_jsonb(ARRAY[extract(dow from d)::int]) AND ${conditions.join(" AND ")})`;
  const nextColumn = meetingOrder
    ? `CASE WHEN data->'meeting' IS NOT NULL AND data->'meeting' <> 'null'::jsonb THEN ${next} ELSE NULL END`
    : "NULL::timestamptz";
  const order = meetingOrder
    ? "next_meeting NULLS LAST, name"
    : f.center
      ? "distance NULLS LAST, name"
      : "name";
  const base = `WITH matched AS NOT MATERIALIZED(SELECT id,data,location,resource_name AS name,resource_kind AS kind,${distance} AS distance,${nextColumn} AS next_meeting FROM resources WHERE ${where.join(" AND ")}),filtered AS NOT MATERIALIZED(SELECT * FROM matched ${hasMeetingTimeFilter(f) ? "WHERE next_meeting IS NOT NULL" : ""})`;
  if (options.map) {
    const zoom = Math.floor(options.map.zoom),
      size = ((40075016.68557849 / 2 ** zoom) * (zoom >= 14 ? 12 : 55)) / 512,
      cell = param(size);
    const query = `${base},projected AS(SELECT id,kind,ST_X(location::geometry) AS lng,ST_Y(location::geometry) AS lat,ST_SnapToGrid(ST_Transform(location::geometry,3857),${cell}::float8) AS cell FROM filtered WHERE location IS NOT NULL),grouped AS(SELECT ST_X(cell) AS x,ST_Y(cell) AS y,min(id) AS id,min(kind) AS kind,count(*)::int AS count,avg(lat) AS lat,avg(lng) AS lng,ARRAY[min(lng)-0.0000001,min(lat)-0.0000001,max(lng)+0.0000001,max(lat)+0.0000001] AS bounds FROM projected GROUP BY cell),points AS(SELECT CASE WHEN count=1 THEN id ELSE 'group-'||x||'-'||y END AS id,CASE WHEN count=1 THEN kind ELSE 'cluster' END AS kind,count,lat,lng,bounds FROM grouped) SELECT COALESCE(jsonb_agg(to_jsonb(p)),'[]') AS pins,COALESCE(sum(count),0)::int AS represented FROM points p`;
    const [row] = await db().query(query, values);
    return { pins: row.pins, represented: Number(row.represented) };
  }
  const query = `${base},page AS(SELECT data FROM filtered ORDER BY ${order},id LIMIT ${param(limit)} OFFSET ${param(options.selection?.offset ?? options.offset ?? 0)}),counts AS(SELECT count(*) AS total,count(*) FILTER(WHERE location IS NULL) AS online_or_unmapped,count(location) AS mapped FROM filtered) SELECT counts.*,COALESCE((SELECT jsonb_agg(data) FROM page),'[]') AS resources FROM counts`;
  const rows = await db().query(query, values);
  return {
    ...rows[0],
    total: Number(rows[0].total),
    mapped: Number(rows[0].mapped),
    online_or_unmapped: Number(rows[0].online_or_unmapped),
  };
}

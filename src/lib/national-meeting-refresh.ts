import "server-only";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { load } from "cheerio";
import { db } from "./db";
import { resourceSchema, type Resource } from "./types";
import {
  normalizeMeetingGuide,
  normalizeOnlineIntergroup,
  normalizeBmlt,
  meetingSignature,
  type MeetingSource,
} from "./meeting-import";
import {
  parseCrawlerIndex,
  parseGeorgia,
  parseMontana,
  parseSiouxFalls,
} from "./meeting-index";
import registry from "../../data/meeting-refresh-sources.json";

async function read(url: string, max = 20_000_000) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || u.port)
    throw Error("Invalid public source");
  let r = await fetch(u, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (r.status >= 300 && r.status < 400) {
    const target = new URL(r.headers.get("location") || "", u);
    if (
      target.protocol !== "https:" ||
      target.hostname.replace(/^www\./, "") !==
        u.hostname.replace(/^www\./, "") ||
      target.port ||
      target.username ||
      target.password
    )
      throw Error("Source redirect requires review");
    r = await fetch(target, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  }
  if (!r.ok || r.status === 202) throw Error("Source HTTP " + r.status);
  const reader = r.body!.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw Error("Source size limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
const facts = (r: Resource) => ({
  name: r.name,
  address: r.address,
  city: r.city,
  state: r.state,
  lat: r.lat,
  lng: r.lng,
  coordinateAccuracy: r.coordinateAccuracy,
  formats: r.formats,
  meeting: r.meeting
    ? {
        days: r.meeting.days,
        time: r.meeting.time,
        duration: r.meeting.duration,
        timezone: r.meeting.timezone,
      }
    : null,
});
async function install(source: string, rows: Resource[], today: string) {
  const sql = db(),
    states = [...new Set(rows.map((r) => r.state))],
    fellowship = rows[0]?.fellowship;
  if (!rows.length) throw Error("No valid weekly US schedules; review source");
  const existing =
    await sql`SELECT id,jsonb_build_object('id',id,'name',data->'name','address',data->'address','city',data->'city','state',resource_state,'fellowship',data->'fellowship','lat',data->'lat','lng',data->'lng','coordinateAccuracy',data->'coordinateAccuracy','formats',data->'formats','meeting',jsonb_build_object('days',data->'meeting'->'days','time',data->'meeting'->'time','duration',data->'meeting'->'duration','timezone',data->'meeting'->'timezone')) AS data FROM resources WHERE resource_kind='meeting' AND resource_state=ANY(${states}::text[]) AND data->>'fellowship'=${fellowship}`;
  const ids = new Map(existing.map((r) => [r.id, r.data as Resource])),
    signatures = new Set(
      existing.map((r) => meetingSignature(r.data as Resource)),
    );
  const added: Resource[] = [],
    same: string[] = [],
    changes: { id: string; facts: ReturnType<typeof facts> }[] = [];
  for (const r of rows) {
    const old = ids.get(r.id);
    if (old) {
      if (JSON.stringify(facts(old)) === JSON.stringify(facts(r)))
        same.push(r.id);
      else if (changes.length < 25) changes.push({ id: r.id, facts: facts(r) });
      continue;
    }
    const signature = meetingSignature(r);
    if (signatures.has(signature)) continue;
    signatures.add(signature);
    ids.set(r.id, r);
    added.push(r);
  }
  for (let i = 0; i < added.length; i += 150)
    await sql`INSERT INTO resources(id,data,location,published) SELECT r->>'id',r,CASE WHEN r->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,true FROM jsonb_array_elements(${JSON.stringify(added.slice(i, i + 150))}::jsonb)r ON CONFLICT(id)DO NOTHING`;
  if (same.length)
    await sql`UPDATE resources SET data=jsonb_set(data,'{sourceCheckedAt}',to_jsonb(${today}::text)) WHERE id=ANY(${same}::text[])`;
  let queued = 0;
  if (changes.length) {
    const originals =
      await sql`SELECT id,data FROM resources WHERE id=ANY(${changes.map((r) => r.id)}::text[]) AND published`;
    for (const old of originals) {
      const fresh = changes.find((r) => r.id === old.id)!.facts;
      const proposed = resourceSchema.parse({
        ...old.data,
        ...fresh,
        meeting: { ...old.data.meeting, ...fresh.meeting },
        sourceCheckedAt: today,
      });
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ id: old.id, facts: fresh }))
        .digest("hex");
      const result =
        await sql`INSERT INTO atlas_quality_proposal(resource_id,source,proposal,before_data,reason,fingerprint) VALUES(${old.id},${source},${JSON.stringify(proposed)}::jsonb,${JSON.stringify(old.data)}::jsonb,'Official source facts changed; review schedule, attendance, location and time zone.',${fingerprint}) ON CONFLICT(fingerprint)DO NOTHING RETURNING id`;
      queued += result.length;
    }
  }
  return {
    source,
    scanned: rows.length,
    added: added.length,
    unchanged: same.length,
    queued,
  };
}
/** Daily bounded rotation; outages never remove meetings or imply there are none. */
export async function refreshNationalMeetingSources() {
  const sql = db(),
    today = new Date().toISOString().slice(0, 10);
  const [last] =
    await sql`SELECT details FROM sync_runs WHERE source='national-meeting-refresh' ORDER BY created_at DESC LIMIT 1`;
  if (last?.details?.date === today)
    return { status: "already-checked", date: today };
  const start = Number(last?.details?.nextIndex || 0) % registry.length,
    details: Record<string, unknown>[] = [];
  for (let i = 0; i < 6; i++) {
    const source = registry[(start + i) % registry.length];
    try {
      let feed = source.feed;
      if (/\/tsml-cache-/.test(feed)) {
        const html = (await read(source.page, 3_000_000)).toString(),
          $ = load(html),
          advertised = $("#tsml-ui").attr("data-src");
        if (!advertised)
          throw Error("Publisher no longer advertises a public feed");
        const target = new URL(advertised, source.page),
          known = new URL(source.feed);
        if (
          target.protocol !== "https:" ||
          target.hostname.replace(/^www\./, "") !==
            known.hostname.replace(/^www\./, "")
        )
          throw Error("Changed feed host requires review");
        feed = target.href;
      }
      const text = (await read(feed)).toString("utf8");
      const raw =
        source.adapter === "crawler-index"
          ? parseCrawlerIndex(text)
          : source.adapter === "sioux-falls"
            ? parseSiouxFalls(text)
            : JSON.parse(text);
      if (!Array.isArray(raw) || !raw.length)
        throw Error("Changed source structure");
      const rows = raw
        .map((m) => normalizeMeetingGuide(m, source as MeetingSource, today))
        .filter((r): r is Resource => r !== null);
      if (rows.length < raw.length * 0.2)
        throw Error("Too many ambiguous source schedules; review required");
      details.push(await install(source.id, rows, today));
    } catch (e) {
      details.push({
        source: source.id,
        status: "needs-review",
        error: e instanceof Error ? e.message : "Source unavailable",
      });
    }
  }
  let nextGeorgiaPage = Number(last?.details?.nextGeorgiaPage || 1),
    nextMontanaIndex = Number(last?.details?.nextMontanaIndex || 0);
  for (const state of ["GA", "MT"])
    try {
      const page =
        state === "GA"
          ? "https://find.aageorgia.org/meetings/search/"
          : "https://www.aa-montana.org/meetings.php";
      const source = {
        id: state === "GA" ? "aa-ga-statewide" : "aa-mt-statewide",
        state,
        page,
        fellowship: "AA",
      };
      const rows: Resource[] = [];
      if (state === "GA") {
        const first = (await read(page, 5_000_000)).toString(),
          $ = load(first),
          pages = Number($.text().match(/of\s+(\d+)\s+page\(s\)/)?.[1]);
        if (!pages || pages > 100) throw Error("Changed Georgia pagination");
        for (let i = 0; i < 6; i++) {
          const index = ((nextGeorgiaPage - 1 + i) % pages) + 1,
            html =
              index === 1
                ? first
                : (await read(page + "?dpage=" + index, 5_000_000)).toString();
          rows.push(
            ...parseGeorgia(html)
              .map((m) => normalizeMeetingGuide(m, source, today))
              .filter((r): r is Resource => r !== null),
          );
        }
        nextGeorgiaPage = ((nextGeorgiaPage - 1 + 6) % pages) + 1;
      } else {
        const $ = load((await read(page, 3_000_000)).toString());
        const cities = $("select[name=city_id] option")
          .toArray()
          .map((e) => ({ city: $(e).text().trim(), url: $(e).attr("value") }))
          .filter((c) => c.city && c.url);
        if (!cities.length || cities.length > 300)
          throw Error("Changed Montana city index");
        for (let i = 0; i < 10; i++) {
          const city = cities[(nextMontanaIndex + i) % cities.length],
            url = new URL(city.url!, page);
          if (url.origin !== new URL(page).origin)
            throw Error("Changed Montana source host");
          rows.push(
            ...parseMontana(
              (await read(url.href, 5_000_000)).toString(),
              city.city,
              url.href,
            )
              .map((m) => normalizeMeetingGuide(m, source, today))
              .filter((r): r is Resource => r !== null),
          );
        }
        nextMontanaIndex = (nextMontanaIndex + 10) % cities.length;
      }
      details.push(await install(source.id, rows, today));
    } catch (e) {
      details.push({
        source: state + " statewide AA",
        status: "needs-review",
        error: e instanceof Error ? e.message : "Source unavailable",
      });
    }
  try {
    const rows: Resource[] = [];
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    for (let hour = 0; hour < 24; hour += 6) {
      const url = new URL(
        "https://central-query.apps.code4recovery.org/api/v1/meetings",
      );
      url.search = new URLSearchParams({
        start: new Date(+startDate + hour * 3600000).toISOString(),
        hours: "6",
        limit: "1000",
      }).toString();
      const raw = JSON.parse((await read(url.href)).toString());
      if (!Array.isArray(raw) || raw.length >= 1000)
        throw Error("Online source limit reached; review required");
      rows.push(
        ...raw
          .map((m) => normalizeOnlineIntergroup(m, today))
          .filter((r): r is Resource => r !== null),
      );
    }
    details.push(await install("Online Intergroup AA", rows, today));
  } catch (e) {
    details.push({
      source: "Online Intergroup AA",
      status: "needs-review",
      error: e instanceof Error ? e.message : "Source unavailable",
    });
  }
  try {
    const manifest = JSON.parse(
      (
        await read("https://cdn.aws.bmlt.app/aggregator/manifest.json", 100000)
      ).toString(),
    );
    const exportDate = manifest.generated_at?.slice(0, 10);
    if (
      !exportDate ||
      Date.now() - Date.parse(manifest.generated_at) > 2 * 86400000
    )
      throw Error("BMLT export is stale");
    const bytes = await read(
      "https://cdn.aws.bmlt.app/aggregator/meetings.ndjson.gz",
      8_000_000,
    );
    const digest = createHash("sha256").update(bytes).digest("hex");
    const serialized = JSON.stringify(manifest);
    if (!serialized.includes(digest))
      throw Error("BMLT export checksum mismatch");
    const raw = gunzipSync(bytes, { maxOutputLength: 100_000_000 })
      .toString()
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    const rows = raw
      .map((m) => normalizeBmlt(m, exportDate))
      .filter((r): r is Resource => r !== null);
    if (rows.length < 10000)
      throw Error("Unexpectedly incomplete US BMLT export");
    details.push(
      await install("BMLT Aggregator daily static export", rows, exportDate),
    );
  } catch (e) {
    details.push({
      source: "BMLT Aggregator",
      status: "needs-review",
      error: e instanceof Error ? e.message : "Source unavailable",
    });
  }
  await sql`INSERT INTO sync_runs(source,status,details) VALUES('national-meeting-refresh',${details.some((d) => d.status === "needs-review") ? "needs-review" : "completed"},${JSON.stringify({ date: today, nextIndex: (start + 6) % registry.length, nextGeorgiaPage, nextMontanaIndex, feeds: details })}::jsonb)`;
  return details;
}

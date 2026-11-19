import "server-only";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { load } from "cheerio";
import registry from "../../data/meeting-refresh-sources.json";
import smartIndex from "../../data/smart-meeting-index.json";
import { db } from "./db";
import { readPublicSource } from "./public-source";
import { installMeetingCapture } from "./source-pipeline-store";
import { acceptableCapture, retryHours } from "./source-pipeline-core";
import {
  normalizeMeetingGuide,
  normalizeOnlineIntergroup,
  normalizeBmlt,
  type MeetingSource,
} from "./meeting-import";
import { parsePublisherMeetings } from "./publisher-csv";
import {
  parseCrawlerIndex,
  parseBrowardMeetings,
  parseGeorgia,
  parseMontana,
  parseSiouxFalls,
  parseSamoanSerenity,
} from "./meeting-index";
import { normalizeSmartCalendar } from "./smart-calendar";
import { parseVenueMeetings } from "./venue-meetings";
import type { Resource } from "./types";
import { stateNames } from "./region";
import { runProviderJob } from "./provider-jobs";
import { publishStagedProviderBatch } from "./coverage-publication";
type Job = {
  id: string;
  url: string;
  adapter: string;
  config: any;
  etag?: string;
  last_modified?: string;
  attempts: number;
  record_count: number | null;
};
const today = () => new Date().toISOString().slice(0, 10);
const hosts = (s: any) => [
  ...new Set(
    [new URL(s.page).hostname, new URL(s.feed).hostname].flatMap((h) => [
      h,
      h.startsWith("www.") ? h.slice(4) : "www." + h,
    ]),
  ),
];
export async function seedSourceJobs() {
  const sql = db();
  const jobs: any[] = registry.map((s) => ({
    id: s.id,
    name: s.fellowship + " / " + new URL(s.page).hostname,
    url: s.feed,
    adapter: s.adapter,
    config: s,
    interval: 24,
  }));
  jobs.push({
    id: "provider-discovery",
    name: "CMS NPPES monthly and weekly release index",
    url: "https://download.cms.gov/nppes/NPI_Files.html",
    adapter: "provider-discovery",
    config: {},
    interval: 24,
  });
  jobs.push(
    {
      id: "online-aa",
      name: "Online Intergroup AA",
      url: "https://central-query.apps.code4recovery.org/api/v1/meetings",
      adapter: "online-aa",
      config: {},
      interval: 24,
    },
    {
      id: "bmlt-static",
      name: "NA / BMLT daily static export",
      url: "https://cdn.aws.bmlt.app/aggregator/manifest.json",
      adapter: "bmlt-static",
      config: {},
      interval: 24,
    },
    {
      id: "smart-discovery",
      name: "SMART published meeting index",
      url: "https://meetings.smartrecovery.org/meetings/",
      adapter: "smart-discovery",
      config: { page: 1 },
      interval: 24,
    },
    {
      id: "aa-ga-statewide",
      name: "Georgia AA published index",
      url: "https://find.aageorgia.org/meetings/search/",
      adapter: "georgia",
      config: { page: 1 },
      interval: 24,
    },
    {
      id: "aa-mt-statewide",
      name: "Montana AA published city index",
      url: "https://www.aa-montana.org/meetings.php",
      adapter: "montana",
      config: { index: 0 },
      interval: 24,
    },
  );
  for (let i = 0; i < smartIndex.length; i += 40)
    jobs.push({
      id: "smart-calendar-" + Math.floor(i / 40),
      name: "SMART published calendars / " + (Math.floor(i / 40) + 1),
      url: "https://meetings.smartrecovery.org/meetings/",
      adapter: "smart-calendar",
      config: { meetings: smartIndex.slice(i, i + 40) },
      interval: 168,
    });
  await sql.query(
    `INSERT INTO atlas_source_job(id,name,url,adapter,config,interval_hours) SELECT r->>'id',r->>'name',r->>'url',r->>'adapter',r->'config',(r->>'interval')::int FROM jsonb_array_elements($1::jsonb)r ON CONFLICT(id)DO NOTHING`,
    [JSON.stringify(jobs)],
  );
  return jobs.length;
}
async function capture(job: Job) {
  if (job.adapter === "release-activation")
    return publishStagedProviderBatch(db(), job.id);
  if (["provider-discovery", "provider-chunk"].includes(job.adapter))
    return runProviderJob(db(), job);
  const signal = AbortSignal.timeout(65000),
    read = (url: string, options: Parameters<typeof readPublicSource>[1]) =>
      readPublicSource(url, { ...options, signal });
  const date = today(),
    sql = db();
  let rows: Resource[] = [],
    rawCount = 0,
    complete = true;
  let metadata: { etag: string | null; modified: string | null } | undefined;
  if (
    [
      "meeting-guide",
      "publisher-csv",
      "crawler-index",
      "broward-table",
      "venue-meetings",
      "sioux-falls",
      "samoan-serenity",
    ].includes(job.adapter)
  ) {
    const source = job.config;
    let feed = source.feed;
    const approved = hosts(source);
    if (/\/tsml-cache-/.test(feed) || job.adapter === "publisher-csv") {
      const page = (
        await read(source.page, { hosts: approved, max: 5000000 })
      ).text!.toString();
      const $ = load(page);
      if (job.adapter === "publisher-csv") {
        const id = new URL(feed).pathname.match(/\/d\/([^/]+)/)?.[1];
        if (!id || !page.includes(id))
          throw Error("Publisher no longer advertises this spreadsheet");
      } else {
        const advertised = $("#tsml-ui").attr("data-src");
        if (!advertised)
          throw Error("Publisher no longer advertises a public feed");
        feed = new URL(advertised, source.page).href;
      }
    }
    const result = await read(feed, {
      hosts: approved,
      etag: source.attendancePage ? undefined : job.etag,
      modified: source.attendancePage ? undefined : job.last_modified,
    });
    if (!result.text) return { notModified: true };
    metadata = { etag: result.etag, modified: result.modified };
    const weeklySchedule = source.attendancePage
      ? (
          await read(source.attendancePage, { hosts: approved })
        ).text?.toString()
      : undefined;
    if (source.attendancePage && !weeklySchedule)
      throw Error("Publisher weekly schedule is unavailable");
    const text = result.text.toString(),
      raw =
        job.adapter === "publisher-csv"
          ? parsePublisherMeetings(text, source.state)
          : job.adapter === "crawler-index"
            ? parseCrawlerIndex(
                text,
                source.state === "VI" ? "VI" : undefined,
                weeklySchedule,
              )
            : job.adapter === "broward-table"
              ? parseBrowardMeetings(text)
              : job.adapter === "venue-meetings"
                ? parseVenueMeetings(text, source.layout)
                : job.adapter === "sioux-falls"
                  ? parseSiouxFalls(text)
                  : job.adapter === "samoan-serenity"
                    ? parseSamoanSerenity(text)
                    : JSON.parse(text);
    if (!Array.isArray(raw)) throw Error("Changed publisher structure");
    rawCount = raw.length;
    rows = raw
      .map((m) => {
        const cancelled = Array.isArray(m.types) && m.types.includes("TC");
        const r = normalizeMeetingGuide(
          cancelled
            ? { ...m, types: m.types.filter((t: string) => t !== "TC") }
            : m,
          source,
          date,
        );
        if (r && job.adapter === "samoan-serenity")
          r.languages = ["English", "Samoan"];
        if (r && cancelled) {
          r.meeting!.endsOn = new Date(Date.now() - 86400000)
            .toISOString()
            .slice(0, 10);
          r.meeting!.notes =
            "Publisher reports this location temporarily closed. Check the official source before attending.";
        }
        return r;
      })
      .filter((r): r is Resource => !!r);
  } else if (job.adapter === "online-aa") {
    // This query covers one day of a weekly directory.
    complete = false;
    const midnight = new Date();
    midnight.setUTCHours(0, 0, 0, 0);
    for (let hour = 0; hour < 24; hour += 6) {
      const u = new URL(job.url);
      u.search = new URLSearchParams({
        start: new Date(+midnight + hour * 3600000).toISOString(),
        hours: "6",
        limit: "1000",
      }).toString();
      const raw = JSON.parse(
        (await read(u.href, { hosts: [u.hostname] })).text!.toString(),
      );
      if (!Array.isArray(raw) || raw.length >= 1000)
        throw Error("Online directory result limit requires review");
      rawCount += raw.length;
      rows.push(
        ...raw
          .map((m) => normalizeOnlineIntergroup(m, date))
          .filter((r): r is Resource => !!r),
      );
    }
  } else if (job.adapter === "bmlt-static") {
    const manifest = JSON.parse(
      (
        await read(job.url, { hosts: ["cdn.aws.bmlt.app"], max: 100000 })
      ).text!.toString(),
    );
    if (
      !manifest.generated_at ||
      Date.now() - Date.parse(manifest.generated_at) > 2 * 86400000
    )
      throw Error("NA static export is stale");
    const bytes = (
      await read("https://cdn.aws.bmlt.app/aggregator/meetings.ndjson.gz", {
        hosts: ["cdn.aws.bmlt.app"],
        max: 8000000,
        timeout: 30000,
      })
    ).text!;
    if (
      !JSON.stringify(manifest).includes(
        createHash("sha256").update(bytes).digest("hex"),
      )
    )
      throw Error("NA export checksum mismatch");
    const raw = gunzipSync(bytes, { maxOutputLength: 100000000 })
      .toString()
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    rows = raw
      .map((m) => normalizeBmlt(m, manifest.generated_at.slice(0, 10)))
      .filter((r): r is Resource => !!r);
    if (rows.length < 10000) throw Error("Incomplete US NA capture");
    rawCount = rows.length;
  } else if (job.adapter === "smart-discovery") {
    const page = Number(job.config.page || 1),
      url =
        page === 1
          ? job.url + "?coordinates=&location=Denver%2C+CO&finder_form=true"
          : job.url + "?page=" + page;
    const $ = load(
      (
        await read(url, { hosts: ["meetings.smartrecovery.org"], max: 5000000 })
      ).text!.toString(),
    );
    const meetings = $("a.meetinglistrow[href]")
      .toArray()
      .flatMap((e) => {
        const text = $(e).text().replace(/\s+/g, " "),
          state = Object.entries(stateNames).find(([, name]) =>
            text.includes(", " + name),
          )?.[0],
          href = $(e).attr("href");
        return state && href
          ? [[new URL(href.split("?")[0], job.url).href, state]]
          : [];
      });
    if (!meetings.length) throw Error("Changed SMART index structure");
    const next = $("a[href]")
      .toArray()
      .some((e) =>
        $(e)
          .attr("href")
          ?.includes("page=" + (page + 1) + "#"),
      );
    const id =
      "smart-discovered-" +
      createHash("sha256")
        .update(JSON.stringify(meetings))
        .digest("hex")
        .slice(0, 16);
    await sql.query(
      `INSERT INTO atlas_source_job(id,name,url,adapter,config,interval_hours) VALUES($1,'SMART discovered calendars',$2,'smart-calendar',$3::jsonb,168) ON CONFLICT DO NOTHING`,
      [id, job.url, JSON.stringify({ meetings })],
    );
    await sql.query(
      "UPDATE atlas_source_job SET config=jsonb_set(config,'{page}',to_jsonb($2::int)) WHERE id=$1",
      [job.id, next ? page + 1 : 1],
    );
    return { discovered: meetings.length, page };
  } else if (job.adapter === "smart-calendar") {
    let failures = 0;
    const urls = job.config.meetings as [string, string][];
    let cursor = 0;
    await Promise.all(
      Array.from({ length: 2 }, async () => {
        while (cursor < urls.length) {
          const [url, state] = urls[cursor++];
          try {
            const html = (
                await read(url, {
                  hosts: ["meetings.smartrecovery.org"],
                  max: 2000000,
                })
              ).text!.toString(),
              $ = load(html),
              link = $("a[href]")
                .toArray()
                .map((e) => $(e).attr("href"))
                .find((u) => u?.includes("/calendar/apple/"));
            if (!link) throw Error("Missing official calendar");
            const calendar = (
              await read(link, {
                hosts: [
                  "www.pathminder.co",
                  "pathminder.co",
                  "meetings.smartrecovery.org",
                ],
                max: 100000,
              })
            ).text!.toString();
            const r = normalizeSmartCalendar(html, calendar, url, state, date);
            if (r) rows.push(r);
            else if (/^STATUS:CANCELLED\s*$/im.test(calendar)) {
              const id = "smart-" + url.match(/meetings\/(\d+)/)?.[1];
              const [old] = await sql.query(
                "SELECT data FROM resources WHERE id=$1",
                [id],
              );
              if (old) {
                old.data.meeting.endsOn = new Date(Date.now() - 86400000)
                  .toISOString()
                  .slice(0, 10);
                rows.push({ ...old.data, sourceCheckedAt: date });
              }
            } else failures++;
          } catch {
            failures++;
          }
        }
      }),
    );
    rawCount = urls.length;
    if (failures > Math.max(2, urls.length * 0.25))
      throw Error("Too many unavailable or ambiguous SMART schedules");
    complete = failures === 0;
  } else if (job.adapter === "georgia" || job.adapter === "montana") {
    complete = false;
    const source: MeetingSource = {
      id: job.id,
      state: job.adapter === "georgia" ? "GA" : "MT",
      page: job.url,
      fellowship: "AA",
    };
    const html = (
        await read(job.url, {
          hosts: [new URL(job.url).hostname],
          max: 5000000,
        })
      ).text!.toString(),
      $ = load(html);
    if (job.adapter === "georgia") {
      const pages = Number($.text().match(/of\s+(\d+)\s+page\(s\)/)?.[1]);
      if (!pages || pages > 100) throw Error("Changed Georgia pagination");
      const first = Number(job.config.page || 1);
      for (let i = 0; i < 6; i++) {
        const n = ((first - 1 + i) % pages) + 1;
        const raw = parseGeorgia(
          n === 1
            ? html
            : (
                await read(job.url + "?dpage=" + n, {
                  hosts: [new URL(job.url).hostname],
                  max: 5000000,
                })
              ).text!.toString(),
        );
        rawCount += raw.length;
        rows.push(
          ...raw
            .map((m) => normalizeMeetingGuide(m, source, date))
            .filter((r): r is Resource => !!r),
        );
      }
      await sql.query(
        "UPDATE atlas_source_job SET config=jsonb_set(config,'{page}',to_jsonb($2::int)) WHERE id=$1",
        [job.id, ((first - 1 + 6) % pages) + 1],
      );
    } else {
      const cities = $("select[name=city_id] option")
        .toArray()
        .map((e) => ({ city: $(e).text().trim(), url: $(e).attr("value") }))
        .filter((c) => c.city && c.url);
      if (!cities.length || cities.length > 300)
        throw Error("Changed Montana city index");
      const start = Number(job.config.index || 0);
      for (let i = 0; i < 10; i++) {
        const c = cities[(start + i) % cities.length],
          url = new URL(c.url!, job.url).href,
          raw = parseMontana(
            (
              await read(url, {
                hosts: [new URL(job.url).hostname],
                max: 5000000,
              })
            ).text!.toString(),
            c.city,
            url,
          );
        rawCount += raw.length;
        rows.push(
          ...raw
            .map((m) => normalizeMeetingGuide(m, source, date))
            .filter((r): r is Resource => !!r),
        );
      }
      await sql.query(
        "UPDATE atlas_source_job SET config=jsonb_set(config,'{index}',to_jsonb($2::int)) WHERE id=$1",
        [job.id, (start + 10) % cities.length],
      );
    }
  } else throw Error("Unsupported source adapter");
  rows = [...new Map(rows.map((r) => [r.id, r])).values()];
  if (
    !acceptableCapture(
      complete ? job.record_count : null,
      rows.length,
      rawCount,
    )
  )
    throw Error(
      "Capture incomplete or unexpected decline; preserving existing listings",
    );
  return {
    ...(await installMeetingCapture(sql, job.id, rows, { complete })),
    metadata,
    partial: !complete,
  };
}
/** Independent leases and retry schedules prevent one publisher outage from blocking others. */
export async function runSourceJobs(budgetMs = 235000) {
  const sql = db();
  await seedSourceJobs();
  const deadline = Date.now() + budgetMs,
    results: any[] = [];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (Date.now() < deadline - 75000) {
        const [job] = await sql.query(
          `WITH due AS(SELECT id FROM atlas_source_job WHERE enabled AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) AND adapter NOT IN('nppes-weekly','census-batch') ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE atlas_source_job s SET lease_until=now()+interval '15 minutes',status='running',last_attempt_at=now() FROM due WHERE s.id=due.id RETURNING s.*`,
        );
        if (!job) break;
        try {
          const result: any = await capture(job as Job);
          await sql.query(
            `UPDATE atlas_source_job SET status=$2,attempts=0,lease_until=NULL,last_success_at=now(),last_error=NULL,record_count=COALESCE($3,record_count),etag=COALESCE($4,etag),last_modified=COALESCE($5,last_modified),next_run_at=now()+CASE WHEN adapter='release-activation' THEN interval '0 seconds' ELSE make_interval(hours=>interval_hours) END WHERE id=$1`,
            [
              job.id,
              result.complete === true
                ? "completed"
                : result.partial
                  ? "partial"
                  : "healthy",
              result.scanned ?? null,
              result.metadata?.etag ?? null,
              result.metadata?.modified ?? null,
            ],
          );
          await sql.query(
            "INSERT INTO atlas_source_run(source_id,status,counts) VALUES($1,$2,$3::jsonb)",
            [
              job.id,
              result.partial ? "partial" : "completed",
              JSON.stringify(result),
            ],
          );
          results.push({ source: job.id, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Source unavailable";
          await sql.query(
            "UPDATE atlas_source_job SET status='needs-review',attempts=attempts+1,lease_until=NULL,last_error=$2,next_run_at=now()+make_interval(hours=>$3::int) WHERE id=$1",
            [job.id, message, retryHours(job.attempts + 1)],
          );
          await sql.query(
            "INSERT INTO atlas_source_run(source_id,status,error) VALUES($1,'needs-review',$2)",
            [job.id, message],
          );
          results.push({ source: job.id, error: message });
        }
      }
    }),
  );
  return results;
}

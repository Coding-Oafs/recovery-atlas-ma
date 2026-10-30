import "server-only";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { db } from "./db";
import { resourceSchema } from "./types";
const feeds = [
  ["NH AA", "https://nhaa.net/meetings/"],
  ["NY Intergroup AA", "https://www.nyintergroup.org/meetings/"],
  ["Area 59 AA", "https://area59aa.org/meetings/"],
  ["South Jersey AA", "https://aasj.org/meetings/"],
  [
    "Rhode Island AA",
    "https://rhodeisland-aa.org/archives/meetings/?tsml-day=any",
  ],
  ["Buffalo AA", "https://buffaloaany.org/meetings/"],
  ["Syracuse AA", "https://www.aasyracuse.org/meetings/"],
  ["Recovery Dharma", "https://recoverydharma.org/meetings/"],
  ["Refuge Recovery", "https://refugerecoverymeetings.org/meetings/"],
] as const;
function canonical(value: string) {
  const u = new URL(value);
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(?:fbclid|gclid)$/i.test(key)) u.searchParams.delete(key);
  u.pathname = u.pathname.replace(/\/$/, "");
  return u.href;
}
async function fetchBounded(url: URL, host: string, max: number) {
  if (
    url.protocol !== "https:" ||
    url.hostname !== host ||
    url.port ||
    url.username ||
    url.password
  )
    throw Error("Unapproved feed location");
  const response = await fetch(url, {
    redirect: "manual",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw Error("Source returned " + response.status);
  if (Number(response.headers.get("content-length")) > max)
    throw Error("Source response too large");
  const reader = response.body!.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      throw Error("Source response too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function refreshMeetingSources() {
  const sql = db(),
    today = new Date().toISOString().slice(0, 10),
    [last] =
      await sql`SELECT details FROM sync_runs WHERE source='meeting-source-refresh' ORDER BY created_at DESC LIMIT 1`,
    start = Number(last?.details?.nextIndex ?? 0) % feeds.length;
  const details: {
    source: string;
    status: string;
    scanned?: number;
    queued?: number;
    error?: string;
    ignoredAmbiguousSources?: number;
  }[] = [];
  for (let i = 0; i < 2; i++) {
    const [name, url] = feeds[(start + i) % feeds.length];
    try {
      const page = new URL(url),
        html = await fetchBounded(page, page.hostname, 2_000_000),
        $ = load(html),
        src = $("#tsml-ui").attr("data-src");
      if (!src)
        throw Error("Public feed not found; manual source review required");
      const feed = new URL(src, page);
      const list = JSON.parse(
        await fetchBounded(feed, page.hostname, 12_000_000),
      );
      if (!Array.isArray(list)) throw Error("Changed feed structure");
      const map = new Map<string, Record<string, unknown>>();
      const duplicates = new Set<string>();
      for (const item of list) {
        if (typeof item.url !== "string" || !/^https:\/\//.test(item.url))
          continue;
        const key = canonical(item.url);
        if (map.has(key)) duplicates.add(key);
        else map.set(key, item);
      }
      for (const key of duplicates) map.delete(key);
      let queued = 0,
        scanned = 0;
      const urls = [...map.keys()].flatMap((u) => {
        const alternate = new URL(u);
        alternate.pathname = alternate.pathname.replace(/\/$/, "") + "/";
        return [u, alternate.href];
      });
      for (let offset = 0; offset < urls.length; offset += 500) {
        const rows =
          await sql`SELECT id,data FROM resources WHERE published AND resource_kind='meeting' AND data->>'sourceUrl'=ANY(${urls.slice(offset, offset + 500)}::text[])`;
        for (const row of rows) {
          scanned++;
          if (queued >= 100) continue;
          const item = map.get(canonical(row.data.sourceUrl));
          if (!item) continue;
          const old = resourceSchema.parse(row.data);
          if (!old.meeting) continue;
          const day = Number(item.day),
            time = String(item.time ?? "").slice(0, 5),
            zone = String(item.timezone ?? old.meeting.timezone);
          if (
            !Number.isInteger(day) ||
            day < 0 ||
            day > 6 ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
            !["America/New_York", "US/Eastern"].includes(zone)
          )
            continue;
          const proposed = {
            ...old,
            meeting: { ...old.meeting, days: [day], time },
            formats: [...old.formats],
          };
          if (typeof item.name === "string" && item.name.trim())
            proposed.name = item.name.trim().slice(0, 220);
          const attendance = item.attendance_option;
          if (attendance === "online") {
            proposed.formats = ["online"];
            proposed.lat = proposed.lng = null;
            proposed.coordinateAccuracy = "unavailable";
            proposed.address = "";
          } else if (attendance === "hybrid")
            proposed.formats = ["in-person", "online", "hybrid"];
          else if (attendance === "in_person" || attendance === "in-person")
            proposed.formats = ["in-person"];
          if (
            attendance !== "online" &&
            typeof item.formatted_address === "string" &&
            item.formatted_address.trim() &&
            item.formatted_address.replace(/, USA$/, "") !== old.address
          ) {
            proposed.address = item.formatted_address
              .replace(/, USA$/, "")
              .slice(0, 300);
            const lat = Number(item.latitude),
              lng = Number(item.longitude);
            if (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat !== 0 &&
              lng !== 0
            ) {
              proposed.lat = lat;
              proposed.lng = lng;
              proposed.coordinateAccuracy =
                item.approximate === "yes" ? "approximate" : "address";
            } else {
              proposed.lat = proposed.lng = null;
              proposed.coordinateAccuracy = "unavailable";
            }
          }
          if (Array.isArray(item.types) && item.types.includes("TC"))
            proposed.availability =
              "Source marks this meeting temporarily closed; confirm with the group.";
          if (JSON.stringify(proposed) === JSON.stringify(old)) continue;
          proposed.sourceCheckedAt = today;
          const validated = resourceSchema.safeParse(proposed);
          if (!validated.success) continue;
          const fingerprint = createHash("sha256")
            .update(
              JSON.stringify({
                id: row.id,
                data: { ...validated.data, sourceCheckedAt: "" },
              }),
            )
            .digest("hex");
          const added =
            await sql`INSERT INTO atlas_quality_proposal(resource_id,source,proposal,before_data,reason,fingerprint) VALUES(${row.id},${name + " official feed"},${JSON.stringify(validated.data)}::jsonb,${JSON.stringify(row.data)}::jsonb,'Automated source comparison: review changed schedule, location, name or attendance facts before publication.',${fingerprint}) ON CONFLICT(fingerprint) DO NOTHING RETURNING id`;
          queued += added.length;
        }
      }
      details.push({
        source: name,
        status: "completed",
        scanned,
        queued,
        ignoredAmbiguousSources: duplicates.size,
      });
    } catch (e) {
      details.push({
        source: name,
        status: "needs-review",
        error: e instanceof Error ? e.message : "Source unavailable",
      });
    }
  }
  await sql`INSERT INTO sync_runs(source,status,details) VALUES('meeting-source-refresh',${details.some((d) => d.status !== "completed") ? "needs-review" : "completed"},${JSON.stringify({ feeds: details, nextIndex: (start + 2) % feeds.length, note: "Proposed changes require administrator approval. No clinical or direct-verification dates were automatically changed." })}::jsonb)`;
  return details;
}

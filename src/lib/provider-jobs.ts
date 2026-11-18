import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { load } from "cheerio";
import { readPublicSource } from "./public-source";
import { readNppesWeekly } from "./nppes-stream";
import { normalizeNationalProvider } from "./provider-import";
import { installProviderChunk, providerHashSql } from "./provider-store";
import type { PipelineSql } from "./source-pipeline-store";
import type { Resource } from "./types";
const repo = "https://api.github.com/repos/Coding-Oafs/recovery-atlas-ma";
export async function discoverProviderUpdates(sql: PipelineSql) {
  const releases = JSON.parse(
    (
      await readPublicSource(repo + "/releases?per_page=100", {
        hosts: ["api.github.com"],
        max: 3000000,
      })
    ).text!.toString(),
  );
  const baseline = releases
    .filter(
      (r: any) =>
        /^nppes-baseline-/.test(r.tag_name) && !r.draft && !r.prerelease,
    )
    .sort(
      (a: any, b: any) =>
        Date.parse(b.published_at) - Date.parse(a.published_at),
    )[0];
  let chunks = 0;
  if (baseline) {
    const manifestUrl =
      "https://github.com/Coding-Oafs/recovery-atlas-ma/releases/download/" +
      baseline.tag_name +
      "/manifest.json";
    const manifest = JSON.parse(
      (
        await readPublicSource(manifestUrl, {
          hosts: [
            "github.com",
            "release-assets.githubusercontent.com",
            "objects.githubusercontent.com",
          ],
          max: 200000,
        })
      ).text!.toString(),
    );
    if (
      manifest.version !== 1 ||
      manifest.total < 500000 ||
      !Array.isArray(manifest.assets) ||
      manifest.assets.length > 1000 ||
      !/^https:\/\/download.cms.gov\/nppes\//.test(manifest.sourceUrl)
    )
      throw Error("Unexpected provider baseline manifest");
    const jobs = manifest.assets.map((a: any) => {
      if (
        !/^providers-\d{4}\.ndjson\.gz$/.test(a.name) ||
        !/^\w{64}$/.test(a.sha256) ||
        a.records > 5000
      )
        throw Error("Invalid provider chunk");
      return {
        id: baseline.tag_name + "-" + a.name.replace(/\..+/, ""),
        url: manifestUrl.replace("manifest.json", a.name),
        config: {
          ...a,
          checkedAt: manifest.checkedAt,
          sourceUrl: manifest.sourceUrl,
        },
      };
    });
    await sql.query(
      `INSERT INTO atlas_source_job(id,name,url,adapter,config,interval_hours) SELECT r->>'id','NPPES monthly public practice facts',r->>'url','provider-chunk',r->'config',87600 FROM jsonb_array_elements($1::jsonb)r ON CONFLICT DO NOTHING`,
      [JSON.stringify(jobs)],
    );
    chunks = jobs.length;
  }
  const index = (
      await readPublicSource("https://download.cms.gov/nppes/NPI_Files.html", {
        hosts: ["download.cms.gov"],
        max: 500000,
      })
    ).text!.toString(),
    $ = load(index);
  const weekly = $("a[href]")
    .toArray()
    .map((e) => $(e).attr("href") || "")
    .filter((h) =>
      /NPPES_Data_Dissemination_\d{6}_\d{6}_Weekly_V2\.zip$/.test(h),
    )
    .map((h) => new URL(h, "https://download.cms.gov/nppes/").href)
    .filter((h) => {
      const d = h.match(/Dissemination_(\d{6})_/)![1];
      return (
        Date.parse(
          "20" + d.slice(4) + "-" + d.slice(0, 2) + "-" + d.slice(2, 4),
        ) >= Date.parse("2026-11-02")
      );
    });
  await sql.query(
    `INSERT INTO atlas_source_job(id,name,url,adapter,config,interval_hours) SELECT 'nppes-weekly-'||md5(u),'NPPES weekly public registry changes',u,'nppes-weekly','{}',87600 FROM unnest($1::text[])u ON CONFLICT DO NOTHING`,
    [weekly],
  );
  return {
    monthlyChunks: chunks,
    weeklyArchives: weekly.length,
    baselineAvailable: !!baseline,
  };
}
export async function runProviderJob(
  sql: PipelineSql,
  job: { adapter: string; url: string; config: any },
) {
  if (job.adapter === "provider-discovery") return discoverProviderUpdates(sql);
  let raw: any[],
    deactivated: string[] = [],
    scanned = 0;
  if (job.adapter === "provider-chunk") {
    if (
      !job.url.startsWith(
        "https://github.com/Coding-Oafs/recovery-atlas-ma/releases/download/nppes-baseline-",
      )
    )
      throw Error("Invalid provider release URL");
    const bytes = (
      await readPublicSource(job.url, {
        hosts: [
          "github.com",
          "release-assets.githubusercontent.com",
          "objects.githubusercontent.com",
        ],
        max: 5000000,
        timeout: 30000,
      })
    ).text!;
    if (createHash("sha256").update(bytes).digest("hex") !== job.config.sha256)
      throw Error("Provider chunk checksum mismatch");
    raw = gunzipSync(bytes, { maxOutputLength: 15000000 })
      .toString()
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    if (raw.length !== job.config.records)
      throw Error("Incomplete provider chunk");
    scanned = raw.length;
  } else if (job.adapter === "nppes-weekly") {
    const result = await readNppesWeekly(job.url);
    raw = result.selected;
    deactivated = result.deactivated;
    scanned = result.scanned;
  } else throw Error("Unknown provider adapter");
  const date = new Date().toISOString().slice(0, 10),
    rows = raw
      .map((r) => normalizeNationalProvider(r, job.config.checkedAt || date))
      .filter((r): r is Resource => !!r);
  const result = await installProviderChunk(sql, rows);
  if (deactivated.length)
    await sql.query(
      `WITH inactive AS(SELECT r.id,r.data FROM resources r WHERE r.published AND r.data->>'sourceName' LIKE 'NPPES%' AND split_part(r.id,'-',2)=ANY($1::text[]) AND COALESCE(r.data->>'sourceRecordHash',r.provider_baseline_hash)=${providerHashSql("r.data")}),changed AS(UPDATE resources r SET published=false,updated_at=now() FROM inactive i WHERE r.id=i.id AND r.data=i.data RETURNING r.id,r.data) INSERT INTO audit_events(action,resource_id,before_data,after_data) SELECT 'nppes-explicit-deactivation',id,data,jsonb_build_object('published',false,'reason','Official NPPES deactivation record') FROM changed`,
      [deactivated],
    );
  return { ...result, scanned, deactivationRecords: deactivated.length };
}

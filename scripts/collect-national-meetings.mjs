import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { fileURLToPath } from "node:url";
import path from "node:path";

export async function collectNationalMeetings(root = process.cwd()) {
  const config = JSON.parse(
    await readFile(path.join(root, "data/meeting-sources.json"), "utf8"),
  );
  const directory = path.join(root, ".local/national-meetings");
  await mkdir(directory, { recursive: true });
  let manifest = [];
  try {
    manifest = JSON.parse(
      await readFile(path.join(directory, "manifest.json"), "utf8"),
    );
  } catch {}
  const jobs = [
    ...config.sources,
    ...config.aaDiscoveryPages
      .filter(([, url]) => !url.includes("aa-intergroup.org"))
      .map(([state, page]) => ({
        state,
        page,
        fellowship: "AA",
        id:
          "aa-" + createHash("sha256").update(page).digest("hex").slice(0, 12),
      })),
  ];
  const get = async (url) => {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(18000),
      headers: {
        "User-Agent":
          "RecoveryAtlas/1.0 (public meeting directory; source attribution retained)",
      },
    });
    if (!r.ok || r.status === 202) throw Error("Source HTTP " + r.status);
    const text = await r.text();
    if (text.length > 30_000_000) throw Error("Source exceeds size limit");
    return { text, url: r.url };
  };
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        if (
          manifest.some(
            (m) =>
              m.id === job.id &&
              m.status === "public-feed" &&
              m.checkedAt === new Date().toISOString().slice(0, 10),
          )
        )
          continue;
        const result = {
          ...job,
          checkedAt: new Date().toISOString().slice(0, 10),
        };
        try {
          let feed = job.feed;
          if (!feed) {
            const page = await get(job.page);
            await writeFile(path.join(directory, job.id + ".html"), page.text);
            const $ = load(page.text);
            const advertised =
              $("#tsml-ui").attr("data-src") ||
              $('link[title="Meetings Feed"]').attr("href") ||
              $('link[rel="alternate"][type="application/json"]')
                .filter((_, e) => /meeting/i.test($(e).attr("title") || ""))
                .first()
                .attr("href");
            const embedded = page.text
              .match(
                /(?:\"?dataSrc\"?|\"?data_source\"?|\"?dataUrl\"?)\s*:\s*\"(https[^\"]+)\"/i,
              )?.[1]
              ?.replaceAll("\\/", "/");
            feed = advertised || embedded;
            if (
              !feed &&
              /12-step-meeting-list|tsml_react_config|tsml-ui/.test(page.text)
            )
              feed = "/wp-admin/admin-ajax.php?action=meetings";
            if (!feed) throw Error("No advertised public meeting feed");
            feed = new URL(feed, page.url).href;
            const target = new URL(feed),
              publisher = new URL(page.url);
            if (
              target.protocol !== "https:" ||
              (target.hostname.replace(/^www\./, "") !==
                publisher.hostname.replace(/^www\./, "") &&
                target.hostname !== "sheets.code4recovery.org")
            )
              throw Error("External feed requires source review");
          }
          const payload = await get(feed);
          const data = JSON.parse(payload.text);
          if (
            !Array.isArray(data) ||
            !data.length ||
            !data.some((m) => m.name && m.time !== undefined)
          )
            throw Error("Unexpected meeting feed structure");
          await writeFile(
            path.join(directory, job.id + ".json"),
            JSON.stringify(data),
          );
          Object.assign(result, {
            feed: payload.url,
            status: "public-feed",
            records: data.length,
          });
        } catch (e) {
          Object.assign(result, { status: "needs-review", error: e.message });
        }
        manifest = [...manifest.filter((m) => m.id !== job.id), result];
        await writeFile(
          path.join(directory, "manifest.json"),
          JSON.stringify(manifest, null, 2),
        );
      }
    }),
  );
  return manifest.map(({ id, state, status, records, error }) => ({
    id,
    state,
    status,
    records,
    error,
  }));
}
if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await collectNationalMeetings(), null, 2));

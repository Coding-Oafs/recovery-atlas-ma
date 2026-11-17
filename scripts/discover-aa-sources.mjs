import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "cheerio";
export async function discoverAaSources(root) {
  const directory = root + "/.local/expansion-v2/aa";
  await mkdir(directory, { recursive: true });
  const jobs = JSON.parse(
    await readFile(root + "/data/meeting-candidates-v2.json", "utf8"),
  );
  let results = [];
  try {
    results = JSON.parse(await readFile(directory + "/manifest.json", "utf8"));
  } catch {}
  const get = async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok || r.status === 202) throw Error("Publisher HTTP " + r.status);
    const html = await r.text();
    if (html.length > 20_000_000) throw Error("Source size limit");
    return { html, url: r.url };
  };
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < jobs.length) {
        const [state, page, discoveredFrom] = jobs[cursor++],
          id =
            "aa-v2-" +
            createHash("sha256").update(page).digest("hex").slice(0, 12);
        if (results.some((r) => r.id === id && r.status === "public-feed"))
          continue;
        const result = {
          id,
          state,
          page,
          discoveredFrom,
          fellowship: "AA",
          checkedAt: new Date().toISOString().slice(0, 10),
        };
        try {
          let current = await get(page),
            $ = load(current.html);
          if (
            !/Alcoholics Anonymous|Intergroup|A\.A\.|AA Meetings/i.test(
              $.text(),
            )
          )
            throw Error("Publisher identity requires review");
          const feedOf = () =>
            $("#tsml-ui").attr("data-src") ||
            $('link[type="application/json"]')
              .filter((_, e) => /Meetings Feed/i.test($(e).attr("title") || ""))
              .first()
              .attr("href");
          let feed = feedOf();
          if (!feed) {
            const link = $("a[href]")
              .toArray()
              .map((e) => ({
                text: $(e).text().trim(),
                url: $(e).attr("href"),
              }))
              .find(
                (e) =>
                  /^(?:find (?:an? )?meeting|meetings|meeting finder|meeting list)/i.test(
                    e.text,
                  ) &&
                  e.url &&
                  new URL(e.url, current.url).hostname.replace(/^www\./, "") ===
                    new URL(current.url).hostname.replace(/^www\./, ""),
              );
            if (link) {
              current = await get(new URL(link.url, current.url));
              $ = load(current.html);
              feed = feedOf();
            }
          }
          if (!feed && /12-step-meeting-list/.test(current.html)) {
            const script = $("script[src]")
              .toArray()
              .map((e) => $(e).attr("src"))
              .find((u) =>
                u.includes("/wp-content/plugins/12-step-meeting-list/"),
              );
            if (script) {
              const u = new URL(script, current.url);
              feed =
                u.origin +
                u.pathname.split("/wp-content/")[0] +
                "/wp-admin/admin-ajax.php?action=meetings";
            }
          }
          if (!feed)
            throw Error(
              "No advertised public feed; custom adapter or publisher access needed",
            );
          const target = new URL(feed, current.url),
            publisher = new URL(current.url);
          if (
            target.protocol !== "https:" ||
            (target.hostname.replace(/^www\./, "") !==
              publisher.hostname.replace(/^www\./, "") &&
              target.hostname !== "sheets.code4recovery.org")
          )
            throw Error("External feed requires review");
          const payload = await get(target.href),
            rows = JSON.parse(payload.html);
          if (
            !Array.isArray(rows) ||
            !rows.length ||
            !rows.some((m) => m.name && m.time !== undefined)
          )
            throw Error("Changed feed structure");
          await writeFile(directory + "/" + id + ".json", JSON.stringify(rows));
          Object.assign(result, {
            page: current.url,
            feed: payload.url,
            status: "public-feed",
            records: rows.length,
          });
        } catch (e) {
          Object.assign(result, { status: "needs-review", error: e.message });
        }
        results = [...results.filter((r) => r.id !== id), result];
        await writeFile(
          directory + "/manifest.json",
          JSON.stringify(results, null, 2),
        );
      }
    }),
  );
  return results.map(({ id, state, status, records, error }) => ({
    id,
    state,
    status,
    records,
    error,
  }));
}

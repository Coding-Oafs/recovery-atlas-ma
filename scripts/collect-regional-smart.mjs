import { mkdir, readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
await mkdir(".local/northeast/smart", { recursive: true });
const origin = "https://meetings.smartrecovery.org",
  states = [
    "Massachusetts",
    "Connecticut",
    "Maine",
    "New Hampshire",
    "New Jersey",
    "New York",
    "Pennsylvania",
    "Rhode Island",
    "Vermont",
  ],
  urls = new Map();
let next = new URL(
    "/meetings/?coordinates=1000&location=Albany%2C+NY&finder_form=true",
    origin,
  ),
  page = 1;
while (next) {
  let html;
  const file = `.local/northeast/smart/page-${page}.html`;
  try {
    html = await readFile(file, "utf8");
  } catch {
    const r = await fetch(next, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error("SMART search " + r.status);
    html = await r.text();
    await writeFile(file, html);
  }
  const $ = load(html);
  for (const e of $("a.meetinglistrow[href]").toArray()) {
    const text = $(e).text().replace(/\s+/g, " ");
    const state = states.find((s) =>
      new RegExp(",\\s*" + s + "\\b").test(text),
    );
    if (!state) continue;
    const path = $(e).attr("href").split("?")[0];
    urls.set(new URL(path, origin).href, state);
  }
  const href =
    $('a[rel="next"]').attr("href") ??
    $("a[href]")
      .toArray()
      .map((e) => $(e).attr("href"))
      .find((h) => h.includes("page=" + (page + 1) + "#"));
  next = href ? new URL(href, new URL("/meetings/", origin)) : null;
  if (page % 5 === 0 || !next)
    console.log("SMART pages", page, "regional meetings", urls.size);
  if (++page > 100) throw Error("Review unexpectedly large pagination");
}
let cursor = 0;
const tasks = [...urls.entries()];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < tasks.length) {
      const [url] = tasks[cursor++],
        id = url.match(/meetings\/(\d+)/)[1],
        file = `.local/northeast/smart/meeting-${id}.html`;
      try {
        await readFile(file);
      } catch {
        const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw Error("SMART detail " + r.status);
        await writeFile(file, await r.text());
      }
    }
  }),
);
await writeFile(".local/northeast/smart/urls.json", JSON.stringify(tasks));
console.log("Captured SMART regional detail pages", tasks.length);

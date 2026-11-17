import { mkdir, readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
export async function collectNationalSmart(root, states) {
  const dir = root + "/.local/national-meetings/smart";
  await mkdir(dir, { recursive: true });
  const get = async (url, file) => {
    try {
      return await readFile(file, "utf8");
    } catch {}
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw Error("SMART HTTP " + r.status);
    const text = await r.text();
    await writeFile(file, text);
    return text;
  };
  const origin = "https://meetings.smartrecovery.org",
    urls = new Map();
  let page = 1,
    next =
      origin + "/meetings/?coordinates=&location=Denver%2C+CO&finder_form=true";
  while (next) {
    const $ = load(await get(next, dir + "/page-" + page + ".html"));
    for (const e of $("a.meetinglistrow[href]").toArray()) {
      const text = $(e).text().replace(/\s+/g, " "),
        state = Object.entries(states).find(([, name]) =>
          text.includes(", " + name),
        )?.[0];
      if (state)
        urls.set(new URL($(e).attr("href").split("?")[0], origin).href, state);
    }
    const href = $("a[href]")
      .toArray()
      .map((e) => $(e).attr("href"))
      .find((h) => h?.includes("page=" + (page + 1) + "#"));
    next = href ? new URL(href, origin + "/meetings/").href : null;
    if (++page > 100) throw Error("Unexpected SMART pagination");
  }
  await writeFile(dir + "/urls.json", JSON.stringify([...urls]));
  const jobs = [...urls.keys()],
    failures = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < jobs.length) {
        const url = jobs[cursor++],
          id = url.match(/meetings\/(\d+)/)?.[1];
        if (!id) continue;
        try {
          await get(url, dir + "/meeting-" + id + ".html");
        } catch (e) {
          failures.push({ url, error: e.message });
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }),
  );
  await writeFile(dir + "/failures.json", JSON.stringify(failures));
  return { pages: page - 1, meetings: jobs.length, failures: failures.length };
}

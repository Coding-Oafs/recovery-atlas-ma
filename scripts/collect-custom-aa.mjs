import { readFile, writeFile, mkdir } from "node:fs/promises";
import { load } from "cheerio";
// Invoke with: npx tsx scripts/collect-custom-aa.mjs
export async function collectCustomAA(root, parsers) {
  const { parseMontana, parseGeorgia } =
    parsers || (await import("../src/lib/meeting-index.ts"));
  const directory = root + "/.local/national-meetings";
  await mkdir(directory, { recursive: true });
  const get = async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok || r.status === 202) throw Error("Source HTTP " + r.status);
    return r.text();
  };
  const save = async (entry, rows) => {
    await writeFile(directory + "/" + entry.id + ".json", JSON.stringify(rows));
    let m = JSON.parse(await readFile(directory + "/manifest.json", "utf8"));
    m = m.filter((e) => e.id !== entry.id);
    m.push({
      ...entry,
      fellowship: "AA",
      adapter: "public-html",
      checkedAt: new Date().toISOString().slice(0, 10),
      status: "public-feed",
      records: rows.length,
    });
    await writeFile(directory + "/manifest.json", JSON.stringify(m, null, 2));
    return rows.length;
  };
  const results = [];
  for (const state of ["GA", "MT"])
    try {
      let rows = [];
      if (state === "GA") {
        const url = "https://find.aageorgia.org/meetings/search/";
        const first = await get(url),
          $ = load(first);
        const count = Number($.text().match(/of\s+(\d+)\s+page\(s\)/)?.[1]);
        if (!count || count > 100) throw Error("Changed Georgia pagination");
        rows.push(...parseGeorgia(first));
        for (let page = 2; page <= count; page++) {
          rows.push(...parseGeorgia(await get(url + "?dpage=" + page)));
          await new Promise((r) => setTimeout(r, 150));
        }
        await save({ id: "aa-ga-statewide", state, page: url }, rows);
      } else {
        const url = "https://www.aa-montana.org/meetings.php",
          html = await get(url),
          $ = load(html);
        const cities = $("select[name=city_id] option")
          .toArray()
          .map((e) => ({ city: $(e).text().trim(), url: $(e).attr("value") }))
          .filter((x) => x.city && x.url);
        for (const city of cities) {
          const page = new URL(city.url, url).href;
          rows.push(...parseMontana(await get(page), city.city, page));
          await new Promise((r) => setTimeout(r, 150));
        }
        await save({ id: "aa-mt-statewide", state, page: url }, rows);
      }
      results.push({ state, records: rows.length });
    } catch (e) {
      results.push({ state, error: e.message });
    }
  return results;
}

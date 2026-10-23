import { load } from "cheerio";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir(".local/sources/bsas-cities", { recursive: true });
const base =
  "https://hhsvgapps03.hhs.state.ma.us/elicensing-pubweb/prog/main.htm";
const cities = new Map();
for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
  const file = `.local/sources/bsas-cities/index-${letter}.html`;
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    text = await fetch(base + "?initialLetter=" + letter).then((r) => {
      if (!r.ok) throw Error("State index unavailable");
      return r.text();
    });
    await writeFile(file, text);
  }
  const $ = load(text);
  $('a[href*="cityId="]').each((_, el) => {
    const href = $(el).attr("href"),
      id = href.match(/cityId=(\d+)/)?.[1];
    if (id)
      cities.set(id, {
        id,
        name: $(el).text().trim(),
        url: new URL(href, base).toString(),
      });
  });
}
const tasks = [...cities.values()],
  programs = [],
  coverage = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (cursor < tasks.length) {
      const city = tasks[cursor++],
        file = `.local/sources/bsas-cities/${city.id}.html`;
      try {
        let text;
        try {
          text = await readFile(file, "utf8");
        } catch {
          const res = await fetch(city.url, {
            signal: AbortSignal.timeout(15000),
          });
          if (!res.ok) throw Error("HTTP " + res.status);
          text = await res.text();
          await writeFile(file, text);
        }
        const $ = load(text);
        let count = 0;
        $(".data_group_grid_container").each((_, el) => {
          const item = { sourceUrl: city.url, city: city.name };
          $(el)
            .children("div")
            .each((_, d) => {
              const label = $(d)
                .find("label")
                .first()
                .text()
                .trim()
                .replace(/:$/, "");
              const value = $(d)
                .find("span")
                .first()
                .text()
                .trim()
                .replace(/\s+/g, " ");
              if (label) item[label] = value;
              if (label === "Website")
                item.website = $(d).find("a").attr("href") ?? "";
            });
          if (item["Program name"]) {
            item.key = createHash("sha256")
              .update(item["Program name"] + "|" + item.Address)
              .digest("hex")
              .slice(0, 18);
            programs.push(item);
            count++;
          }
        });
        coverage.push({ city: city.name, id: city.id, count, complete: true });
      } catch (e) {
        coverage.push({
          city: city.name,
          id: city.id,
          complete: false,
          error: e.message,
        });
      }
      if (coverage.length % 50 === 0)
        console.log(
          "Treatment cities checked:",
          coverage.length,
          "programs:",
          programs.length,
        );
    }
  }),
);
await writeFile(".local/sources/bsas-programs.json", JSON.stringify(programs));
await writeFile(
  ".local/sources/bsas-coverage.json",
  JSON.stringify(
    {
      cities: coverage,
      programs: programs.length,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      cities: cities.size,
      programs: programs.length,
      incomplete: coverage.filter((c) => !c.complete),
    },
    null,
    2,
  ),
);

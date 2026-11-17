// Public agency links only; no staff names, personal contacts or inferred service hours.
import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
const sourceUrl = "https://www.samhsa.gov/grants/block-grants/subg/ssa-directory";
const html = process.argv[2] ? await readFile(process.argv[2], "utf8") : await fetch(sourceUrl).then(r => { if (!r.ok) throw Error(`Agency source ${r.status}`); return r.text(); });
const $ = load(html), rows = {};
const names = Object.fromEntries([...((await readFile("src/lib/region.ts", "utf8")).matchAll(/"([A-Z]{2})": "([^"]+)"/g))].map(m => [m[2], m[1]]));
Object.assign(names, { "Commonwealth of the Northern Mariana Islands": "MP", "Commonwealth of Puerto Rico": "PR", "United States Virgin Islands": "VI" });
$("h2").each((_, el) => {
  const heading = $(el), state = names[heading.text().trim()];
  if (!state) return;
  const link = heading.nextUntil("h2").find('a[href^="https://"]').first();
  const sectionUrl = sourceUrl + "#" + heading.find("a[id]").attr("id");
  rows[state] = { name: link.length ? link.text().trim() : heading.text().trim() + " — official agency directory", url: link.length ? link.attr("href") : sectionUrl, sourceUrl: sectionUrl, checkedAt: new Date().toISOString().slice(0,10) };
});
if (Object.keys(rows).length !== 56) throw Error(`Expected 50 states, DC and 5 populated territories; found ${Object.keys(rows).length}`);
await writeFile("data/state-help.json", JSON.stringify(rows, null, 2) + "\n");
console.log(`Saved ${Object.keys(rows).length} sourced state and territory agency links.`);

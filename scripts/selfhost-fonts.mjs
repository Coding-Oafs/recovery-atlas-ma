import { mkdir, writeFile } from "node:fs/promises";
await mkdir("public/fonts", { recursive: true });
const css = await fetch(
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap",
  { headers: { "User-Agent": "Mozilla/5.0" } },
).then((r) => r.text());
const urls = [
  ...new Set(
    [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(
      (x) => x[1],
    ),
  ),
];
let local = css;
for (let i = 0; i < urls.length; i++) {
  const url = urls[i],
    file = `font-${i}.${url.includes(".woff2") ? "woff2" : url.includes(".woff") ? "woff" : "ttf"}`;
  const r = await fetch(url);
  if (!r.ok) throw Error("Font download failed");
  await writeFile(`public/fonts/${file}`, Buffer.from(await r.arrayBuffer()));
  local = local.replaceAll(url, `/fonts/${file}`);
}
await writeFile("public/fonts/fonts.css", local);
console.log(`Self-hosted ${urls.length} font files`);

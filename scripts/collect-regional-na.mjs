import { readFile, writeFile, mkdir } from "node:fs/promises";
import zipcodes from "zipcodes";
await mkdir(".local/northeast/na-grid", { recursive: true });
const states = ["MA", "CT", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"];
const centers = [
  ...new Set(
    states
      .flatMap((s) => zipcodes.lookupByState(s))
      .map((z) =>
        [
          Math.floor(z.latitude / 2) * 2 + 1,
          Math.floor(z.longitude / 2) * 2 + 1,
        ].join(","),
      ),
  ),
].map((k) => k.split(",").map(Number));
const all = new Map(),
  formats = new Map();
let cursor = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < centers.length) {
      const [lat, lng] = centers[cursor++],
        file = `.local/northeast/na-grid/${lat}-${lng}.json`;
      let data;
      try {
        data = JSON.parse(await readFile(file, "utf8"));
      } catch {
        const url = new URL(
          "https://aggregator.bmltenabled.org/main_server/client_interface/json/",
        );
        url.search = new URLSearchParams({
          switcher: "GetSearchResults",
          get_used_formats: "1",
          lang_enum: "en",
          lat_val: String(lat),
          long_val: String(lng),
          geo_width: "100",
        });
        const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!r.ok) throw Error("NA public search " + r.status);
        data = await r.json();
        await writeFile(file, JSON.stringify(data));
      }
      for (const m of data.meetings ?? [])
        if (states.includes(m.location_province)) all.set(m.id_bigint, m);
      for (const f of data.formats ?? []) formats.set(f.id ?? f.key_string, f);
      console.log("NA search center", lat, lng, "regional unique", all.size);
    }
  }),
);
await writeFile(
  ".local/northeast/na-regional.json",
  JSON.stringify({
    meetings: [...all.values()],
    formats: [...formats.values()],
    centers,
    reviewedAt: "2026-10-26",
  }),
);
console.log("Regional NA records", all.size);

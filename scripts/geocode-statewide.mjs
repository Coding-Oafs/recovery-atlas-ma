import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
const inputPath = process.argv[2] ?? ".local/imports/statewide-resources.json";
const rows = JSON.parse(await readFile(inputPath, "utf8"));
const groups = new Map();
const street = (r) =>
  r.address
    .split(",")[0]
    .replace(/\s+(?:STE|SUITE|UNIT|APT|FL|FLOOR|#)\s*.*/i, "")
    .trim();
const key = (r) => [street(r), r.city, r.state, r.zip].join("|").toUpperCase();
for (const r of rows)
  if (r.coordinateAccuracy !== "address" && r.address && (r.zip || r.city)) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, { ...r, street: street(r) });
  }
const unique = [...groups.entries()];
await mkdir(".local/geocodes", { recursive: true });
function csvParse(text) {
  const out = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      row.push(field.replace(/\r$/, ""));
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    out.push(row);
  }
  return out;
}
const quote = (s) => '"' + String(s).replaceAll('"', '""') + '"';
const results = new Map();
console.log("Unique practice/program addresses", unique.length);
const batchSize = 1500,
  offsets = Array.from(
    { length: Math.ceil(unique.length / batchSize) },
    (_, i) => i * batchSize,
  );
let nextBatch = 0;
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (nextBatch < offsets.length) {
      const offset = offsets[nextBatch++];
      const chunk = unique.slice(offset, offset + batchSize);
      const body = chunk
        .map(([, r], i) =>
          [offset + i, r.street, r.city, r.state, r.zip].map(quote).join(","),
        )
        .join("\n");
      const fingerprint = createHash("sha256")
        .update(body)
        .digest("hex")
        .slice(0, 20);
      const file = `.local/geocodes/batch-${fingerprint}.csv`;
      let text;
      try {
        text = await readFile(file, "utf8");
      } catch {
        const form = new FormData();
        form.append(
          "addressFile",
          new Blob([body], { type: "text/csv" }),
          "addresses.csv",
        );
        form.append("benchmark", "Public_AR_Current");
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await fetch(
              "https://geocoding.geo.census.gov/geocoder/locations/addressbatch",
              {
                method: "POST",
                body: form,
                signal: AbortSignal.timeout(600000),
              },
            );
            if (!response.ok) throw Error("Census status " + response.status);
            text = await response.text();
            break;
          } catch (e) {
            console.log("Census batch attempt", attempt + 1, e.message);
            if (attempt < 2)
              await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
          }
        }
        if (!text) {
          console.log(
            "Retaining labeled approximate coordinates for this unavailable Census batch.",
          );
          continue;
        }
        await writeFile(file, text);
      }
      for (const c of csvParse(text)) {
        if (c[2] !== "Match") continue;
        const [lng, lat] = (c[5] ?? "").split(",").map(Number);
        if (lat >= 38.8 && lat <= 47.6 && lng >= -80.6 && lng <= -66.8)
          results.set(unique[Number(c[0])][0], { lat, lng });
      }
      console.log(
        "Processed",
        Math.min(offset + batchSize, unique.length),
        "matched",
        results.size,
      );
    }
  }),
);
for (const r of rows) {
  const match = results.get(key(r));
  if (r.coordinateAccuracy !== "address" && match)
    Object.assign(r, match, { coordinateAccuracy: "address" });
  if (r.lat === null && r.address) {
    const z = zipcodes.lookup(r.zip);
    if (
      z?.state === r.state &&
      z.latitude >= 38.8 &&
      z.latitude <= 47.6 &&
      z.longitude >= -80.6 &&
      z.longitude <= -66.8
    )
      Object.assign(r, {
        lat: z.latitude,
        lng: z.longitude,
        coordinateAccuracy: "approximate",
      });
  }
}
await writeFile(inputPath, JSON.stringify(rows));
console.log(
  "Geocoded address pins",
  rows.filter((r) => r.coordinateAccuracy === "address").length,
  "approximate",
  rows.filter((r) => r.coordinateAccuracy === "approximate").length,
);

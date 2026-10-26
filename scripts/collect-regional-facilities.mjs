import { mkdir, writeFile } from "node:fs/promises";
import { load } from "cheerio";
await mkdir(".local/northeast", { recursive: true });
for (const [kind, url] of [
  [
    "su",
    "https://www.samhsa.gov/data/sites/default/files/reports/rpt57009/2025_SU_Facilities_for_All_City_All.xlsx",
  ],
  [
    "mh",
    "https://www.samhsa.gov/data/sites/default/files/reports/rpt57010/2025_MH_Facilities_for_All_City_All.xlsx",
  ],
]) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error("SAMHSA " + kind + " HTTP " + response.status);
  await writeFile(
    `.local/northeast/samhsa-${kind}.xlsx`,
    new Uint8Array(await response.arrayBuffer()),
  );
}
const origin = "https://webapps.oasas.ny.gov/providerDirectory/";
const index = await fetch(origin, { signal: AbortSignal.timeout(30000) });
if (!index.ok) throw Error("OASAS index HTTP " + index.status);
const $ = load(await index.text()),
  body = new URLSearchParams();
for (const element of $("form input[name],form select[name]").toArray()) {
  const field = $(element),
    type = field.attr("type");
  if (["radio", "checkbox"].includes(type) && !field.is("[checked]")) continue;
  if (type === "submit") continue;
  body.set(field.attr("name"), String(field.val() ?? ""));
}
for (const [key, value] of Object.entries({
  search_type: "2",
  region_type: "0",
  rstformat: "1",
  Submit: "Submit",
}))
  body.set(key, value);
const response = await fetch(origin + "index.cfm", {
  method: "POST",
  body,
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw Error("OASAS export HTTP " + response.status);
const text = await response.text();
// The official spreadsheet response is CSV. Fail closed if the format changes.
if (!text.includes("PROGRAM_NUMBER"))
  throw Error("Review changed OASAS export format");
const rows = [];
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
  } else if (!quoted && (c === "," || c === "\n")) {
    row.push(field.replace(/\r$/, ""));
    field = "";
    if (c === "\n") {
      rows.push(row);
      row = [];
    }
  } else field += c;
}
if (field || row.length) {
  row.push(field.replace(/\r$/, ""));
  rows.push(row);
}
const headers = rows.shift().map((s) => s.replace(/^\uFEFF/, ""));
const programs = rows
  .filter((r) => r.length === headers.length)
  .map((r) =>
    Object.fromEntries(
      headers.flatMap((h, i) =>
        h.startsWith("PROGRAM_DIRECTOR") ? [] : [[h, r[i]]],
      ),
    ),
  );
await writeFile(
  ".local/northeast/oasas-programs.json",
  JSON.stringify(programs),
);
console.log(
  "Downloaded annual SAMHSA workbooks and public OASAS programs",
  programs.length,
);

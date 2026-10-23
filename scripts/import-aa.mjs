import { load } from "cheerio";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
await mkdir(".local/sources/aa", { recursive: true });
const meetings = new Map();
for (let day = 0; day < 7; day++) {
  let html;
  const file = `.local/sources/aa/boston-${day}.html`;
  try {
    html = await readFile(file, "utf8");
  } catch {
    const res = await fetch("https://aaboston.org/meetings?tsml-day=" + day);
    if (!res.ok) throw Error("AA public page " + res.status);
    html = await res.text();
    await writeFile(file, html);
  }
  const $ = load(html);
  for (const tr of $("tr").toArray()) {
    const row = $(tr),
      url = row.find("td.name a").attr("href");
    if (!url) continue;
    const address = row.find("td.address").text().trim(),
      sort = row.find("td.address").attr("data-sort") ?? "",
      city = row.find("td.region").text().trim(),
      postal = sort.match(/-ma-(\d{5})-/)?.[1];
    const online = row.hasClass("attendance-online"),
      hybrid = row.hasClass("attendance-hybrid");
    if (!postal && !online) continue;
    const raw = row.find("td.time").text().trim(),
      match = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    let time;
    if (match)
      time =
        String(
          (Number(match[1]) % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0),
        ).padStart(2, "0") +
        ":" +
        match[2];
    else if (/noon/i.test(raw)) time = "12:00";
    else if (/midnight/i.test(raw)) time = "00:00";
    else continue;
    meetings.set(url, {
      url,
      day,
      time,
      name: row.find("td.name a").text().trim(),
      address,
      city,
      zip: postal ?? "",
      online,
      hybrid,
      types: row.find("td.types").text().trim(),
      location: row.find(".location-name").text().trim(),
    });
  }
  console.log("AA day", day, "total", meetings.size);
}
const template = JSON.parse(
  await readFile(".local/imports/statewide-resources.json", "utf8"),
).find((r) => r.sourceName === "NERNA public BMLT meeting service");
const rows = [];
for (const m of meetings.values()) {
  const z = zipcodes.lookup(m.zip),
    online = m.online && !m.hybrid;
  if (!online && z?.state !== "MA") continue;
  rows.push({
    ...template,
    id:
      "aa-boston-" +
      createHash("sha256").update(m.url).digest("hex").slice(0, 16),
    name: m.name,
    city: m.city || "Massachusetts",
    address: online ? "" : `${m.address}, ${m.city}, MA ${m.zip}`,
    zip: m.zip,
    lat: online ? null : z.latitude,
    lng: online ? null : z.longitude,
    coordinateAccuracy: online ? "unavailable" : "approximate",
    website: m.url,
    sourceUrl: m.url,
    sourceName: "AA Boston public meeting listings",
    fellowship: "AA",
    formats: m.hybrid
      ? ["in-person", "online", "hybrid"]
      : online
        ? ["online"]
        : ["in-person"],
    description:
      "Alcoholics Anonymous peer-support meeting published in the Boston-area official directory. Confirm current schedule and attendance details with the source before attending.",
    services: ["Peer support"],
    accessibility: /Wheelchair Access/i.test(m.types)
      ? ["Wheelchair access"]
      : [],
    populations: m.types
      .split(",")
      .map((s) => s.trim())
      .filter((s) =>
        ["Men", "Women", "LGBTQ", "Young People", "Closed", "Open"].includes(s),
      ),
    meeting: {
      days: [m.day],
      time: m.time,
      duration: null,
      timezone: "America/New_York",
      joinUrl: null,
      notes: `Location: ${m.location}. Published formats: ${m.types}. Duration is not reported; confirm with the group.`,
    },
    hours: "See source for schedule and duration.",
    intake: "See the official meeting page for attendance and joining details.",
  });
}
await writeFile(".local/imports/aa-resources.json", JSON.stringify(rows));
console.log("Imported AA public listings", rows.length);

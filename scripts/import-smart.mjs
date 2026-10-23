import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import zipcodes from "zipcodes";
const urls = JSON.parse(
  await readFile(".local/sources/smart-ma-urls.json", "utf8"),
);
const template = JSON.parse(
  await readFile(".local/imports/aa-resources.json", "utf8"),
)[0];
const rows = [];
for (const url of urls) {
  const id = url.match(/meetings\/(\d+)/)[1],
    $ = load(await readFile(`.local/sources/smart/meeting-${id}.html`, "utf8"));
  const cal = $(".addeventatc"),
    start = cal.find(".start").text().trim(),
    end = cal.find(".end").text().trim(),
    zone = cal.find(".timezone").text().trim(),
    rule = cal.find(".recurring").text().trim();
  if (zone !== "America/New_York" || !rule.startsWith("FREQ=WEEKLY;BYDAY="))
    throw Error("Schedule needs review " + id);
  const days = rule
    .split("BYDAY=")[1]
    .split(",")
    .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(d));
  const city =
    $("title")
      .text()
      .match(/\d+ (.*), Massachusetts/)?.[1] || "Massachusetts";
  if (!city) throw Error("Missing Massachusetts location " + id);
  const link = $("a[href]")
    .toArray()
    .map((e) => $(e).attr("href"))
    .find((h) => h.startsWith("https://www.google.com/maps/dir//"));
  const address = link
    ? decodeURIComponent(link.split("/dir//")[1].split("?")[0])
    : "";
  const online = !address,
    zip = address.match(/\bMA (\d{5})/)?.[1] ?? "",
    z = zipcodes.lookup(zip) ?? zipcodes.lookupByName(city, "MA")[0];
  if (!online && !z) throw Error("Unmapped SMART location " + id);
  const text = cal.find(".description").text().replace(/\s+/g, " ").trim(),
    program =
      text.match(/Program: (.*?) Audiences:/)?.[1] ?? "Recovery support",
    audience = text.match(/Audiences: (.*?) Languages spoken:/)?.[1] ?? "";
  const duration =
    (Date.parse(end.replace(" ", "T") + "Z") -
      Date.parse(start.replace(" ", "T") + "Z")) /
    60000;
  rows.push({
    ...template,
    id: "smart-" + id,
    name: `SMART Recovery · ${program} — ${city} #${id}`,
    city,
    address,
    zip,
    lat: online ? null : z.latitude,
    lng: online ? null : z.longitude,
    coordinateAccuracy: online ? "unavailable" : "approximate",
    website: url,
    sourceUrl: url,
    sourceName: "SMART Recovery official public meeting pages",
    fellowship: "SMART Recovery",
    formats: online ? ["online"] : ["in-person"],
    description:
      "SMART Recovery mutual-support meeting from the official meeting finder. Confirm current schedule, participant eligibility and joining details on the source page.",
    services: ["Peer support", program],
    languages: text.includes("Languages spoken: English") ? ["English"] : [],
    populations: audience ? [audience] : [],
    accessibility: [],
    meeting: {
      days,
      time: start.slice(11, 16),
      duration,
      timezone: "America/New_York",
      joinUrl: null,
      notes:
        "See official meeting page for attendance instructions. Meeting schedules use the source calendar’s named time zone.",
    },
    intake:
      "Free peer support. Check the official meeting page for any participant restrictions and access details.",
  });
}
await writeFile(".local/imports/smart-resources.json", JSON.stringify(rows));
console.log(
  "SMART Massachusetts meetings",
  rows.length,
  "physical",
  rows.filter((r) => r.lat !== null).length,
);

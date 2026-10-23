import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
const $ = load(await readFile(".local/sources/central-aa-all.html", "utf8"));
const existing = JSON.parse(
  await readFile(".local/imports/aa-resources.json", "utf8"),
);
const template = existing[0];
const clean = (s) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
const signature = (r) =>
  [
    r.meeting.days[0],
    r.meeting.time,
    clean(r.address.split(",")[0]),
    clean(r.city),
  ].join("|");
const seen = new Set(existing.map(signature));
const rows = [];
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const time = (s) => {
  const m = s.match(/(\d+):(\d+)([AP])/);
  return m
    ? String((Number(m[1]) % 12) + (m[3] === "P" ? 12 : 0)).padStart(2, "0") +
        ":" +
        m[2]
    : null;
};
for (const e of $("#contentPlaceHolder2_GridView1 tr").toArray()) {
  const row = $(e),
    td = row.children("td");
  const day = days.indexOf(td.eq(0).text().trim()),
    start = time(row.find('span[id*="lblMeetingStart_"]').text()),
    end = time(row.find('span[id*="lblMeetingEnd_"]').text()),
    city = row.find('span[id*="lblMeetingTown_"]').text().trim(),
    name = row.find('a[id*="GridView1_MeetingName_"]').first().text().trim(),
    street = row.find('span[id*="lblStreetAddress_"]').text().trim(),
    online = /zoom|online|virtual/i.test(street),
    z = zipcodes.lookupByName(city, "MA");
  if (day < 0 || !start || !name || (!online && !z.length)) continue;
  const codes = row.find('span[id*="lblMeetingCode_"]').text().trim(),
    r = {
      ...template,
      id:
        "aa-central-" +
        createHash("sha256")
          .update([day, start, name, city, street].join("|"))
          .digest("hex")
          .slice(0, 16),
      name,
      city,
      address: online ? "" : street + ", " + city + ", MA",
      zip: online ? "" : z[0].zip,
      lat: online ? null : z.reduce((n, v) => n + v.latitude, 0) / z.length,
      lng: online ? null : z.reduce((n, v) => n + v.longitude, 0) / z.length,
      coordinateAccuracy: online ? "unavailable" : "approximate",
      website: "https://aaworcester.org/meetinglist.aspx?grp=wai",
      sourceUrl: "https://aaworcester.org/meetinglist.aspx?grp=wai",
      sourceName: "Worcester Area Intergroup public meeting list",
      formats: online ? ["online"] : ["in-person"],
      description:
        "Alcoholics Anonymous meeting published by Worcester Area Intergroup. Check the official directory for current access, format and schedule.",
      accessibility: codes.includes("H") ? ["Wheelchair access"] : [],
      populations: [],
      meeting: {
        days: [day],
        time: start,
        duration: end
          ? (Number(end.slice(0, 2)) * 60 +
              Number(end.slice(3)) -
              Number(start.slice(0, 2)) * 60 -
              Number(start.slice(3)) +
              1440) %
              1440 || 60
          : 60,
        timezone: "America/New_York",
        joinUrl: null,
        notes:
          "Published meeting codes: " +
          codes +
          ". Confirm full details with the official directory.",
      },
    };
  if (r.meeting.duration > 720) {
    r.meeting.duration = null;
    r.meeting.notes += " Source end time needs confirmation.";
  }
  const key = signature(r);
  if (seen.has(key)) continue;
  seen.add(key);
  rows.push(r);
}
await writeFile(
  ".local/imports/central-aa-resources.json",
  JSON.stringify(rows),
);
console.log("Additional central AA meetings", rows.length);

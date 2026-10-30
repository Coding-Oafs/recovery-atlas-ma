import type { Resource } from "./types";
import { nextMeeting } from "./search";
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s\uFEFF]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
const summary = (r: Resource) => ({
  name: r.name,
  type: r.fellowship ?? r.kind,
  address: r.address,
  city: r.city,
  state: r.state,
  zip: r.zip,
  phone: r.phone,
  website: r.website,
  formats: r.formats.join("; "),
  services: r.services.join("; "),
  days:
    r.meeting?.days
      .map(
        (d) =>
          [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ][d],
      )
      .join("; ") ?? "",
  time: r.meeting ? `${r.meeting.time} America/New_York` : "",
  duration: r.meeting?.duration ?? "",
  joining: r.meeting?.joinUrl ?? "",
  payment: r.payment.join("; "),
  insurance: r.insurance
    .map(
      (i) =>
        `${i.name} / ${i.plan} (${i.status}, checked ${i.checkedAt}): ${i.note}`,
    )
    .join("; "),
  paymentNote: r.paymentNote,
  intake: r.intake,
  accessibility: r.accessibility.join("; "),
  languages: r.languages.join("; "),
  populations: r.populations.join("; "),
  source: r.sourceUrl,
  sourceReviewed: r.sourceCheckedAt,
  sourceUpdated: r.sourceUpdatedAt ?? "",
  directlyVerified: r.verifiedAt ?? "",
  locationAccuracy: r.coordinateAccuracy,
  availability: r.availability,
  notes: r.meeting?.notes ?? "",
  description: r.description,
});
export function savedCSV(rows: Resource[]) {
  const keys = Object.keys(summary(rows[0]));
  return (
    "\uFEFF" +
    [
      keys.map(csvCell).join(","),
      ...rows.map((r) => Object.values(summary(r)).map(csvCell).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}
const escapeICS = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function foldICS(line: string) {
  let part = "",
    bytes = 0;
  const lines = [];
  for (const c of line) {
    const size = new TextEncoder().encode(c).length;
    if (bytes + size > 75) {
      lines.push(part);
      part = " ";
      bytes = 1;
    }
    part += c;
    bytes += size;
  }
  lines.push(part);
  return lines.join("\r\n");
}
export function savedCalendar(rows: Resource[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Recovery Atlas//Saved meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Recovery Atlas saved meetings",
    "BEGIN:VTIMEZONE",
    "TZID:America/New_York",
    "BEGIN:DAYLIGHT",
    "DTSTART:20070311T020000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0400",
    "TZNAME:EDT",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "DTSTART:20071104T020000",
    "TZOFFSETFROM:-0400",
    "TZOFFSETTO:-0500",
    "TZNAME:EST",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const r of rows) {
    if (!r.meeting) continue;
    const start = nextMeeting(r, now);
    if (!start) continue;
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(start),
      part = (type: string) => parts.find((p) => p.type === type)!.value,
      date = part("year") + part("month") + part("day");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${r.id}@recoveryatlas.vercel.app`,
      `DTSTAMP:${now
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z/, "Z")}`,
      `DTSTART;TZID=America/New_York:${date}T${r.meeting.time.replace(":", "")}00`,
      `RRULE:FREQ=WEEKLY;BYDAY=${[...new Set(r.meeting.days)]
        .sort()
        .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d])
        .join(",")}`,
      `SUMMARY:${escapeICS(r.name)}`,
      `LOCATION:${escapeICS(r.address || "Online — see official meeting page")}`,
      `DESCRIPTION:${escapeICS(`${r.description}\n${r.meeting.notes}\nAttendance: ${r.formats.join(", ")}\n${r.meeting.joinUrl ? "Join: " + r.meeting.joinUrl + "\n" : ""}Confirm current schedule and access before attending. Source reviewed: ${r.sourceCheckedAt}.\n${r.sourceUrl}`)}`,
      `URL:${r.sourceUrl}`,
      "CLASS:PRIVATE",
      "STATUS:TENTATIVE",
    );
    if (r.meeting.duration) lines.push(`DURATION:PT${r.meeting.duration}M`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldICS).join("\r\n") + "\r\n";
}
const html = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const printScript =
  "document.getElementById('print').addEventListener('click',()=>window.print());";
export function savedPrint(rows: Resource[]) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recovery Atlas · Saved resources</title><style>body{font:15px/1.6 system-ui;max-width:850px;margin:32px auto;padding:0 20px;color:#173e36}h1{font-size:28px}h2{font-size:20px}article{border-top:1px solid #bbb;padding:20px 0;break-inside:avoid}a{color:inherit;overflow-wrap:anywhere}p{margin:8px 0}button{padding:12px 20px;cursor:pointer}.small{font-size:12px} @media print{button{display:none}body{margin:0;max-width:none;padding:0}}</style><body><button id="print">Print / Save as PDF</button><h1>Your saved resources</h1><p>${rows.length} listings · Exported ${html(new Date().toISOString().slice(0, 10))}</p><p class="small">Keep this copy private. Schedules, services, payment and insurance can change. Confirm with the original source before traveling or arranging care.</p>${rows.map((r) => `<article><h2>${html(r.name)}</h2><p>${html(r.fellowship ?? r.kind)} · ${html(r.city)}, ${html(r.state)} · ${html(r.formats.join(", "))}</p><p>${html(r.address || "Online — see source for joining instructions")}${r.coordinateAccuracy === "approximate" ? " (approximate map location)" : ""}</p>${r.phone ? `<p>Phone: ${html(r.phone)}</p>` : ""}${r.meeting ? `<p>${html(r.meeting.days.map((d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]).join(", "))} at ${html(r.meeting.time)} Eastern${r.meeting.duration ? " · " + r.meeting.duration + " minutes" : ""}</p>` : ""}<p>${html(r.description)}</p><p>Services: ${html(r.services.join(", "))}</p><p>Payment: ${html(r.payment.join(", ") || "Not reported")}. ${html(r.paymentNote)}</p>${r.insurance.length ? `<p>Insurance: ${html(summary(r).insurance)}</p>` : ""}<p>${html(r.intake)}</p>${r.meeting?.notes ? `<p>${html(r.meeting.notes)}</p>` : ""}<p><a href="${html(r.sourceUrl)}">${html(r.sourceUrl)}</a></p><p class="small">Source reviewed ${html(r.sourceCheckedAt)}. Direct verification: ${html(r.verifiedAt || "Not recorded")}.</p></article>`).join("")}<script>${printScript}</script></body></html>`;
}

import type { Resource } from "./types";
import type { MeetingTimeFilters } from "./meeting-time";
import { nextMeeting } from "./search";
import { getVtimezoneComponent } from "@touch4it/ical-timezones";
// Referrer-Policy: no-referrer makes Chromium send Origin:null for form navigations.
// Fetch Metadata still binds a browser's print submission to this exact origin.
export function isSameOriginPrintNavigation(request: Request) {
  const h = request.headers;
  return (
    new URL(request.url).searchParams.get("format") === "print" &&
    h.get("origin") === "null" &&
    h.get("sec-fetch-site") === "same-origin" &&
    h.get("sec-fetch-mode") === "navigate" &&
    h.get("sec-fetch-dest") === "document" &&
    !!h.get("content-type")?.startsWith("application/x-www-form-urlencoded")
  );
}
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
  time: r.meeting ? `${r.meeting.time} ${r.meeting.timezone}` : "",
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
export type CalendarOptions = {
  reminder?: boolean;
  nextOnly?: boolean;
  duration?: number;
  timeFilters?: Partial<MeetingTimeFilters>;
};
export function savedCalendar(
  rows: Resource[],
  now = new Date(),
  options: CalendarOptions = {},
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Recovery Atlas//Saved meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Recovery Atlas saved meetings",
  ];
  const criteria = options.nextOnly ? options.timeFilters : undefined;
  const meetings = rows.filter(
    (r) => r.meeting && nextMeeting(r, now, criteria),
  );
  for (const zone of new Set(meetings.map((r) => r.meeting!.timezone))) {
    const component = getVtimezoneComponent(zone);
    if (!component) throw Error("Calendar time zone is unavailable.");
    lines.push(
      ...component
        .replace(/\r?\n[ \t]/g, "")
        .trim()
        .split(/\r?\n/),
    );
  }
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
  for (const r of meetings) {
    const m = r.meeting!,
      start = nextMeeting(r, now, criteria)!;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: m.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(start);
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const date = part("year") + part("month") + part("day"),
      time = m.time.replace(":", "") + "00";
    lines.push(
      "BEGIN:VEVENT",
      "UID:" +
        r.id +
        (options.nextOnly ? "-" + date : "") +
        "@recoveryatlas.vercel.app",
      "DTSTAMP:" + stamp,
      "DTSTART;TZID=" + m.timezone + ":" + date + "T" + time,
    );
    if (!options.nextOnly) {
      lines.push(
        "RRULE:FREQ=WEEKLY;BYDAY=" +
          [...new Set(m.days)]
            .sort()
            .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][d])
            .join(","),
      );
      const dates = (m.exceptions ?? [])
        .filter((e) => e.cancelled)
        .map((e) => e.date.replace(/-/g, "") + "T" + time);
      if (dates.length)
        lines.push(
          "EXDATE;TZID=" + m.timezone + ":" + [...new Set(dates)].join(","),
        );
    }
    lines.push(
      "SUMMARY:" + escapeICS(r.name),
      "LOCATION:" +
        escapeICS(r.address || "Online � see official meeting page"),
      "DESCRIPTION:" +
        escapeICS(
          r.description +
            "\n" +
            m.notes +
            "\nAttendance: " +
            r.formats.join(", ") +
            "\n" +
            (m.joinUrl ? "Join: " + m.joinUrl + "\n" : "") +
            "Confirm current schedule and access before attending. Source reviewed: " +
            r.sourceCheckedAt +
            ".\n" +
            r.sourceUrl,
        ),
      "URL:" + escapeICS(r.sourceUrl),
      "CLASS:PRIVATE",
      "STATUS:TENTATIVE",
    );
    const duration =
      m.duration ?? (options.nextOnly ? options.duration : undefined);
    if (
      duration &&
      Number.isInteger(duration) &&
      duration >= 1 &&
      duration <= 720
    )
      lines.push("DURATION:PT" + duration + "M");
    if (options.reminder)
      lines.push(
        "BEGIN:VALARM",
        "TRIGGER:-PT10M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Saved event",
        "END:VALARM",
      );
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
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recovery Atlas � Saved resources</title><style>body{font:15px/1.6 system-ui;max-width:850px;margin:32px auto;padding:0 20px;color:#173e36}h1{font-size:28px}h2{font-size:20px}article{border-top:1px solid #bbb;padding:20px 0;break-inside:avoid}a{color:inherit;overflow-wrap:anywhere}p{margin:8px 0}button{padding:12px 20px;cursor:pointer}.small{font-size:12px} @media print{button{display:none}body{margin:0;max-width:none;padding:0}}</style><body><button id="print">Print / Save as PDF</button><h1>Your saved resources</h1><p>${rows.length} listings � Exported ${html(new Date().toISOString().slice(0, 10))}</p><p class="small">Keep this copy private. Schedules, services, payment and insurance can change. Confirm with the original source before traveling or arranging care.</p>${rows.map((r) => `<article><h2>${html(r.name)}</h2><p>${html(r.fellowship ?? r.kind)} � ${html(r.city)}, ${html(r.state)} � ${html(r.formats.join(", "))}</p><p>${html(r.address || "Online � see source for joining instructions")}${r.coordinateAccuracy === "approximate" ? " (approximate map location)" : ""}</p>${r.phone ? `<p>Phone: ${html(r.phone)}</p>` : ""}${r.meeting ? `<p>${html(r.meeting.days.map((d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]).join(", "))} at ${html(r.meeting.time)} ${html(r.meeting.timezone)}${r.meeting.duration ? " � " + r.meeting.duration + " minutes" : ""}</p>` : ""}<p>${html(r.description)}</p><p>Services: ${html(r.services.join(", "))}</p><p>Payment: ${html(r.payment.join(", ") || "Not reported")}. ${html(r.paymentNote)}</p>${r.insurance.length ? `<p>Insurance: ${html(summary(r).insurance)}</p>` : ""}<p>${html(r.intake)}</p>${r.meeting?.notes ? `<p>${html(r.meeting.notes)}</p>` : ""}<p><a href="${html(r.sourceUrl)}">${html(r.sourceUrl)}</a></p><p class="small">Source reviewed ${html(r.sourceCheckedAt)}. Direct verification: ${html(r.verifiedAt || "Not recorded")}.</p></article>`).join("")}<script>${printScript}</script></body></html>`;
}

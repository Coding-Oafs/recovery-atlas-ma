import { load } from "cheerio";
import { normalizeMeetingGuide } from "./meeting-import";
import { stateNames } from "./region";
import { resourceSchema, type Resource } from "./types";

/** Read only calendar schedule facts. Descriptions, organizers and access credentials are excluded. */
export function readWeeklyCalendar(calendar: string) {
  const unfolded = calendar.replace(/\r?\n[ \t]/g, ""),
    event = unfolded.match(/BEGIN:VEVENT\r?\n([\s\S]*?)END:VEVENT/)?.[1];
  if (
    !event ||
    /^STATUS:CANCELLED\s*$/im.test(event) ||
    (calendar.match(/BEGIN:VEVENT/g) || []).length !== 1
  )
    return null;
  const start = event.match(
    /^DTSTART(?:;TZID=([^;:\r\n]+))?[^:\r\n]*:(\d{8}T\d{6}Z?)\s*$/im,
  );
  const end = event.match(
    /^DTEND(?:;TZID=([^;:\r\n]+))?[^:\r\n]*:(\d{8}T\d{6}Z?)\s*$/im,
  );
  const rule = event.match(/^RRULE:(.+)$/im)?.[1].trim();
  if (
    !start ||
    !rule ||
    !/(?:^|;)FREQ=WEEKLY(?:;|$)/.test(rule) ||
    /\bINTERVAL=(?!1(?:;|$))/.test(rule) ||
    /(?:^|;)(?:COUNT|BYSETPOS|BYMONTH|BYMONTHDAY|BYYEARDAY|BYWEEKNO)=/.test(
      rule,
    )
  )
    return null;
  const timezone =
    start[1]?.replace(/^"|"$/g, "") || (start[2].endsWith("Z") ? "UTC" : null);
  if (!timezone) return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return null;
  }
  const time = start[2].slice(9, 11) + ":" + start[2].slice(11, 13),
    date =
      start[2].slice(0, 4) +
      "-" +
      start[2].slice(4, 6) +
      "-" +
      start[2].slice(6, 8);
  const days = rule
    .match(/(?:^|;)BYDAY=([^;]+)/)?.[1]
    .split(",")
    .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(d)) ?? [
    new Date(date + "T12:00:00Z").getUTCDay(),
  ];
  if (days.some((d) => d < 0)) return null;
  const minutes = (s: string) =>
    Number(s.slice(9, 11)) * 60 + Number(s.slice(11, 13));
  const duration = end
    ? (minutes(end[2]) - minutes(start[2]) + 1440) % 1440
    : null;
  const until = rule.match(/(?:^|;)UNTIL=(\d{8}T\d{6}Z)/)?.[1];
  const dateInZone = (s: string) =>
    s.endsWith("Z")
      ? new Intl.DateTimeFormat("sv-SE", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(
          new Date(
            s.slice(0, 4) +
              "-" +
              s.slice(4, 6) +
              "-" +
              s.slice(6, 8) +
              "T" +
              s.slice(9, 11) +
              ":" +
              s.slice(11, 13) +
              ":" +
              s.slice(13, 15) +
              "Z",
          ),
        )
      : s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  const exceptions = [...event.matchAll(/^EXDATE[^:\r\n]*:([^\r\n]+)/gim)]
    .flatMap((m) => m[1].split(","))
    .map((s) => ({
      date: dateInZone(s),
      cancelled: true,
      note: "Excluded by the official meeting calendar.",
    }));
  return {
    days,
    time,
    timezone,
    duration: duration && duration <= 720 ? duration : null,
    startsOn: date,
    endsOn: until ? dateInZone(until) : undefined,
    exceptions,
  };
}
export function normalizeSmartCalendar(
  html: string,
  calendar: string,
  url: string,
  state: string,
  today: string,
): Resource | null {
  const schedule = readWeeklyCalendar(calendar);
  if (!schedule) return null;
  const $ = load(html),
    id = url.match(/meetings\/(\d+)/)?.[1];
  if (!id) return null;
  const map = $("a[href]")
    .toArray()
    .map((e) => $(e).attr("href"))
    .find((u) => u?.startsWith("https://www.google.com/maps/dir//"));
  let address = map
    ? decodeURIComponent(map.split("/dir//")[1].split("?")[0])
    : "";
  const stateName = stateNames[state as keyof typeof stateNames];
  if (stateName)
    address = address.replace(
      new RegExp(",\\s*" + stateName + "(\\s+\\d{5}(?:-\\d{4})?)?$", "i"),
      ", " + state + "$1",
    );
  const city =
    $("title")
      .text()
      .match(/Meeting #\d+ (.*), /)?.[1]
      ?.trim() || "";
  const source = {
    id: "smart-national",
    state,
    page: "https://meetings.smartrecovery.org/meetings/",
    fellowship: "SMART Recovery",
  };
  const result = normalizeMeetingGuide(
    {
      name: "SMART Recovery – " + (city || "Online") + " #" + id,
      url,
      state,
      city,
      formatted_address: address,
      day: schedule.days,
      time: schedule.time,
      timezone: schedule.timezone,
      attendance_option: address ? "in_person" : "online",
    },
    source,
    today,
  );
  if (!result) return null;
  const field = (label: string) => {
    const node = $("strong")
      .toArray()
      .find((e) => $(e).text().trim() === label)?.nextSibling;
    return node?.type === "text" ? node.data.replace(/\s+/g, " ").trim() : "";
  };
  const program = field("Program:");
  if (program && program.length <= 60)
    result.name = (
      "SMART Recovery · " +
      program +
      " — " +
      (city || "Online") +
      " #" +
      id
    ).slice(0, 220);
  const languages = field("Languages spoken:");
  if (languages)
    result.languages = languages
      .split(/,|\s+and\s+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 80)
      .slice(0, 10);
  const audiences = field("Specific audiences:");
  if (audiences && audiences.length <= 100) result.populations = [audiences];
  result.id = "smart-" + id;
  result.sourceName =
    "SMART Recovery official meeting page and published calendar";
  result.meeting = { ...result.meeting!, ...schedule };
  return resourceSchema.parse(result);
}

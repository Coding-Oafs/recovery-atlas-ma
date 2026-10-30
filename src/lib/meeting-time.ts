import type { Filters } from "./types";
export type MeetingTimeFilters = Pick<
  Filters,
  | "day"
  | "soon"
  | "meetingWindow"
  | "meetingDate"
  | "startAfter"
  | "startBefore"
  | "timeZone"
>;
export function hasMeetingTimeFilter(f?: Partial<MeetingTimeFilters>) {
  return (
    !!f &&
    (!!f.soon ||
      !!f.day ||
      !!f.meetingWindow ||
      !!f.startAfter ||
      !!f.startBefore)
  );
}
export function localDate(date: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
function shiftDay(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function midnight(date: string, zone: string) {
  const target = Date.parse(date + "T00:00:00Z");
  let value = target;
  for (let i = 0; i < 4; i++) {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));
    const n = (key: string) => Number(p.find((x) => x.type === key)!.value);
    value +=
      target -
      Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"));
  }
  return new Date(value);
}
export function meetingTimeBounds(
  f: Partial<MeetingTimeFilters> = {},
  now = new Date(),
) {
  const zone = f.timeZone || "America/New_York",
    today = localDate(now, zone);
  let start = now,
    end: Date | null = null;
  if (f.meetingWindow === "24h") end = new Date(now.getTime() + 86400000);
  else if (f.meetingWindow === "7days")
    end = new Date(now.getTime() + 7 * 86400000);
  else if (
    ["today", "tomorrow", "date", "weekend"].includes(f.meetingWindow ?? "")
  ) {
    let date = today,
      days = 1;
    if (f.meetingWindow === "tomorrow") date = shiftDay(today, 1);
    if (f.meetingWindow === "date") date = f.meetingDate || today;
    if (f.meetingWindow === "weekend") {
      const day = new Date(today + "T12:00:00Z").getUTCDay();
      date = shiftDay(today, day === 0 ? -1 : 6 - day);
      days = 2;
    }
    start = new Date(Math.max(now.getTime(), midnight(date, zone).getTime()));
    end = midnight(shiftDay(date, days), zone);
  }
  if (f.soon) {
    const soon = new Date(now.getTime() + 3 * 3600000);
    if (!end || soon < end) end = soon;
  }
  return { start, end, zone };
}
export function matchingStartTime(date: Date, f: Partial<MeetingTimeFilters>) {
  if (!f.startAfter && !f.startBefore) return true;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: f.timeZone || "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const time =
    parts.find((p) => p.type === "hour")!.value +
    ":" +
    parts.find((p) => p.type === "minute")!.value;
  if (f.startAfter && f.startBefore && f.startAfter > f.startBefore)
    return time >= f.startAfter || time < f.startBefore;
  return (
    (!f.startAfter || time >= f.startAfter) &&
    (!f.startBefore || time < f.startBefore)
  );
}

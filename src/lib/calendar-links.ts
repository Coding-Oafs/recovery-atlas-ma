import type { Resource, Filters } from "./types";
import { nextMeeting } from "./search";
const compact = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
export function calendarLinks(
  resource: Resource,
  duration: number,
  now = new Date(),
  timeFilters?: Partial<Filters>,
) {
  const start = nextMeeting(resource, now, timeFilters);
  if (!resource.meeting || !start) return null;
  const minutes = resource.meeting.duration ?? duration;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 720)
    throw Error("Choose a calendar duration.");
  const end = new Date(start.getTime() + minutes * 60000),
    description = `${resource.description}\n\nConfirm current schedule and access with the group before attending.\n${resource.meeting.notes}\nSource reviewed: ${resource.sourceCheckedAt}\n${resource.sourceUrl}`,
    location =
      resource.address ||
      "Online — see the official source for joining instructions";
  const google = new URL("https://calendar.google.com/calendar/render");
  google.search = new URLSearchParams({
    action: "TEMPLATE",
    text: resource.name,
    dates: compact(start) + "/" + compact(end),
    details: description,
    location,
    ctz: resource.meeting.timezone,
  }).toString();
  const outlookParams = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: resource.name,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: description,
    location,
  });
  const outlook = new URL(
    "https://outlook.live.com/calendar/0/deeplink/compose",
  );
  outlook.search = outlookParams.toString();
  const microsoft = new URL(
    "https://outlook.office.com/calendar/0/deeplink/compose",
  );
  microsoft.search = outlookParams.toString();
  const yahoo = new URL("https://calendar.yahoo.com/");
  yahoo.search = new URLSearchParams({
    v: "60",
    title: resource.name,
    st: compact(start),
    et: compact(end),
    desc: description,
    in_loc: location,
  }).toString();
  return {
    start,
    end,
    google: google.href,
    outlook: outlook.href,
    microsoft: microsoft.href,
    yahoo: yahoo.href,
  };
}

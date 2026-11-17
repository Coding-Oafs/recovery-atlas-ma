"use client";
import { T, useLanguage } from "./language-provider";
import { useState } from "react";
import type { Resource, Filters } from "@/lib/types";
import { calendarLinks } from "@/lib/calendar-links";
export default function AddCalendar({
  resource: r,
  timeFilters,
}: {
  resource: Resource;
  timeFilters?: Filters;
}) {
  const { t } = useLanguage();

  const [duration, setDuration] = useState(60),
    [reminder, setReminder] = useState(false),
    [message, setMessage] = useState("");
  if (!r.meeting) return null;
  const links = calendarLinks(r, duration, new Date(), timeFilters);
  if (!links) return null;
  async function download(nextOnly: boolean) {
    setMessage("");
    try {
      const response = await fetch("/api/saved/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [r.id],
          format: "ics",
          reminder,
          nextOnly,
          duration,
          timeFilters,
        }),
      });
      if (!response.ok) throw Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "recovery-atlas-meeting.ics";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(
        "Calendar file ready. Open or import it in Apple Calendar, Outlook, Google Calendar or another calendar app.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Calendar download unavailable.",
      );
    }
  }
  return (
    <details className="add-calendar">
      <summary>
        {""}
        <T>Add to your calendar</T>
        {""}
      </summary>
      <p>
        {" "}
        <T>Next scheduled meeting:</T> {links.start.toLocaleString()} (
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
        {""}
        <T>). Confirm the meeting with its source.</T>{" "}
      </p>
      {r.meeting.duration === null ? (
        <label>
          {" "}
          <T>
            Duration is not reported. Choose the time to reserve in your
            calendar
          </T>{" "}
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {n} <T>minutes</T>{" "}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="small muted">
        {" "}
        <T>
          These buttons open one event for you to review and save. Meeting
          details are sent to the calendar service you choose. That service
          controls the event’s privacy and reminders.
        </T>{" "}
      </p>
      <div className="saved-tool-buttons">
        <a
          className="secondary"
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
        >
          {" "}
          <T>Google Calendar</T>{" "}
        </a>
        <a
          className="secondary"
          href={links.outlook}
          target="_blank"
          rel="noopener noreferrer"
        >
          {" "}
          <T>Outlook.com</T>{" "}
        </a>
        <a
          className="secondary"
          href={links.microsoft}
          target="_blank"
          rel="noopener noreferrer"
        >
          {" "}
          <T>Microsoft 365</T>{" "}
        </a>
        <a
          className="secondary"
          href={links.yahoo}
          target="_blank"
          rel="noopener noreferrer"
        >
          {" "}
          <T>Yahoo Calendar</T>{" "}
        </a>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={reminder}
          onChange={(e) => setReminder(e.target.checked)}
        />{" "}
        <T>Include a 10-minute reminder in calendar downloads</T>{" "}
      </label>
      <p className="small muted">
        {" "}
        <T>
          Your calendar may display meeting names on a shared screen or lock
          screen. The reminder text is “Saved event.”
        </T>{" "}
      </p>
      <div className="saved-tool-buttons">
        <button className="secondary" onClick={() => download(true)}>
          {" "}
          <T>Apple / Other calendars (.ics)</T>{" "}
        </button>
        <button className="secondary" onClick={() => download(false)}>
          {" "}
          <T>Download recurring schedule (.ics)</T>{" "}
        </button>
      </div>
      <p className="small muted">
        {" "}
        <T>
          Recurring downloads include recorded cancellation dates. Downloads are
          a snapshot; future changes require a new export.
        </T>{" "}
      </p>
      {message ? <p role="status">{t(message)}</p> : null}
    </details>
  );
}

"use client";
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
      <summary>Add to your calendar</summary>
      <p>
        Next scheduled meeting: {links.start.toLocaleString()} (
        {Intl.DateTimeFormat().resolvedOptions().timeZone}). Confirm the meeting
        with its source.
      </p>
      {r.meeting.duration === null ? (
        <label>
          Duration is not reported. Choose the time to reserve in your calendar
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="small muted">
        These buttons open one event for you to review and save. Meeting details
        are sent to the calendar service you choose. That service controls the
        event�s privacy and reminders.
      </p>
      <div className="saved-tool-buttons">
        <a
          className="secondary"
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
        >
          Google Calendar
        </a>
        <a
          className="secondary"
          href={links.outlook}
          target="_blank"
          rel="noopener noreferrer"
        >
          Outlook.com
        </a>
        <a
          className="secondary"
          href={links.microsoft}
          target="_blank"
          rel="noopener noreferrer"
        >
          Microsoft 365
        </a>
        <a
          className="secondary"
          href={links.yahoo}
          target="_blank"
          rel="noopener noreferrer"
        >
          Yahoo Calendar
        </a>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={reminder}
          onChange={(e) => setReminder(e.target.checked)}
        />
        Include a 10-minute reminder in calendar downloads
      </label>
      <p className="small muted">
        Your calendar may display meeting names on a shared screen or lock
        screen. The reminder text is �Saved event.�
      </p>
      <div className="saved-tool-buttons">
        <button className="secondary" onClick={() => download(true)}>
          Apple / Other calendars (.ics)
        </button>
        <button className="secondary" onClick={() => download(false)}>
          Download recurring schedule (.ics)
        </button>
      </div>
      <p className="small muted">
        Recurring downloads include recorded cancellation dates. Downloads are a
        snapshot; future changes require a new export.
      </p>
      {message ? <p role="status">{message}</p> : null}
    </details>
  );
}

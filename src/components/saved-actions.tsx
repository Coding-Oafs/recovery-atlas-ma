"use client";
import { useState } from "react";
import { Download, Printer, CalendarDays } from "lucide-react";
import { OfflineSave } from "./offline-tools";
import { useSaved } from "./saved-provider";
export default function SavedActions({
  resourceIds,
}: { resourceIds?: string[] } = {}) {
  const {
      saved: allSaved,
      user,
      loading,
      syncing,
      error,
      refresh,
    } = useSaved(),
    saved = resourceIds ?? allSaved,
    [reminder, setReminder] = useState(false),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  async function download(format: string) {
    setBusy(format);
    setNotice("");
    try {
      const r = await fetch("/api/saved/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: saved, format, reminder }),
      });
      if (!r.ok) throw Error((await r.json()).error);
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `recovery-atlas-saved-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setNotice(
        "Download ready. Keep your saved-resource file somewhere private.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Download unavailable.");
    } finally {
      setBusy("");
    }
  }
  const disabled = loading || syncing || !saved.length || !!busy;
  return (
    <section className="saved-tools" aria-label="Saved resource options">
      <p>
        {user
          ? syncing
            ? "Saving changes�"
            : loading
              ? "Loading your account saves�"
              : "Your private list is saved to your account."
          : "Saved in this browser. Sign in to keep a private copy across devices."}
      </p>
      <div className="saved-tool-buttons">
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => download("csv")}
        >
          <Download size={14} />
          Spreadsheet (CSV)
        </button>
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => download("json")}
        >
          <Download size={14} />
          Backup (JSON)
        </button>
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => download("ics")}
        >
          <CalendarDays size={14} />
          Meeting calendar
        </button>
        <form
          method="post"
          action="/api/saved/export?format=print"
          target="_blank"
        >
          <input type="hidden" name="ids" value={JSON.stringify(saved)} />
          <button className="secondary" disabled={disabled}>
            <Printer size={14} />
            Print / Save PDF
          </button>
        </form>
      </div>
      <p className="small muted">
        {resourceIds
          ? "Exports include the selected saved list."
          : "Exports include all saved listings, even when search is filtered."}{" "}
        Calendar files include meetings only. Confirm current schedules with the
        source.
      </p>
      {error ? (
        <p className="notice" role="alert">
          {error}{" "}
          <button
            className="text-link"
            onClick={() => refresh().catch(() => {})}
          >
            Try again
          </button>
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      <label className="check-row">
        <input
          type="checkbox"
          checked={reminder}
          onChange={(e) => setReminder(e.target.checked)}
        />
        Include a 10-minute calendar reminder (meeting names may appear on your
        calendar�s notifications)
      </label>
      {user ? (
        <a className="text-link" href="/saved">
          Organize private saved lists
        </a>
      ) : null}
      <OfflineSave resourceIds={saved} />
    </section>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useSaved } from "./saved-provider";
export function OfflineSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
export function OfflineSave({ resourceIds }: { resourceIds?: string[] } = {}) {
  const { saved: allSaved, loading, syncing } = useSaved(),
    saved = resourceIds ?? allSaved,
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="offline-save">
      <summary>Keep an optional offline copy</summary>
      <p>
        This stores your chosen public listings on this device so you can open
        them without a connection. Anyone using this browser can read the
        offline copy, even after sign-out. Messages and profiles are never
        stored offline.
      </p>
      <button
        className="secondary"
        disabled={busy || loading || syncing || !saved.length}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/saved/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: saved, format: "json" }),
              }),
              d = await r.json();
            if (!r.ok) throw Error(d.error);
            localStorage.setItem("atlas:offline:resources", JSON.stringify(d));
            const response = await fetch("/offline");
            const html = await response.text();
            const cache = await caches.open("atlas-public-v1");
            await cache.put(
              "/offline",
              new Response(html, { headers: { "Content-Type": "text/html" } }),
            );
            for (const match of html.matchAll(
              /(?:src|href)="([^" ]+\/_next\/static\/[^" ]+|\/_next\/static\/[^" ]+)"/g,
            )) {
              const u = new URL(match[1], location.origin);
              if (u.origin === location.origin)
                await cache.add(u.href).catch(() => {});
            }
            await cache.add("/fonts/fonts.css").catch(() => {});
            setNotice(
              "Offline copy saved. Open Offline resources to check it while you are still connected.",
            );
          } catch (e) {
            setNotice(
              e instanceof Error
                ? e.message
                : "Could not store this copy. Download a file instead.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Save these resources offline
      </button>
      <a className="text-link" href="/offline">
        Open offline resources
      </a>
      {notice ? <p role="status">{notice}</p> : null}
    </details>
  );
}

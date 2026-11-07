"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Filters, Resource } from "@/lib/types";
import { filterResources } from "@/lib/search";

type Page = {
  resources: Resource[];
  total: number;
  mapped: number;
  online_or_unmapped: number;
};

export function useDirectoryResults(
  resources: Resource[],
  filters: Filters,
  saved: string[],
  limit: number,
  mode: "database" | "snapshot",
) {
  // Bookmark refreshes and saves outside Saved-only do not change the search.
  const criteria = JSON.stringify({
    filters,
    saved: filters.savedOnly ? [...saved].sort() : [],
    limit,
  });
  const [session, setSession] = useState({
    criteria,
    offset: 0,
    asOf: null as string | null,
    attempt: 0,
  });
  if (session.criteria !== criteria) {
    setSession({
      criteria,
      offset: 0,
      asOf: new Date().toISOString(),
      attempt: 0,
    });
  }
  useEffect(() => {
    setSession((s) => (s.asOf ? s : { ...s, asOf: new Date().toISOString() }));
  }, []);
  const [loaded, setLoaded] = useState<{
    criteria: string;
    offset: number;
    data: Page;
  } | null>(null);
  const [settled, setSettled] = useState("");
  const [error, setError] = useState("");
  const locked = useRef(false);
  const requestKey = JSON.stringify(session);
  const searching = mode === "database" && requestKey !== settled;

  useEffect(() => {
    if (mode !== "database" || !session.asOf) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const input = JSON.parse(session.criteria);
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            offset: session.offset,
            asOf: session.asOf,
          }),
          signal: abort.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error || "Search unavailable");
        if (abort.signal.aborted) return;
        setLoaded({ criteria: session.criteria, offset: session.offset, data });
        setError("");
      } catch (e) {
        if (abort.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Search unavailable");
      } finally {
        if (!abort.signal.aborted) {
          setSettled(requestKey);
          locked.current = false;
        }
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [mode, session, requestKey]);

  const local = useMemo(
    () =>
      filterResources(
        resources,
        JSON.parse(criteria).filters,
        JSON.parse(criteria).saved,
        new Date(session.asOf ?? "2026-10-22T12:00:00Z"),
      ),
    [resources, criteria, session.asOf],
  );
  const remote = loaded?.criteria === criteria ? loaded : null;
  const offset = remote?.offset ?? (mode === "snapshot" ? session.offset : 0);
  const data = remote?.data ?? {
    resources: local.slice(offset, offset + limit),
    total: local.length,
    mapped: local.filter((r) => r.lat !== null).length,
    online_or_unmapped: local.filter((r) => r.lat === null).length,
  };
  function changePage(next: number) {
    if (searching || locked.current) return;
    if (mode === "database") locked.current = true;
    setSession((s) => ({ ...s, offset: next, attempt: s.attempt + 1 }));
  }
  // A new search invalidates any previous request's click guard.
  useEffect(() => {
    locked.current = false;
  }, [criteria]);
  return {
    ...data,
    offset,
    searching,
    error: settled === requestKey ? error : "",
    usingBackup: mode === "database" && !remote,
    changePage,
    retry: () => setSession((s) => ({ ...s, attempt: s.attempt + 1 })),
  };
}

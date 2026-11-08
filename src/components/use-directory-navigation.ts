"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Filters } from "@/lib/types";
import {
  directorySearchKey,
  directoryStorageKey,
  readDirectorySnapshot,
  type DirectorySnapshot,
  type RestoredPage,
} from "@/lib/directory-navigation";

type View = {
  filters: Filters;
  location: string;
  locationLabel: string;
  mobileView: string;
  more: boolean;
};
export function useDirectoryNavigation(
  view: View,
  onRestore: (s: DirectorySnapshot) => void,
) {
  const current = useRef({ view, onRestore });
  current.current = { view, onRestore };
  const [ready, setReady] = useState(false);
  const [restoration, setRestoration] = useState<RestoredPage>();
  const pending = useRef<DirectorySnapshot | null>(null);
  const last = useRef<DirectorySnapshot | null>(null);
  const token = useRef(0);
  const frame = useRef(0);
  const restoring = useRef(false);
  const store = useCallback((s: DirectorySnapshot, push = false) => {
    last.current = s;
    // Preserve Next.js' own history fields. No search terms enter the URL.
    const state = { ...history.state, atlasDirectory: s };
    if (push) history.pushState(state, "", window.location.href);
    else history.replaceState(state, "", window.location.href);
    try {
      sessionStorage.setItem(directoryStorageKey, JSON.stringify(s));
    } catch {}
  }, []);
  useEffect(() => {
    const restore = (s: DirectorySnapshot) => {
      pending.current = s;
      restoring.current = true;
      current.current.onRestore(s);
      setRestoration({
        offset: s.offset,
        asOf: s.asOf,
        token: ++token.current,
      });
    };
    let initial = readDirectorySnapshot(history.state?.atlasDirectory);
    if (!initial) {
      try {
        initial = readDirectorySnapshot(
          JSON.parse(sessionStorage.getItem(directoryStorageKey) ?? "null"),
        );
      } catch {}
    }
    if (initial) restore(initial);
    setReady(true);
    const pop = (e: PopStateEvent) => {
      const s = readDirectorySnapshot(e.state?.atlasDirectory);
      if (!s) return;
      // Opening/closing a listing must not re-run the same search.
      if (
        last.current &&
        directorySearchKey(last.current) === directorySearchKey(s)
      ) {
        pending.current = null;
        restoring.current = false;
        last.current = s;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          document.getElementById("results")?.scrollTo({ top: s.scrollTop });
          window.scrollTo({ top: s.windowY });
        });
      } else restore(s);
    };
    const scroll = () => {
      if (!last.current || pending.current || restoring.current) return;
      store({
        ...last.current,
        scrollTop: document.getElementById("results")?.scrollTop ?? 0,
        windowY: window.scrollY,
      });
    };
    addEventListener("popstate", pop);
    addEventListener("scroll", scroll, { capture: true, passive: true });
    return () => {
      removeEventListener("popstate", pop);
      removeEventListener("scroll", scroll, true);
      cancelAnimationFrame(frame.current);
    };
  }, [store]);
  const recordPage = useCallback(
    (offset: number, asOf: string) => {
      const v = current.current.view;
      const s: DirectorySnapshot = {
        ...v,
        filters: {
          ...v.filters,
          state: v.filters.state ?? "",
        } as DirectorySnapshot["filters"],
        mobileView: v.mobileView === "map" ? "map" : "list",
        version: 1,
        offset,
        asOf,
        scrollTop: document.getElementById("results")?.scrollTop ?? 0,
        windowY: window.scrollY,
      };
      if (pending.current) {
        // A changed bookmark set or a new filter can supersede a restoration.
        if (directorySearchKey(pending.current) !== directorySearchKey(s)) {
          pending.current = null;
          restoring.current = false;
          store(s);
          return;
        }
        const target = pending.current;
        pending.current = null;
        store(target);
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          document
            .getElementById("results")
            ?.scrollTo({ top: target.scrollTop });
          window.scrollTo({ top: target.windowY });
          restoring.current = false;
        });
      } else {
        const changed =
          last.current &&
          directorySearchKey(last.current) !== directorySearchKey(s);
        if (changed) {
          document.getElementById("results")?.scrollTo({ top: 0 });
          s.scrollTop = 0;
        }
        store(s, !!changed);
      }
    },
    [store],
  );
  return { ready, restoration, recordPage };
}

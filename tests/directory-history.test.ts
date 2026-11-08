import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useDirectoryResults } from "../src/components/use-directory-results";
import { useDirectoryNavigation } from "../src/components/use-directory-navigation";
import { defaultFilters } from "../src/lib/search";
import {
  directoryStorageKey,
  type DirectorySnapshot,
} from "../src/lib/directory-navigation";
import type { Filters, Resource } from "../src/lib/types";
import raw from "../data/resources.json";

test("history restores a page and ordering instant, then tracks Back/Forward without exposing filters in URLs", async () => {
  const w = new Window({ url: "http://localhost/" });
  const names = [
    "window",
    "document",
    "history",
    "sessionStorage",
    "addEventListener",
    "removeEventListener",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "IS_REACT_ACT_ENVIRONMENT",
  ];
  const original = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, {
    window: w,
    document: w.document,
    history: w.history,
    sessionStorage: w.sessionStorage,
    addEventListener: w.addEventListener.bind(w),
    removeEventListener: w.removeEventListener.bind(w),
    requestAnimationFrame: w.requestAnimationFrame.bind(w),
    cancelAnimationFrame: w.cancelAnimationFrame.bind(w),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  w.document.body.innerHTML = '<div id="results"></div><div id="root"></div>';
  const asOf = new Date().toISOString();
  const saved = {
    version: 1,
    filters: defaultFilters,
    offset: 20,
    asOf,
    location: "",
    locationLabel: "",
    mobileView: "list",
    more: false,
    scrollTop: 120,
    windowY: 0,
  };
  w.sessionStorage.setItem(directoryStorageKey, JSON.stringify(saved));
  const records = Array.from({ length: 65 }, (_, i) => ({
    ...raw[0],
    id: `row-${i}`,
    name: `Row ${String(i).padStart(3, "0")}`,
  })) as Resource[];
  let page!: ReturnType<typeof useDirectoryResults>;
  let setFilters!: (f: Filters) => void;
  function Harness() {
    const [filters, changeFilters] = useState<Filters>(defaultFilters);
    setFilters = changeFilters;
    const nav = useDirectoryNavigation(
      {
        filters,
        location: "",
        locationLabel: "",
        mobileView: "list",
        more: false,
      },
      (s) => changeFilters(s.filters),
    );
    page = useDirectoryResults(records, filters, [], 20, "snapshot", {
      enabled: nav.ready,
      restore: nav.restoration,
    });
    useEffect(() => {
      if (nav.ready && page.asOf) nav.recordPage(page.offset, page.asOf);
    }, [nav.ready, nav.recordPage, page.offset, page.asOf, filters]);
    return null;
  }
  const root = createRoot(
    w.document.getElementById("root") as unknown as HTMLElement,
  );
  try {
    await act(async () => {
      root.render(createElement(Harness));
    });
    assert.equal(page.offset, 20);
    assert.equal(page.asOf, asOf);
    assert.equal(page.resources[0].id, "row-20");
    assert.equal(
      (w.history.state as { atlasDirectory: DirectorySnapshot }).atlasDirectory
        .offset,
      20,
    );
    await act(async () => {
      page.changePage(40);
    });
    assert.equal(
      (w.history.state as { atlasDirectory: DirectorySnapshot }).atlasDirectory
        .offset,
      40,
    );
    const entry = w.history.state;
    await act(async () => {
      w.dispatchEvent(
        new w.PopStateEvent("popstate", {
          state: { ...entry, atlasDirectory: saved },
        }),
      );
    });
    assert.equal(page.offset, 20);
    await act(async () => {
      w.dispatchEvent(new w.PopStateEvent("popstate", { state: entry }));
    });
    assert.equal(page.offset, 40);
    await act(async () => {
      setFilters({ ...defaultFilters, query: "Row 010" });
    });
    assert.equal(page.offset, 0);
    assert.deepEqual(
      page.resources.map((r) => r.id),
      ["row-10"],
    );
    assert.equal(w.location.search, "");
    assert.equal(
      (w.history.state as { atlasDirectory: DirectorySnapshot }).atlasDirectory
        .filters.query,
      "Row 010",
    );
    assert.ok(
      !w.sessionStorage.getItem(directoryStorageKey)?.includes('"resources"'),
    );
  } finally {
    await act(async () => {
      root.unmount();
    });
    await w.happyDOM.close();
    for (const key of names) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

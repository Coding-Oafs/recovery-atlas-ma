import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useDirectoryResults } from "../src/components/use-directory-results";
import { defaultFilters } from "../src/lib/search";
import { searchInput } from "../src/lib/search-input";
import type { RestoredPage } from "../src/lib/directory-navigation";
import type { Filters, Resource } from "../src/lib/types";
import raw from "../data/resources.json";

test("paging preserves results, ignores irrelevant saves, blocks repeated clicks and rejects stale responses", async () => {
  const window = new Window();
  const original = Object.getOwnPropertyDescriptors(globalThis);
  Object.assign(globalThis, {
    window,
    document: window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const pending: {
    body: { offset: number; asOf: string; filters: Filters };
    resolve: (r: Response) => void;
  }[] = [];
  // Deliberately ignore AbortSignal: the hook must also guard late completions.
  globalThis.fetch = async (_url, init) =>
    new Promise<Response>((resolve) => {
      pending.push({ body: JSON.parse(String(init?.body)), resolve });
    });
  const resources = Array.from({ length: 85 }, (_, i) => ({
    ...raw[0],
    id: `resource-${i}`,
    name: `Listing ${String(i).padStart(3, "0")}`,
  })) as Resource[];
  let current!: ReturnType<typeof useDirectoryResults>;
  let options: { enabled?: boolean; restore?: RestoredPage } = {};
  let filters = { ...defaultFilters };
  let saved: string[] = [];
  let mode: "database" | "snapshot" = "database";
  const root = createRoot(
    window.document.createElement("div") as unknown as HTMLElement,
  );
  function Harness() {
    current = useDirectoryResults(resources, filters, saved, 20, mode, options);
    return null;
  }
  const render = () =>
    act(async () => {
      root.render(createElement(Harness));
    });
  const waitForRequest = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 260));
    });
  const respond = (i: number, status = 200) =>
    act(async () => {
      const request = pending[i];
      request.resolve(
        Response.json(
          status === 200
            ? {
                resources: resources.slice(
                  request.body.offset,
                  request.body.offset + 20,
                ),
                total: resources.length,
                mapped: resources.length,
                online_or_unmapped: 0,
              }
            : { error: "Temporary failure" },
          { status },
        ),
      );
    });
  try {
    await render();
    assert.equal(current.searching, true);
    await waitForRequest();
    await respond(0);
    assert.equal(current.offset, 0);
    const anchor = pending[0].body.asOf;
    assert.ok(anchor);
    for (let page = 1; page <= 3; page++) {
      await act(async () => {
        current.changePage(page * 20);
        current.changePage((page + 1) * 20);
      });
      assert.equal(
        current.searching,
        true,
        "busy during debounce, before fetch starts",
      );
      assert.equal(
        current.offset,
        (page - 1) * 20,
        "range stays with visible results while loading",
      );
      await waitForRequest();
      assert.equal(pending[page].body.offset, page * 20);
      assert.equal(
        pending[page].body.asOf,
        anchor,
        "meeting ordering uses the same instant across pages",
      );
      await respond(page);
      assert.equal(current.offset, page * 20);
      assert.equal(current.resources[0].id, `resource-${page * 20}`);
    }
    saved = ["resource-60"];
    await render();
    await waitForRequest();
    assert.equal(
      pending.length,
      4,
      "bookmark changes must not refetch ordinary results",
    );
    assert.equal(current.offset, 60);
    await act(async () => {
      current.changePage(40);
    });
    await waitForRequest();
    await respond(4, 503);
    assert.equal(current.offset, 60);
    assert.equal(current.total, 85);
    assert.equal(current.resources[0].id, "resource-60");
    assert.equal(current.usingBackup, false);
    assert.match(current.error, /Temporary failure/);
    await act(async () => {
      current.retry();
    });
    await waitForRequest();
    await respond(5);
    assert.equal(current.offset, 40);
    assert.equal(current.error, "");
    await act(async () => {
      current.changePage(60);
    });
    await waitForRequest();
    filters = { ...filters, query: "changed" };
    await render();
    await waitForRequest();
    assert.equal(
      pending[7].body.offset,
      0,
      "filter changes reset offset in the same request",
    );
    await respond(7);
    await respond(6);
    assert.equal(
      current.offset,
      0,
      "an obsolete page cannot overwrite the new search",
    );
    filters = { ...defaultFilters, savedOnly: true };
    await render();
    await waitForRequest();
    await respond(8);
    saved = [...saved];
    await render();
    await waitForRequest();
    assert.equal(
      pending.length,
      9,
      "identical bookmark refreshes do not reset a saved search",
    );
    saved = [...saved, "resource-61"];
    await render();
    await waitForRequest();
    assert.equal(
      pending.length,
      10,
      "Saved-only membership changes do start a new search",
    );
    await respond(9);
    mode = "snapshot";
    filters = { ...defaultFilters };
    await render();
    await act(async () => {
      current.changePage(20);
    });
    assert.equal(current.searching, false);
    assert.equal(current.offset, 20);
    assert.equal(current.resources[0].id, "resource-20");
    await waitForRequest();
    assert.equal(
      pending.length,
      10,
      "snapshot pagination never makes a database request",
    );
    mode = "database";
    options = { restore: { offset: 40, asOf: anchor, token: 1 } };
    await render();
    await waitForRequest();
    assert.equal(pending[10].body.offset, 40);
    assert.equal(pending[10].body.asOf, anchor);
    await respond(10);
    assert.equal(current.offset, 40);
    options = { restore: { offset: 20, asOf: anchor, token: 2 } };
    await render();
    await waitForRequest();
    assert.equal(pending[11].body.offset, 20);
    await respond(11);
    assert.equal(current.resources[0].id, "resource-20");
  } finally {
    await act(async () => {
      root.unmount();
    });
    await window.happyDOM.close();
    for (const key of [
      "window",
      "document",
      "fetch",
      "IS_REACT_ACT_ENVIRONMENT",
    ]) {
      if (original[key]) Object.defineProperty(globalThis, key, original[key]);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test("search accepts a fixed ordering instant and rejects invalid dates", () => {
  const input = { filters: defaultFilters, saved: [], limit: 20, offset: 40 };
  assert.equal(searchInput.parse(input).asOf, undefined);
  assert.equal(
    searchInput.parse({ ...input, asOf: "2026-11-07T15:00:00.000Z" }).asOf,
    "2026-11-07T15:00:00.000Z",
  );
  assert.equal(
    searchInput.safeParse({ ...input, asOf: "invalid" }).success,
    false,
  );
});

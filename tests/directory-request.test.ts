import { test } from "node:test";
import assert from "node:assert/strict";
import { directoryRequest } from "../src/lib/directory-request";

test("public reads retry temporary failures, validate data, and keep permanent errors actionable", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  const validate = (value: unknown) => {
    assert.equal((value as { total: number }).total, 20);
    return value;
  };
  try {
    globalThis.fetch = async () =>
      ++calls === 1
        ? new Response("Gateway unavailable", { status: 503 })
        : Response.json({ total: 20 });
    assert.deepEqual(await directoryRequest("/api/search", {}, validate), {
      total: 20,
    });
    assert.equal(calls, 2);
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ error: "Invalid filters" }, { status: 400 });
    };
    await assert.rejects(
      directoryRequest("/api/search", {}, validate),
      /Invalid filters/,
    );
    assert.equal(calls, 3, "validation failures must not be retried");
    globalThis.fetch = async () => Response.json({ total: "bad" });
    await assert.rejects(
      directoryRequest("/api/search", {}, validate),
      /could not be read/,
    );
    globalThis.fetch = async () => new Response("<!doctype html>");
    await assert.rejects(
      directoryRequest("/api/search", {}, validate),
      /could not be read/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("timeouts settle even when fetch ignores cancellation, and superseded reads do not retry", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Promise<Response>(() => {});
    };
    await assert.rejects(
      directoryRequest("/api/search", {}, (v) => v, { timeoutMs: 15 }),
      /took too long/,
    );
    assert.equal(calls, 1);
    const controller = new AbortController();
    const request = directoryRequest(
      "/api/map",
      { signal: controller.signal },
      (v) => v,
    );
    controller.abort();
    await assert.rejects(request);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

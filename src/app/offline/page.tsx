"use client";
import { useEffect, useState } from "react";
import type { Resource } from "@/lib/types";
export default function Page() {
  const [data, setData] = useState<{
      exportedAt: string;
      resources: Resource[];
    } | null>(null),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const d = JSON.parse(
        localStorage.getItem("atlas:offline:resources") ?? "null",
      );
      if (d?.resources && Array.isArray(d.resources)) setData(d);
    } catch {}
    setReady(true);
  }, []);
  return (
    <main className="community-page" lang="en">
      <a className="text-link" href="/">
        ← Online directory
      </a>
      <h1>Your offline resources</h1>
      <p className="notice">
        This device copy can be read without signing in. Information can become
        outdated; confirm details with the original source. Maps, accounts and
        messaging need a connection.
      </p>
      {!ready ? (
        <p>Loading device copy…</p>
      ) : !data ? (
        <p>
          No offline copy is stored in this browser. Choose Saved → Keep an
          optional offline copy while connected.
        </p>
      ) : (
        <>
          <p>
            Saved {new Date(data.exportedAt).toLocaleString()} ·{" "}
            {data.resources.length} resources
          </p>
          <button
            className="secondary"
            onClick={() => {
              localStorage.removeItem("atlas:offline:resources");
              setData(null);
            }}
          >
            Remove offline copy from this device
          </button>
          {data.resources.map((r) => (
            <article key={r.id} className="peer-card">
              <h2>{r.name}</h2>
              <p>
                {r.address || "Online — see source for joining instructions"}
              </p>
              {r.phone ? (
                <p>
                  <a href={"tel:" + r.phone.replace(/[^+\d]/g, "")}>
                    {r.phone}
                  </a>
                </p>
              ) : null}
              <p>{r.description}</p>
              {r.meeting ? (
                <p>
                  {r.meeting.days
                    .map(
                      (d) =>
                        [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ][d],
                    )
                    .join(", ")}{" "}
                  · {r.meeting.time} · {r.meeting.timezone}
                </p>
              ) : null}
              <p>{r.intake}</p>
              <p>Source reviewed {r.sourceCheckedAt}</p>
              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                Original source
              </a>
            </article>
          ))}
        </>
      )}
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useSaved } from "./saved-provider";
export default function OrganizationUpdates() {
  const { user } = useSaved(),
    [claims, setClaims] = useState<
      {
        id: string;
        resourceId: string;
        name: string;
        role: string;
        status: string;
      }[]
    >([]),
    [record, setRecord] = useState<Record<string, string> | null>(null),
    [loadedFor, setLoadedFor] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    setClaims([]);
    setRecord(null);
    setLoadedFor("");
    setNotice("");
    if (user)
      fetch("/api/quality", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (active) {
            setClaims(d.claims ?? []);
            setLoadedFor(user.id);
          }
        })
        .catch(() => {
          if (active) setNotice("Requests unavailable.");
        });
    return () => {
      active = false;
    };
  }, [user?.id]);
  return (
    <section className="stack">
      <h2>Organization update requests</h2>
      <p>
        Request access from a listing’s details. Administrators verify your role
        through the organization’s official contact. Approved access lets you
        propose changes for review; it is not a clinical endorsement.
      </p>
      {(loadedFor === user?.id ? claims : []).map((c) => (
        <article className="peer-card" key={c.id}>
          <h3>{c.name}</h3>
          <p>
            {c.role} · {c.status}
          </p>
          {c.status === "approved" ? (
            <button
              className="secondary"
              onClick={async () => {
                const r = await fetch("/api/resources/" + c.resourceId);
                if (r.ok) setRecord(await r.json());
              }}
            >
              Propose an update
            </button>
          ) : null}
        </article>
      ))}
      {!claims.length ? <p>No requests yet.</p> : null}
      {record ? (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch("/api/quality", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "propose",
                    resourceId: record.id,
                    changes: Object.fromEntries(
                      ["phone", "hours", "intake", "availability"].map((k) => [
                        k,
                        String(f.get(k)),
                      ]),
                    ),
                    sourceUrl: String(f.get("sourceUrl")),
                    reason: String(f.get("reason")),
                  }),
                }),
                d = await r.json();
              if (!r.ok) throw Error(d.error);
              setNotice("Update submitted for administrator review.");
              setRecord(null);
            } catch (error) {
              setNotice(
                error instanceof Error ? error.message : "Please try again.",
              );
            }
          }}
        >
          <h3>Update {record.name}</h3>
          {[
            ["phone", "Contact phone"],
            ["hours", "Published hours"],
            ["intake", "Intake instructions"],
            ["availability", "Dated availability information"],
            ["sourceUrl", "Official source URL"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                name={key}
                defaultValue={record[key] ?? ""}
                maxLength={key === "intake" ? 1000 : 500}
                required={key === "sourceUrl"}
              />
            </label>
          ))}
          <label>
            What changed and when?
            <textarea name="reason" minLength={10} maxLength={1000} required />
          </label>
          <button className="primary">Submit for review</button>
          <button
            type="button"
            className="text-link"
            onClick={() => setRecord(null)}
          >
            Cancel
          </button>
        </form>
      ) : null}
      {notice ? (
        <p role="status" className="notice">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

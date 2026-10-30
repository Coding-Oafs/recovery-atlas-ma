"use client";
import { useState } from "react";
import type { Resource } from "@/lib/types";
import { resourceFreshness, intakeQuestions } from "@/lib/resource-quality";
import { useSaved } from "./saved-provider";
export default function PracticalDetails({
  resource: r,
}: {
  resource: Resource;
}) {
  const [claim, setClaim] = useState(false),
    [message, setMessage] = useState("");
  const { user } = useSaved(),
    fresh = resourceFreshness(r),
    p = r.practical;
  return (
    <section className="detail-section">
      <h3>Plan your next step</h3>
      <p className="notice">
        {fresh.registry
          ? "Public registry entry. Professional license, current practice and insurance participation have not been independently confirmed."
          : fresh.needsReview
            ? "This source is due for another review. Confirm details before traveling."
            : "Source information is dated. Confirm current access directly."}
      </p>
      <dl className="practical-grid">
        <div>
          <dt>Walk-ins</dt>
          <dd>
            {p?.walkIn === "yes"
              ? "Reported welcome"
              : p?.walkIn === "no"
                ? "Appointment required"
                : "Not reported � ask first"}
          </dd>
        </div>
        <div>
          <dt>Referral required</dt>
          <dd>
            {p?.referral === "yes"
              ? "Reported required"
              : p?.referral === "no"
                ? "Reported not required"
                : "Not reported � ask first"}
          </dd>
        </div>
        <div>
          <dt>Age eligibility</dt>
          <dd>
            {p?.minimumAge != null || p?.maximumAge != null
              ? `${p.minimumAge ?? "Not stated"} to ${p.maximumAge ?? "no upper age stated"}`
              : "Not reported � ask first"}
          </dd>
        </div>
        <div>
          <dt>Childcare</dt>
          <dd>
            {p?.childcare === "yes"
              ? "Reported available"
              : p?.childcare === "no"
                ? "Reported unavailable"
                : "Not reported � ask first"}
          </dd>
        </div>
      </dl>
      {p?.transit ? <p>Transportation: {p.transit}</p> : null}
      {p?.entrance ? <p>Entrance and access: {p.entrance}</p> : null}
      {p?.newcomers ? <p>For newcomers: {p.newcomers}</p> : null}
      {p?.notes ? <p>{p.notes}</p> : null}
      {fresh.currentEvidence.length ? (
        <div>
          <h4>Confirmed facts</h4>
          {fresh.currentEvidence.map((e, i) => (
            <p key={i}>
              <strong>{e.field}</strong>: {e.note} � checked {e.checkedAt}
              {e.expiresAt
                ? " � confirm again after " + e.expiresAt
                : ""} �{" "}
              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                evidence source
              </a>
            </p>
          ))}
        </div>
      ) : (
        <p className="small muted">
          No current fact-specific direct confirmations are recorded.
        </p>
      )}
      <details className="intake-checklist">
        <summary>Questions to ask when you call</summary>
        <ol>
          {intakeQuestions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
        <button
          className="secondary"
          onClick={() => {
            const text = `${r.name}\n${r.phone}\n${r.address}\n\n${intakeQuestions.map((q, i) => i + 1 + ". " + q).join("\n")}\n\nSource: ${r.sourceUrl}`,
              u = URL.createObjectURL(new Blob([text], { type: "text/plain" })),
              a = document.createElement("a");
            a.href = u;
            a.download = "recovery-atlas-call-checklist.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 60000);
          }}
        >
          Download call checklist
        </button>
      </details>
      {r.meeting ? (
        <details className="intake-checklist">
          <summary>Attending for the first time</summary>
          <p>
            Check whether the meeting is open to visitors or has participant
            restrictions. Confirm its current location or online joining
            instructions. You can ask the group what to expect and whether you
            can listen first. Sharing personal history is your choice.
          </p>
        </details>
      ) : null}
      {user ? (
        <>
          <button className="text-link" onClick={() => setClaim(!claim)}>
            Do you maintain this organization�s listing?
          </button>
          {claim ? (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const response = await fetch("/api/quality", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "claim",
                        resourceId: r.id,
                        role: String(f.get("role")),
                        evidenceUrl: String(f.get("source")),
                        notes: String(f.get("notes")),
                      }),
                    }),
                    data = await response.json();
                  if (!response.ok) throw Error(data.error);
                  setMessage(
                    "Request received. A directory administrator must verify your connection through the organization�s official contact before granting update access.",
                  );
                  setClaim(false);
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "Please try again.",
                  );
                }
              }}
            >
              <label>
                Your role
                <input name="role" minLength={3} maxLength={100} required />
              </label>
              <label>
                Official page supporting your connection
                <input name="source" type="url" pattern="https://.*" required />
              </label>
              <label>
                How can the organization confirm your role?
                <textarea
                  name="notes"
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </label>
              <p className="small muted">
                Use public business contact information. Do not include patient
                information or personal documents.
              </p>
              <button className="secondary">Request update access</button>
            </form>
          ) : null}
        </>
      ) : null}
      {message ? (
        <p role="status" className="notice">
          {message}
        </p>
      ) : null}
    </section>
  );
}

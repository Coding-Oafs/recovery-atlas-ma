"use client";
import { T, useLanguage } from "./language-provider";
import { useState } from "react";
import type { Resource } from "@/lib/types";
import { resourceFreshness, resourceQuestions } from "@/lib/resource-quality";
import { useSaved } from "./saved-provider";
export default function PracticalDetails({
  resource: r,
}: {
  resource: Resource;
}) {
  const { t } = useLanguage();

  const [claim, setClaim] = useState(false),
    [message, setMessage] = useState("");
  const { user } = useSaved(),
    fresh = resourceFreshness(r),
    p = r.practical,
    intakeQuestions = resourceQuestions(r);
  return (
    <section className="detail-section">
      <h3>
        {""}
        <T>Plan your next step</T>
        {""}
      </h3>
      <p className="notice">
        {fresh.registry
          ? t(
              "Public registry entry. Professional license, current practice and insurance participation have not been independently confirmed.",
            )
          : fresh.needsReview
            ? t(
                "This source is due for another review. Confirm details before traveling.",
              )
            : t(
                "Source information is dated. Confirm current access directly.",
              )}
      </p>
      {r.meeting && (
        <div className="stack">
          <h4>
            {""}
            <T>Arriving & participating</T>
            {""}
          </h4>
          <p>
            {""}
            <T>For newcomers:</T>{" "}
            {p?.newcomers || "Not reported - ask the group what to expect."}
          </p>
          <p>
            {""}
            <T>Entrance and access:</T>{" "}
            {p?.entrance ||
              "Not reported - confirm the entrance before traveling."}
          </p>
        </div>
      )}
      <dl className="practical-grid">
        {!r.meeting && (
          <>
            <div>
              <dt>
                {""}
                <T>Walk-ins</T>
                {""}
              </dt>
              <dd>
                {p?.walkIn === "yes"
                  ? t("Reported welcome")
                  : p?.walkIn === "no"
                    ? t("Appointment required")
                    : t("Not reported — ask first")}
              </dd>
            </div>
            <div>
              <dt>
                {""}
                <T>Referral required</T>
                {""}
              </dt>
              <dd>
                {p?.referral === "yes"
                  ? t("Reported required")
                  : p?.referral === "no"
                    ? t("Reported not required")
                    : t("Not reported — ask first")}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>
            {""}
            <T>Age eligibility</T>
            {""}
          </dt>
          <dd>
            {p?.minimumAge != null || p?.maximumAge != null
              ? `${p.minimumAge ?? "Not stated"} to ${p.maximumAge ?? "no upper age stated"}`
              : t("Not reported — ask first")}
          </dd>
        </div>
        <div>
          <dt>
            {""}
            <T>Childcare</T>
            {""}
          </dt>
          <dd>
            {p?.childcare === "yes"
              ? t("Reported available")
              : p?.childcare === "no"
                ? t("Reported unavailable")
                : t("Not reported — ask first")}
          </dd>
        </div>
      </dl>
      {p?.transit ? (
        <p>
          {""}
          <T>Transportation:</T> {p.transit}
        </p>
      ) : null}
      {!r.meeting && p?.entrance ? (
        <p>
          {""}
          <T>Entrance and access:</T> {p.entrance}
        </p>
      ) : null}
      {!r.meeting && p?.newcomers ? (
        <p>
          {""}
          <T>For newcomers:</T> {p.newcomers}
        </p>
      ) : null}
      {p?.notes ? <p>{p.notes}</p> : null}
      {fresh.currentEvidence.length ? (
        <div>
          <h4>
            {""}
            <T>Dated supporting evidence</T>
            {""}
          </h4>
          {fresh.currentEvidence.map((e, i) => (
            <p key={i}>
              <strong>{e.field}</strong>: {e.note} <T>· checked</T>{" "}
              {e.checkedAt}
              {e.expiresAt
                ? " · confirm again after " + e.expiresAt
                : ""} ·{" "}
              <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer">
                {" "}
                <T>evidence source</T>{" "}
              </a>
            </p>
          ))}
        </div>
      ) : (
        <p className="small muted">
          {" "}
          <T>No current field-specific supporting evidence is recorded.</T>{" "}
        </p>
      )}
      <details className="intake-checklist">
        <summary>
          {""}
          <T>Questions to ask when you call</T>
          {""}
        </summary>
        <ol>
          {intakeQuestions.map((q) => (
            <li key={t(q)}>{q}</li>
          ))}
        </ol>
        <button
          className="secondary"
          onClick={() => {
            const text = `${r.name}\n${r.phone}\n${r.address}\n\n${intakeQuestions.map((q, i) => i + 1 + ". " + t(q)).join("\n")}\n\nSource: ${r.sourceUrl}`,
              u = URL.createObjectURL(new Blob([text], { type: "text/plain" })),
              a = document.createElement("a");
            a.href = u;
            a.download = "recovery-atlas-call-checklist.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(u), 60000);
          }}
        >
          {" "}
          <T>Download call checklist</T>{" "}
        </button>
      </details>
      {r.meeting ? (
        <details className="intake-checklist">
          <summary>
            {""}
            <T>Attending for the first time</T>
            {""}
          </summary>
          <p>
            {" "}
            <T>
              Check whether the meeting is open to visitors or has participant
              restrictions. Confirm its current location or online joining
              instructions. You can ask the group what to expect and whether you
              can listen first. Sharing personal history is your choice.
            </T>{" "}
          </p>
        </details>
      ) : null}
      {user ? (
        <>
          <button className="text-link" onClick={() => setClaim(!claim)}>
            {" "}
            <T>Do you maintain this organization’s listing?</T>{" "}
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
                    "Request received. A directory administrator must verify your connection through the organization’s official contact before granting update access.",
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
                {" "}
                <T>Your role</T>{" "}
                <input name="role" minLength={3} maxLength={100} required />
              </label>
              <label>
                {" "}
                <T>Official page supporting your connection</T>{" "}
                <input name="source" type="url" pattern="https://.*" required />
              </label>
              <label>
                {" "}
                <T>How can the organization confirm your role?</T>{" "}
                <textarea
                  name="notes"
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </label>
              <p className="small muted">
                {" "}
                <T>
                  Use public business contact information. Do not include
                  patient information or personal documents.
                </T>{" "}
              </p>
              <button className="secondary">
                {""}
                <T>Request update access</T>
                {""}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
      {message ? (
        <p role="status" className="notice">
          {t(message)}
        </p>
      ) : null}
    </section>
  );
}

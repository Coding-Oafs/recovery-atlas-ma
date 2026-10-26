"use client";
import { useState } from "react";
import {
  MapPin,
  Phone,
  ArrowUpRight,
  Bookmark,
  Check,
  Clock,
  ShieldCheck,
  Info,
  Flag,
  Video,
} from "lucide-react";
import Modal from "./modal";
import type { Resource } from "@/lib/types";
import { nextMeeting } from "@/lib/search";
import { submitCorrection } from "@/app/actions";
export function SourceDate({ value }: { value: string | null }) {
  return (
    <>
      {value
        ? new Date(value + "T12:00:00Z").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "Not reported"}
    </>
  );
}
export function NextTime({
  resource,
  now,
}: {
  resource: Resource;
  now: Date | null;
}) {
  if (!resource.meeting) return null;
  const next = now ? nextMeeting(resource, now) : null;
  return (
    <>
      {next
        ? new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
          }).format(next)
        : "See meeting schedule"}
    </>
  );
}
export function CorrectionForm({
  resource,
  onDone,
}: {
  resource?: Resource;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [success, setSuccess] = useState(false);
  return success ? (
    <div className="success-box">
      <Check />
      <h3>Thank you for helping.</h3>
      <p>
        Your submission is in the review inbox. It will be checked before
        anything is published.
      </p>
      {onDone ? (
        <button className="secondary" onClick={onDone}>
          Done
        </button>
      ) : null}
    </div>
  ) : (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        const r = await submitCorrection({
          kind: resource ? "correction" : "new",
          resourceId: resource?.id ?? "",
          message: f.get("message"),
          sourceUrl: f.get("sourceUrl"),
          website: f.get("website"),
        });
        setBusy(false);
        if (r.success) setSuccess(true);
        else setResult(r.error ?? "Please try again.");
      }}
    >
      <p className="notice">
        Include public listing details only. Please don’t submit medical
        histories, insurance member numbers, or other private information.
      </p>
      <label>
        {resource
          ? "What needs to change?"
          : "Resource name, address and details"}
        <textarea
          name="message"
          minLength={15}
          maxLength={2500}
          rows={5}
          required
          placeholder="Tell us what should be added or corrected…"
        />
      </label>
      <label>
        Official source link <span className="muted">(optional)</span>
        <input
          name="sourceUrl"
          type="url"
          placeholder="https://"
          maxLength={600}
        />
      </label>
      <div className="honeypot" aria-hidden="true">
        <label>
          Website
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      {result ? (
        <p role="alert" className="form-error">
          {result}
        </p>
      ) : null}
      <button className="primary" disabled={busy}>
        {busy ? "Sending…" : "Submit for review"}
        <ArrowUpRight size={17} />
      </button>
    </form>
  );
}
export default function ResourceDetail({
  resource: r,
  onClose,
  saved,
  onSave,
  now,
}: {
  resource: Resource;
  onClose: () => void;
  saved: boolean;
  onSave: () => void;
  now: Date | null;
}) {
  const [correction, setCorrection] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={r.name}
      description={`${r.fellowship ?? (r.kind === "clinic" ? "Behavioral health services" : r.kind === "hospital" ? "Psychiatric hospital" : r.kind === "provider" ? "Care provider" : "Treatment & support")} · ${r.city}, ${r.state}`}
      wide
    >
      <div className="detail-tags">
        {r.formats.map((f) => (
          <span className="tag" key={f}>
            {f}
          </span>
        ))}
        {r.populations.map((p) => (
          <span className="tag neutral" key={p}>
            {p}
          </span>
        ))}
      </div>
      <p className="detail-description">{r.description}</p>
      <div className="detail-actions">
        <a
          href={r.website}
          target="_blank"
          rel="noopener noreferrer"
          className="primary"
        >
          {r.meeting && r.formats.some((f) => f === "online" || f === "hybrid")
            ? "Joining details"
            : "Official website"}
          <ArrowUpRight size={17} />
        </a>
        {r.phone ? (
          <a
            className="secondary"
            href={"tel:" + r.phone.replace(/[^+\d]/g, "")}
          >
            <Phone size={16} />
            Call
          </a>
        ) : null}
        <button className="secondary" aria-pressed={saved} onClick={onSave}>
          {saved ? <Check size={16} /> : <Bookmark size={16} />}{" "}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <section className="detail-section">
        <h3>
          <MapPin size={18} />
          Location & access
        </h3>
        {r.address ? (
          <>
            <p>{r.address}</p>
            <a
              className="text-link"
              href={
                "https://www.google.com/maps/dir/?api=1&destination=" +
                encodeURIComponent(r.address)
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions <ArrowUpRight size={14} />
            </a>
            {r.coordinateAccuracy === "approximate" ? (
              <p className="notice">
                Map pin is approximate (ZIP area), not a verified entrance. Use
                the street address for directions.
              </p>
            ) : null}
          </>
        ) : (
          <p>
            <Video size={16} /> Online only — no physical meeting location.
          </p>
        )}
        <p>{r.intake}</p>
        <p className="muted">
          New-patient / bed availability: {r.availability}. Call to confirm.
        </p>
      </section>
      {r.meeting ? (
        <section className="detail-section">
          <h3>
            <Clock size={18} />
            Meeting schedule
          </h3>
          <p className="schedule-next">
            Next scheduled: <NextTime resource={r} now={now} />
          </p>
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
            · {r.meeting.time} · America/New_York ·{" "}
            {r.meeting.duration === null
              ? "Duration not reported"
              : `${r.meeting.duration} minutes`}
          </p>
          <p className="muted">
            The next occurrence above is shown in your device’s time zone.
            Recurring schedules can change; confirm on the source page.
          </p>
          <p>{r.meeting.notes}</p>
        </section>
      ) : r.hours ? (
        <section className="detail-section">
          <h3>
            <Clock size={18} />
            Published hours
          </h3>
          <p>{r.hours}</p>
          <p className="muted">
            Hours are service-specific; confirm before traveling.
          </p>
        </section>
      ) : null}
      <section className="detail-section">
        <h3>Services & preferences</h3>
        <div className="detail-tags">
          {r.services.map((s) => (
            <span className="tag neutral" key={s}>
              {s}
            </span>
          ))}
        </div>
        <p>
          <strong>Languages:</strong> {r.languages.join(", ") || "Not reported"}
        </p>
        <p>
          <strong>Accessibility:</strong>{" "}
          {r.accessibility.join(", ") || "Not reported"}
        </p>
      </section>
      <section className="detail-section">
        <h3>
          <ShieldCheck size={18} />
          Insurance & payment
        </h3>
        <p>{r.paymentNote}</p>
        {r.insurance.map((i, index) => (
          <div className="insurance-row" key={index}>
            <div>
              <strong>{i.name}</strong>
              <span className="tag neutral">
                {i.status === "confirmed"
                  ? "Confirmed on date"
                  : i.status === "published"
                    ? "Published policy"
                    : "Facility-reported"}
              </span>
            </div>
            <p>{i.plan}</p>
            <p className="muted">{i.note}</p>
            <a
              className="text-link"
              href={i.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source checked <SourceDate value={i.checkedAt} />
              <ArrowUpRight size={13} />
            </a>
          </div>
        ))}
        <p className="notice">
          <Info size={16} />
          Acceptance of an insurer does not guarantee your plan’s network
          participation or coverage. Confirm the service, location, benefits and
          prior authorization with the provider and your insurer.
        </p>
      </section>
      <section className="detail-section source-section">
        <h3>Where this information comes from</h3>
        <a
          className="text-link"
          href={r.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {r.sourceName}
          <ArrowUpRight size={14} />
        </a>
        <p>
          Source reviewed: <SourceDate value={r.sourceCheckedAt} />
          <br />
          Source’s own update date: <SourceDate value={r.sourceUpdatedAt} />
          <br />
          Directly verified with provider/group:{" "}
          <SourceDate value={r.verifiedAt} />
        </p>
        <p className="muted">
          A source review checks published information. It does not confirm that
          a service or meeting is operating today.
        </p>
      </section>
      <button className="text-link" onClick={() => setCorrection(!correction)}>
        <Flag size={15} />
        {correction ? "Hide correction form" : "Suggest a correction"}
      </button>
      {correction ? <CorrectionForm resource={r} /> : null}
    </Modal>
  );
}

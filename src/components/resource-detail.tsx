"use client";
import { useState } from "react";
import { useLanguage, T } from "./language-provider";
import { CompareButton, NextStepChecklist } from "./shortlist-tools";
import { ListingSummary, MeetingSchedule } from "./listing-content";
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
import PracticalDetails from "./practical-details";
import AddCalendar from "./add-calendar";
import { ShareResource } from "./resource-actions";
import { useSaved } from "./saved-provider";
import type { Resource, Filters } from "@/lib/types";
import { nextMeeting } from "@/lib/search";
import { submitCorrection } from "@/app/actions";
export { SourceDate, NextTime } from "./resource-time";
import { SourceDate } from "./resource-time";
export function CorrectionForm({
  resource,
  onDone,
}: {
  resource?: Resource;
  onDone?: () => void;
}) {
  const { t } = useLanguage();

  const [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [success, setSuccess] = useState(false);
  return success ? (
    <div className="success-box">
      <Check />
      <h3>
        {""}
        <T>Thank you for helping.</T>
        {""}
      </h3>
      <p>
        {" "}
        <T>
          Your submission is in the review inbox. It will be checked before
          anything is published.
        </T>{" "}
      </p>
      {onDone ? (
        <button className="secondary" onClick={onDone}>
          {" "}
          <T>Done</T>{" "}
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
        try {
          const r = await submitCorrection({
            kind: resource ? "correction" : "new",
            resourceId: resource?.id ?? "",
            message: f.get("message"),
            sourceUrl: f.get("sourceUrl"),
            website: f.get("website"),
          });
          if (r.success) setSuccess(true);
          else setResult(r.error ?? "Please try again.");
        } catch {
          setResult(
            "The review inbox is temporarily unavailable. Please try again later.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="notice">
        {" "}
        <T>
          Include public listing details only. Please don’t submit medical
          histories, insurance member numbers, or other private information.
        </T>{" "}
      </p>
      <label>
        {resource
          ? t("What needs to change?")
          : t("Resource name, address and details")}
        <textarea
          name="message"
          minLength={15}
          maxLength={2500}
          rows={5}
          required
          placeholder={t("Tell us what should be added or corrected…")}
        />
      </label>
      <label>
        {" "}
        <T>Official source link</T>{" "}
        <span className="muted">
          {""}
          <T>(optional)</T>
          {""}
        </span>
        <input
          name="sourceUrl"
          type="url"
          placeholder={"https://"}
          maxLength={600}
        />
      </label>
      <div className="honeypot" aria-hidden="true">
        <label>
          {" "}
          <T>Website</T>{" "}
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
          {t(result)}
        </p>
      ) : null}
      <button className="primary" disabled={busy}>
        {busy ? t("Sending…") : t("Submit for review")}
        <ArrowUpRight size={17} />
      </button>
    </form>
  );
}
export default function ResourceDetail({
  resource: r,
  onClose,
  onShowMap,
  saved,
  onSave,
  now,
  timeFilters,
}: {
  resource: Resource;
  onClose: () => void;
  onShowMap?: () => void;
  saved: boolean;
  onSave: () => void;
  now: Date | null;
  timeFilters?: Filters;
}) {
  const [correction, setCorrection] = useState(false),
    { loading: savesLoading } = useSaved(),
    { t, language } = useLanguage();
  return (
    <Modal
      open
      onClose={onClose}
      title={r.name}
      description={[
        r.fellowship ||
          t(
            r.meeting
              ? "Meeting"
              : r.kind === "provider"
                ? "Care provider"
                : "Treatment & support",
          ),
        r.city,
        r.state,
      ].join(" · ")}
      wide
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        document
          .querySelector<HTMLElement>(`[data-resource-id="${r.id}"] .card-open`)
          ?.focus({ preventScroll: true });
      }}
    >
      <ListingSummary resource={r} now={now} timeFilters={timeFilters} />
      <div className="detail-actions">
        <a
          href={r.website}
          target="_blank"
          rel="noopener noreferrer"
          className="primary"
        >
          {t(r.meeting ? "Joining details" : "Official website")}{" "}
          <ArrowUpRight size={17} />
        </a>
        {r.phone && (
          <a
            className="secondary"
            href={"tel:" + r.phone.replace(/[^+\d]/g, "")}
          >
            <Phone size={16} />
            {t("Call")}
          </a>
        )}
        <button
          className="secondary"
          aria-pressed={saved}
          disabled={savesLoading}
          onClick={onSave}
        >
          {saved ? <Check size={16} /> : <Bookmark size={16} />}{" "}
          {t(saved ? "Saved" : "Save")}
        </button>
        {onShowMap && (
          <button className="secondary" onClick={onShowMap}>
            <MapPin size={16} />
            {t("Show on map")}
          </button>
        )}
        <CompareButton resource={r} />
      </div>
      <ShareResource resource={r} />
      {language === "es" && (
        <p lang="es" className="notice">
          {""}
          <T>
            Los nombres, descripciones y datos publicados conservan el idioma de
            la fuente. No se han traducido automáticamente.
          </T>
          {""}
        </p>
      )}
      {r.meeting && (
        <MeetingSchedule resource={r} now={now} timeFilters={timeFilters} />
      )}
      <PracticalDetails resource={r} />
      <NextStepChecklist resource={r} />
      <section className="detail-section">
        <h3>{t("Location & access")}</h3>
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
              {t("Get directions")}
            </a>
            {r.coordinateAccuracy === "approximate" && (
              <p className="notice">
                {t(
                  "Map pin is approximate. Use the published address and confirm the venue before traveling.",
                )}
              </p>
            )}
          </>
        ) : (
          <p>
            {t(
              r.meeting
                ? "Online only - no physical meeting location."
                : "Street address is not reported. Confirm the service location directly.",
            )}
          </p>
        )}
        {!r.meeting && (
          <>
            <h4>
              {t(
                r.kind === "provider"
                  ? "Appointments & eligibility"
                  : "Intake & eligibility",
              )}
              {r.locationEvidence?.method === "census-street-range" && (
                <p className="notice">
                  Map location estimated from a Census street address range.
                  Confirm the building and entrance before traveling.
                </p>
              )}
            </h4>
            <p lang="en">{r.intake}</p>
            <p>
              {t(
                r.kind === "provider"
                  ? "New-patient appointments"
                  : "Program availability",
              )}
              : {r.availability || t("Not reported")}. {t("Call to confirm.")}
            </p>
            {r.hours && (
              <>
                <h4>{t("Published hours")}</h4>
                <p lang="en">{r.hours}</p>
              </>
            )}
          </>
        )}
      </section>
      <details className="detail-section">
        <summary>{t("Services & preferences")}</summary>
        <p lang="en">{r.description}</p>
        <div className="detail-tags">
          {r.services.map((x) => (
            <span className="tag neutral" key={x}>
              {x}
            </span>
          ))}
        </div>
        <p>
          <strong>{t("Languages")}: </strong>
          {r.languages.join(", ") || t("Not reported")}
        </p>
        <p>
          <strong>{t("Accessibility")}: </strong>
          {r.accessibility.join(", ") || t("Not reported")}
        </p>
        <p>
          <strong>{t("Participants")}: </strong>
          {r.populations.join(", ") || t("Not reported")}
        </p>
      </details>
      <details className="detail-section">
        <summary>
          {t(
            r.meeting ? "Meeting costs & contributions" : "Insurance & payment",
          )}
        </summary>
        <p lang="en">{r.paymentNote || t("Not reported")}</p>
        {r.insurance.map((i, index) => (
          <div className="insurance-row" key={index}>
            <strong>{i.name}</strong>
            <span className="tag neutral">
              {t(
                i.status === "confirmed"
                  ? "Confirmed on date"
                  : i.status === "published"
                    ? "Published policy"
                    : "Facility-reported",
              )}
            </span>
            <p>{i.plan}</p>
            <p>{i.note}</p>
            <a
              className="text-link"
              href={i.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("Source reviewed")}: <SourceDate value={i.checkedAt} />
            </a>
          </div>
        ))}
        {!r.meeting && (
          <p className="notice">
            {t(
              "Acceptance of an insurer does not guarantee your plan's network participation or coverage. Confirm the service, location, benefits and prior authorization with the provider and your insurer.",
            )}
          </p>
        )}
      </details>
      <details className="detail-section source-section">
        <summary>{t("Where this information comes from")}</summary>
        <a
          className="text-link"
          href={r.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {r.sourceName}
        </a>
        <p>
          {t("Source reviewed")}: <SourceDate value={r.sourceCheckedAt} />
          <br />
          {t("Source's own update date")}:{" "}
          <SourceDate value={r.sourceUpdatedAt} />
          <br />
          {t("Directly verified with provider/group")}:{" "}
          <SourceDate value={r.verifiedAt} />
        </p>
        <p className="muted">
          {t(
            "A source review checks published information. It does not confirm that a service or meeting is operating today.",
          )}
        </p>
      </details>
      <button className="text-link" onClick={() => setCorrection(!correction)}>
        <Flag size={15} />
        {t(correction ? "Hide correction form" : "Suggest a correction")}
      </button>
      {correction && <CorrectionForm resource={r} />}
    </Modal>
  );
}

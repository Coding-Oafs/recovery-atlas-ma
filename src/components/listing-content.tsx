"use client";
import type { Resource, Filters } from "@/lib/types";
import { useLanguage } from "./language-provider";
import { NextTime, SourceDate } from "./resource-time";
import AddCalendar from "./add-calendar";
export function ListingSummary({
  resource: r,
  now,
  timeFilters,
}: {
  resource: Resource;
  now: Date | null;
  timeFilters?: Filters;
}) {
  const { t } = useLanguage();
  return (
    <section className="listing-summary stack" aria-label={t("At a glance")}>
      <h3>{t("At a glance")}</h3>
      <p>
        {r.meeting ? (
          <>
            {t("Next scheduled meeting")}:{" "}
            <NextTime resource={r} now={now} timeFilters={timeFilters} />
          </>
        ) : (
          t(
            r.kind === "provider"
              ? "Contact this practice to confirm services and new-patient appointments."
              : "Contact the intake team to confirm the right program, eligibility and availability.",
          )
        )}
      </p>
      <p>
        {r.formats.map(t).join(" · ")} · {r.city}, {r.state}
      </p>
      <p className="small muted">
        {t("Source reviewed")}: <SourceDate value={r.sourceCheckedAt} />.{" "}
        {t("Confirm current details before attending.")}
      </p>
    </section>
  );
}
export function MeetingSchedule({
  resource: r,
  now,
  timeFilters,
}: {
  resource: Resource;
  now: Date | null;
  timeFilters?: Filters;
}) {
  const { t, language } = useLanguage();
  if (!r.meeting) return null;
  return (
    <section className="detail-section">
      <h3>{t("Meeting schedule & joining")}</h3>
      <p className="schedule-next">
        {t("Next matching schedule")}:{" "}
        <NextTime resource={r} now={now} timeFilters={timeFilters} />
      </p>
      <p>
        {r.meeting.days
          .map((d) =>
            new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
              weekday: "long",
              timeZone: "UTC",
            }).format(new Date(Date.UTC(2026, 10, 15 + d))),
          )
          .join(", ")}{" "}
        · {r.meeting.time} · {r.meeting.timezone} ·{" "}
        {r.meeting.duration === null
          ? t("Duration not reported")
          : `${r.meeting.duration} ${t("minutes")}`}
      </p>
      <p className="muted">
        {t(
          "The next occurrence uses your selected search time zone, or your device time zone. The recurring schedule uses the group's source time zone. Confirm schedule changes with the group.",
        )}
      </p>
      {r.meeting.joinUrl && (
        <a
          className="primary"
          href={r.meeting.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("Join online")}
        </a>
      )}
      <p lang="en">
        {r.meeting.notes ||
          t(
            "Participation rules are not reported. Check whether visitors can attend and ask the group what to expect.",
          )}
      </p>
      {(r.meeting.exceptions ?? [])
        .filter((e) => e.cancelled)
        .map((e) => (
          <p className="notice" key={e.date}>
            {t("Cancelled")}: {e.date} · {e.note}
          </p>
        ))}
      <AddCalendar resource={r} timeFilters={timeFilters} />
    </section>
  );
}

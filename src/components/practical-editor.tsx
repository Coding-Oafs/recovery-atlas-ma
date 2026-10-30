import type { Resource } from "@/lib/types";
export default function PracticalEditor({
  resource: r,
}: {
  resource: Resource;
}) {
  const p = r.practical,
    fields = [
      "contact",
      "services",
      "schedule",
      "payment",
      "accessibility",
      "intake",
    ];
  return (
    <fieldset className="stack">
      <legend>Practical access and confirmed facts</legend>
      <input type="hidden" name="practicalPresent" value="yes" />
      {[
        ["walkIn", "Walk-ins welcome"],
        ["referral", "Referral required"],
        ["childcare", "Childcare available"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <select
            name={"practical_" + key}
            defaultValue={p?.[key as "walkIn"] ?? "unknown"}
          >
            <option value="unknown">Not reported</option>
            <option value="yes">Yes, supported by the source</option>
            <option value="no">No, supported by the source</option>
          </select>
        </label>
      ))}
      <label>
        Minimum age, if confirmed
        <input
          name="practical_minimumAge"
          type="number"
          min={0}
          max={120}
          defaultValue={p?.minimumAge ?? ""}
        />
      </label>
      <label>
        Maximum age, if confirmed
        <input
          name="practical_maximumAge"
          type="number"
          min={0}
          max={120}
          defaultValue={p?.maximumAge ?? ""}
        />
      </label>
      {[
        ["transit", "Transportation notes"],
        ["entrance", "Entrance and accessibility instructions"],
        ["newcomers", "Newcomer guidance"],
        ["notes", "Other access notes"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <textarea
            name={"practical_" + key}
            maxLength={key === "notes" ? 1000 : 500}
            defaultValue={p?.[key as "transit"] ?? ""}
          />
        </label>
      ))}
      <p className="notice">
        Unknown fields must remain unknown. Confirm the exact service, location
        and insurance product before recording a fact.
      </p>
      <input
        type="hidden"
        name="evidenceCount"
        value={Math.min(20, (r.evidence?.length ?? 0) + 1)}
      />
      {[
        ...(r.evidence ?? []),
        ...(r.evidence?.length === 20 ? [] : [null]),
      ].map((e, i) => (
        <details key={i} open={!e}>
          <summary>
            {e
              ? e.field + " · " + e.checkedAt
              : "Add a confirmed fact (optional)"}
          </summary>
          <div className="stack">
            <label>
              Fact type
              <select
                name={"evidence_" + i + "_field"}
                defaultValue={e?.field ?? "contact"}
              >
                {fields.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              What was confirmed?
              <textarea
                name={"evidence_" + i + "_note"}
                maxLength={600}
                defaultValue={e?.note ?? ""}
              />
            </label>
            <label>
              Evidence URL
              <input
                name={"evidence_" + i + "_sourceUrl"}
                type="url"
                defaultValue={e?.sourceUrl ?? ""}
              />
            </label>
            <label>
              Date checked
              <input
                name={"evidence_" + i + "_checkedAt"}
                type="date"
                defaultValue={e?.checkedAt ?? ""}
              />
            </label>
            <label>
              Confirm again after (optional)
              <input
                name={"evidence_" + i + "_expiresAt"}
                type="date"
                defaultValue={e?.expiresAt ?? ""}
              />
            </label>
            <p className="small muted">
              Clear the note to remove this fact. A source link check does not
              establish direct confirmation.
            </p>
          </div>
        </details>
      ))}
      {r.meeting ? (
        <>
          <label>
            Meeting time zone
            <input
              name="meetingTimezone"
              defaultValue={r.meeting.timezone}
              required
            />
          </label>
          <label>
            Cancelled dates, one per line: YYYY-MM-DD | explanation
            <textarea
              name="meetingExceptions"
              rows={4}
              defaultValue={(r.meeting.exceptions ?? [])
                .filter((e) => e.cancelled)
                .map((e) => e.date + " | " + e.note)
                .join("\n")}
            />
          </label>
        </>
      ) : null}
    </fieldset>
  );
}

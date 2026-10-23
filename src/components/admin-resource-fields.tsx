import type { Resource } from "@/lib/types";
export default function AdminResourceFields({
  resource: r,
}: {
  resource: Resource;
}) {
  const plans = [
    ...r.insurance,
    ...Array.from({ length: 2 }, () => ({
      name: "",
      plan: "",
      status: "reported" as const,
      note: "",
      sourceUrl: "",
      checkedAt: r.sourceCheckedAt,
    })),
  ];
  return (
    <>
      <section className="full">
        <h2 style={{ fontSize: 17 }}>Insurance plan records</h2>
        <p className="muted">
          Only add facts supported by a source. Name exclusions and service
          restrictions. Leave an insurer name empty to remove that row.
        </p>
        <input type="hidden" name="insuranceCount" value={plans.length} />
        {plans.map((p, i) => (
          <fieldset key={i} className="admin-fields insurance-editor">
            <legend>{p.name || "Add an insurer or plan"}</legend>
            <label>
              Insurer
              <input name={`insurance_${i}_name`} defaultValue={p.name} />
            </label>
            <label>
              Plan / network
              <input name={`insurance_${i}_plan`} defaultValue={p.plan} />
            </label>
            <label>
              Evidence
              <select name={`insurance_${i}_status`} defaultValue={p.status}>
                <option value="reported">Facility-reported</option>
                <option value="published">Published source</option>
                <option value="confirmed">Directly confirmed</option>
              </select>
            </label>
            <label>
              Date checked
              <input
                type="date"
                name={`insurance_${i}_checkedAt`}
                defaultValue={p.checkedAt}
              />
            </label>
            <label className="full">
              Source link
              <input
                type="url"
                name={`insurance_${i}_sourceUrl`}
                defaultValue={p.sourceUrl}
              />
            </label>
            <label className="full">
              Exclusions, conditions and service restrictions
              <textarea
                rows={2}
                name={`insurance_${i}_note`}
                defaultValue={p.note}
              />
            </label>
          </fieldset>
        ))}
      </section>
      {r.meeting ? (
        <section className="full">
          <h2 style={{ fontSize: 17 }}>Recurring meeting</h2>
          <div className="admin-fields">
            <label>
              Start time (Eastern)
              <input
                type="time"
                name="meetingTime"
                defaultValue={r.meeting.time}
                required
              />
            </label>
            <label>
              Duration in minutes
              <input
                type="number"
                name="meetingDuration"
                min={1}
                max={720}
                defaultValue={r.meeting.duration}
              />
            </label>
            <div className="full">
              <p>Meeting days</p>
              <div className="admin-nav">
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((d, i) => (
                  <label className="checkbox-label" key={d}>
                    <input
                      type="checkbox"
                      name="meetingDay"
                      value={i}
                      defaultChecked={r.meeting!.days.includes(i)}
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <label className="full">
              Public joining link (optional)
              <input
                type="url"
                name="meetingJoinUrl"
                defaultValue={r.meeting.joinUrl ?? ""}
              />
            </label>
            <label className="full">
              Meeting notes
              <textarea
                name="meetingNotes"
                defaultValue={r.meeting.notes}
                rows={3}
              />
            </label>
          </div>
        </section>
      ) : null}
    </>
  );
}

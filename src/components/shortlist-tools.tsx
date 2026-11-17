"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { Resource, Filters } from "@/lib/types";
import { miles } from "@/lib/search";
import { useSaved } from "./saved-provider";
import { useLanguage } from "./language-provider";
import Modal from "./modal";
import { NextTime } from "./resource-time";
type Shortlist = {
  rows: Resource[];
  toggle: (r: Resource) => void;
  tasks: Record<string, string[]>;
  check: (id: string, task: string) => void;
};
const Context = createContext<Shortlist>({
  rows: [],
  toggle: () => {},
  tasks: {},
  check: () => {},
});
export function ShortlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSaved();
  const [rows, setRows] = useState<Resource[]>([]),
    [tasks, setTasks] = useState<Record<string, string[]>>({});
  useEffect(() => {
    setRows([]);
    setTasks({});
  }, [user?.id]);
  return (
    <Context.Provider
      value={{
        rows,
        tasks,
        toggle: (r) =>
          setRows((old) =>
            old.some((x) => x.id === r.id)
              ? old.filter((x) => x.id !== r.id)
              : old.length < 3
                ? [...old, r]
                : old,
          ),
        check: (id, task) =>
          setTasks((old) => ({
            ...old,
            [id]: (old[id] ?? []).includes(task)
              ? old[id].filter((x) => x !== task)
              : [...(old[id] ?? []), task],
          })),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function CompareButton({ resource }: { resource: Resource }) {
  const { rows, toggle } = useContext(Context),
    { t } = useLanguage(),
    selected = rows.some((r) => r.id === resource.id);
  return (
    <button
      className="text-link compare-button"
      aria-pressed={selected}
      disabled={!selected && rows.length === 3}
      onClick={() => toggle(resource)}
    >
      {t(selected ? "Remove from comparison" : "Compare")}
    </button>
  );
}
export function NextStepChecklist({ resource }: { resource: Resource }) {
  const { tasks, check } = useContext(Context),
    { t } = useLanguage();
  const keys = resource.meeting
    ? ["Confirm schedule", "Check joining details", "Add to calendar"]
    : ["Call", "Confirm eligibility and payment", "Plan transportation"];
  return (
    <details className="intake-checklist">
      <summary>{t("My optional next-step checklist")}</summary>
      <p className="small muted">
        {t(
          "Private to this page session. Cleared on refresh or account change. No notes or checklist data are sent to a server.",
        )}
      </p>
      {keys.map((task) => (
        <label className="check-row" key={task}>
          <input
            type="checkbox"
            checked={(tasks[resource.id] ?? []).includes(task)}
            onChange={() => check(resource.id, task)}
          />
          {t(task)}
        </label>
      ))}
    </details>
  );
}
export function ComparisonTray({
  filters,
  now,
}: {
  filters: Filters;
  now: Date | null;
}) {
  const { rows, toggle } = useContext(Context),
    { t } = useLanguage(),
    [open, setOpen] = useState(false);
  const fields: [string, (r: Resource) => React.ReactNode][] = [
    [
      "Next meeting",
      (r) =>
        r.meeting ? (
          <NextTime resource={r} now={now} timeFilters={filters} />
        ) : (
          t("Not a meeting")
        ),
    ],
    ["Location", (r) => [r.city, r.state].filter(Boolean).join(", ")],
    [
      "Distance",
      (r) =>
        filters.center && r.lat !== null && r.lng !== null
          ? `${miles(filters.center, { lat: r.lat, lng: r.lng }).toFixed(1)} ${t("miles")}${r.coordinateAccuracy === "approximate" ? " (" + t("approximate") + ")" : ""}`
          : t("Search location or coordinates needed"),
    ],
    ["Format", (r) => r.formats.map(t).join(", ") || t("Not reported")],
    [
      "Insurance & payment",
      (r) =>
        [...r.payment, ...r.insurance.map((i) => i.name)].join(", ") ||
        t("Not reported"),
    ],
    ["Participants", (r) => r.populations.join(", ") || t("Not reported")],
    ["Accessibility", (r) => r.accessibility.join(", ") || t("Not reported")],
    ["Languages", (r) => r.languages.join(", ") || t("Not reported")],
    ["Source reviewed", (r) => r.sourceCheckedAt],
  ];
  if (!rows.length) return null;
  return (
    <aside className="comparison-tray" aria-label={t("Resource comparison")}>
      <span>
        {t("Selected for comparison")}: {rows.length} / 3
      </span>
      <button
        className="secondary"
        disabled={rows.length < 2}
        onClick={() => setOpen(true)}
      >
        {t("Compare selected resources")}
      </button>
      {rows.map((r) => (
        <button
          className="text-link"
          key={r.id}
          onClick={() => toggle(r)}
          aria-label={`${t("Remove")} ${r.name}`}
        >
          {r.name} ×
        </button>
      ))}
      <Modal
        open={open && rows.length > 0}
        onClose={() => setOpen(false)}
        title={t("Compare resources")}
        wide
      >
        <p>
          {t(
            "Source facts may be incomplete. Confirm schedules, eligibility and exact insurance coverage directly.",
          )}
        </p>
        <div className="comparison-scroll">
          <table className="coverage-table comparison-table">
            <caption>{t("Your shortlist")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("Details")}</th>
                {rows.map((r) => (
                  <th scope="col" key={r.id}>
                    <a href={`/?resource=${encodeURIComponent(r.id)}`}>
                      {r.name}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map(([name, value]) => (
                <tr key={name}>
                  <th scope="row">{t(name)}</th>
                  {rows.map((r) => (
                    <td key={r.id}>{value(r)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.map((r) => (
          <section key={r.id}>
            <h3>{r.name}</h3>
            <NextStepChecklist resource={r} />
          </section>
        ))}
      </Modal>
    </aside>
  );
}

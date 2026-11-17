"use client";
import { useEffect, useState } from "react";
import type { Filters } from "@/lib/types";
import { searchAlternatives } from "@/lib/discovery";
import { useLanguage } from "./language-provider";
export default function SearchAlternatives({
  filters,
  saved,
  asOf,
  onApply,
}: {
  filters: Filters;
  saved: string[];
  asOf: string | null;
  onApply: (f: Filters) => void;
}) {
  const { t, language } = useLanguage();
  const key = JSON.stringify({
    filters,
    saved: filters.savedOnly ? saved : [],
    asOf,
  });
  const [loaded, setLoaded] = useState<{
      key: string;
      counts: Record<string, number>;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setError("");
    if (!asOf) return;
    fetch("/api/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...JSON.parse(key), limit: 1 }),
      signal: abort.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!abort.signal.aborted)
          setLoaded({
            key,
            counts: Object.fromEntries(
              data.suggestions.map((a: { id: string; total: number }) => [
                a.id,
                a.total,
              ]),
            ),
          });
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "Alternative counts are unavailable. You can still adjust your filters.",
          );
      });
    return () => abort.abort();
  }, [key, asOf]);
  const counts = loaded?.key === key ? loaded.counts : null;
  return (
    <div className="search-alternatives" aria-label={t("Other search options")}>
      {searchAlternatives(filters).map((a) => (
        <button
          key={a.id}
          className="secondary"
          onClick={() => onApply(a.filters)}
        >
          {a.id === "radius"
            ? `${t("Expand to")} ${a.filters.radius} ${t("miles")}`
            : t(a.label)}
          {counts && a.id in counts
            ? ` (${counts[a.id].toLocaleString(language === "es" ? "es-US" : "en-US")})`
            : ""}
        </button>
      ))}
      {!counts && !error && (
        <p className="small" role="status">
          {t("Checking alternative result counts...")}
        </p>
      )}
      {error && (
        <p className="small" role="status">
          {t(error)}
        </p>
      )}
    </div>
  );
}

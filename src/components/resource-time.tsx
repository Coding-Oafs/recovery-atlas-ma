"use client";
import type { Resource, Filters } from "@/lib/types";
import { nextMeeting } from "@/lib/search";
import { useLanguage } from "./language-provider";
export function SourceDate({ value }: { value: string | null }) {
  const { language, t } = useLanguage();
  return (
    <>
      {value
        ? new Date(value + "T12:00:00Z").toLocaleDateString(
            language === "es" ? "es-US" : "en-US",
            {
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            },
          )
        : t("Not reported")}
    </>
  );
}
export function NextTime({
  resource,
  now,
  timeFilters,
}: {
  resource: Resource;
  now: Date | null;
  timeFilters?: Filters;
}) {
  const { language, t } = useLanguage();
  if (!resource.meeting) return null;
  const next = now ? nextMeeting(resource, now, timeFilters) : null;
  return (
    <>
      {next
        ? new Intl.DateTimeFormat(language === "es" ? "es-US" : "en-US", {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short",
            timeZone: timeFilters?.timeZone,
          }).format(next)
        : t("See meeting schedule")}
    </>
  );
}

"use client";
import agencies from "../../data/state-help.json";
import { isRegionState, stateNames } from "@/lib/region";
import { useLanguage } from "./language-provider";
export default function JurisdictionHelp({
  state = "",
  compact = false,
}: {
  state?: string;
  compact?: boolean;
}) {
  const { t } = useLanguage();
  const agency = agencies[state as keyof typeof agencies];
  return (
    <div className="stack jurisdiction-help" data-jurisdiction={state}>
      <h3>
        {isRegionState(state)
          ? `${t("Help in")} ${stateNames[state]}`
          : t("Help across the United States")}
      </h3>
      {agency ? (
        <>
          <a
            className="help-card"
            href={agency.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>
              <strong>{agency.name}</strong>
              <small>
                {t("Official state or territory substance use agency")}
              </small>
            </span>
          </a>
          <p className="small muted">
            <a
              href={agency.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("SAMHSA agency directory")}
            </a>{" "}
            · {t("Source reviewed")}: {agency.checkedAt}.{" "}
            {t("Agency offices are not emergency services.")}
          </p>
        </>
      ) : (
        <p>
          {t(
            state === "UM"
              ? "No dedicated local agency or imported facility records are listed for the Minor Outlying Islands. Use the national directories and confirm local access."
              : "Select a state or territory in More filters to see its official agency.",
          )}
        </p>
      )}
      <a
        className="help-card"
        href="https://findtreatment.gov/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>
          <strong>FindTreatment.gov</strong>
          <small>{t("Official national treatment finder")}</small>
        </span>
      </a>
      <a
        className="text-link"
        href="https://findtreatment.gov/state-agencies"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("State mental health and substance use agencies")}
      </a>
      <a
        className="text-link"
        href="https://www.aa.org/find-aa"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("Find a local AA office or meeting directory")}
      </a>
      {!compact && (
        <>
          <a
            className="text-link"
            href="https://www.211.org/get-help"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Find local food, housing and transportation assistance")}
          </a>
          <p>
            {t(
              "For an immediate medical emergency or suspected overdose, call your local emergency number.",
            )}
          </p>
          <p>
            {t(
              "For emotional crisis support, use the official crisis service directory for your location.",
            )}
          </p>
          <a
            className="text-link"
            href="https://988lifeline.org/learn/our-crisis-centers/crisis-centers-by-state-and-u-s-territory/"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Crisis centers by state and territory")}
          </a>
        </>
      )}
    </div>
  );
}

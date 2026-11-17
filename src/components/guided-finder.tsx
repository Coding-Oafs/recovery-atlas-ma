"use client";
import { useState } from "react";
import type { Filters } from "@/lib/types";
import { regionStates, stateNames } from "@/lib/region";
import { useLanguage } from "./language-provider";
export default function GuidedFinder({
  filters,
  onApply,
}: {
  filters: Filters;
  onApply: (f: Filters) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0);
  const [category, setCategory] = useState(
    filters.category === "all" ? "meetings" : filters.category,
  );
  const [state, setState] = useState(filters.state ?? ""),
    [format, setFormat] = useState(filters.format);
  const [when, setWhen] = useState(""),
    [audience, setAudience] = useState("self");
  return (
    <div className="guided-finder">
      <button
        className="secondary"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setStep(0);
          setState(filters.state ?? "");
          setFormat(filters.format);
        }}
      >
        {t("Help me choose")}
      </button>
      {open && (
        <form
          className="peer-card stack"
          aria-label={t("Guided resource finder")}
          onSubmit={(e) => {
            e.preventDefault();
            if (step < 2) {
              setStep(step + 1);
              return;
            }
            onApply({
              ...filters,
              category,
              state,
              format,
              bounds: null,
              center:
                state !== (filters.state ?? "") || format === "online"
                  ? null
                  : filters.center,
              soon: false,
              day: "",
              startAfter: "",
              startBefore: "",
              meetingDate: "",
              meetingWindow:
                category === "meetings"
                  ? (when as Filters["meetingWindow"])
                  : "",
            });
            setOpen(false);
          }}
        >
          <p className="small" role="status">
            {t("Step")} {step + 1} / 3
          </p>
          {step === 0 && (
            <>
              <label>
                {t("Who are you looking for?")}
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  <option value="self">{t("Myself")}</option>
                  <option value="other">{t("I'm helping someone else")}</option>
                </select>
              </label>
              <label>
                {t("What are you looking for?")}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="meetings">{t("Meetings")}</option>
                  <option value="treatment">{t("Treatment & detox")}</option>
                  <option value="counseling">
                    {t("Therapy & counseling")}
                  </option>
                  <option value="mental-health">{t("Mental health")}</option>
                  <option value="support">{t("Recovery support")}</option>
                </select>
              </label>
              {audience === "other" && (
                <p>
                  {t(
                    "You can explore options together without sharing personal information.",
                  )}
                </p>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <label>
                {t("Online or nearby?")}
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="">{t("Any format")}</option>
                  <option value="in-person">{t("In person")}</option>
                  <option
                    value={category === "meetings" ? "online" : "telehealth"}
                  >
                    {t(
                      category === "meetings"
                        ? "Online meetings"
                        : "Telehealth care",
                    )}
                  </option>
                </select>
              </label>
              <label>
                {t("State or territory")}
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">{t("All states & territories")}</option>
                  {regionStates.map((s) => (
                    <option key={s} value={s}>
                      {stateNames[s]}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                {t(
                  "For a nearby search, enter a city or ZIP in the location box after applying these preferences.",
                )}
              </p>
            </>
          )}
          {step === 2 && (
            <>
              {category === "meetings" && (
                <label>
                  {t("When would you like to go?")}
                  <select
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  >
                    <option value="">{t("Any time")}</option>
                    <option value="today">{t("Today")}</option>
                    <option value="tomorrow">{t("Tomorrow")}</option>
                    <option value="7days">{t("Next seven days")}</option>
                  </select>
                </label>
              )}
              <p>
                {t(
                  "Your preferences will appear in the search filters. You can change them at any time.",
                )}
              </p>
              {category !== "meetings" && (
                <p>
                  {t(
                    "Contact each provider to confirm appointments, eligibility and payment details.",
                  )}
                </p>
              )}
            </>
          )}
          <div className="saved-tool-buttons">
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setStep(step - 1)}
              >
                {t("Back")}
              </button>
            )}
            <button className="primary">
              {t(step === 2 ? "Show matching resources" : "Continue")}
            </button>
            <button
              type="button"
              className="text-link"
              onClick={() => setOpen(false)}
            >
              {t("Close")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

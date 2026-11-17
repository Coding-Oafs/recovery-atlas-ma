"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { regionStates, stateNames, isRegionState } from "@/lib/region";
import JurisdictionHelp from "./jurisdiction-help";
import { useLanguage, T } from "./language-provider";
const resources = [
  {
    id: "housing",
    title: "Recovery housing",
    es: "Vivienda para la recuperación",
    text: "Find your state’s recovery-residence affiliate and ask about certification, cost, house rules, medication policies and available support.",
    links: [
      ["NARR state affiliates", "https://narronline.org/affiliates/"],
      [
        "SAMHSA recovery housing guidance",
        "https://library.samhsa.gov/sites/default/files/pep23-10-00-002.pdf",
      ],
    ],
  },
  {
    id: "families",
    title: "For family and friends",
    es: "Para familiares y amistades",
    text: "Explore support designed for people affected by someone else’s substance use. Confirm the group’s current format and attendance details.",
    links: [
      [
        "Al-Anon meeting finder",
        "https://al-anon.org/al-anon-meetings/find-an-al-anon-meeting/",
      ],
      ["SMART Family & Friends", "https://smartrecovery.org/family"],
    ],
  },
  {
    id: "peer",
    title: "Peer and community support",
    es: "Apoyo de pares y de la comunidad",
    text: "Learn about peer recovery support and find community services through official state and regional directories. Our member messaging is a separate peer conversation feature.",
    links: [
      [
        "SAMHSA peer support resources",
        "https://www.samhsa.gov/substance-use/recovery/peer-support-workers",
      ],
      [
        "New Jersey recovery centers",
        "https://www.nj.gov/humanservices/reachnj/help/centers/",
      ],
    ],
  },
  {
    id: "practical",
    title: "Food, transportation and everyday needs",
    es: "Alimentos, transporte y necesidades diarias",
    text: "Local assistance directories can help you ask about transportation, food, housing and benefits. Availability and eligibility vary by location.",
    links: [
      ["Find local assistance through 211", "https://www.211.org/get-help"],
    ],
  },
  {
    id: "work",
    title: "Work, education and purpose",
    es: "Trabajo, educación y propósito",
    text: "Explore recovery support that includes employment, learning and community participation.",
    links: [
      [
        "SAMHSA Recovery Resource Center",
        "https://www.samhsa.gov/substance-use/recovery/recovery-resource-center",
      ],
    ],
  },
  {
    id: "health",
    title: "Treatment and harm-reduction resources",
    es: "Tratamiento y reducción de daños",
    text: "Use official sources to explore treatment and local harm-reduction services. Ask a qualified clinician about clinical care and medications appropriate to your situation.",
    links: [
      ["FindTreatment.gov", "https://findtreatment.gov/"],
      [
        "SAMHSA harm-reduction resources",
        "https://www.samhsa.gov/substance-use/harm-reduction",
      ],
    ],
  },
];
export default function SupportHub() {
  const { language, t } = useLanguage();
  const [state, setState] = useState("");
  useEffect(() => {
    const value =
      new URLSearchParams(window.location.search).get("state") || "";
    if (isRegionState(value)) setState(value);
  }, []);
  return (
    <div className="stack">
      <h1>
        {language === "es"
          ? t("Apoyo para la vida diaria")
          : t("Support for daily life")}
      </h1>
      <p>
        {language === "es"
          ? t(
              "La recuperación puede incluir salud, vivienda, propósito y comunidad. Estos enlaces abren las fuentes originales; compruebe los detalles y los requisitos.",
            )
          : t(
              "Recovery can include health, home, purpose and community. These links take you to original sources; confirm current services and eligibility directly.",
            )}
      </p>
      <label>
        {t("State or territory")}
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">{t("All states & territories")}</option>
          {regionStates.map((code) => (
            <option key={code} value={code}>
              {stateNames[code]}
            </option>
          ))}
        </select>
      </label>
      <JurisdictionHelp state={state} compact />
      <div className="support-grid">
        {resources.map((r) => (
          <section id={r.id} className="peer-card stack" key={r.id}>
            <h2>{language === "es" ? r.es : r.title}</h2>
            <p>{t(r.text)}</p>
            {r.links.map(([name, url]) => (
              <a
                key={url}
                className="text-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {name} ↗
              </a>
            ))}
          </section>
        ))}
      </div>
      <section className="peer-card stack">
        <h2>
          {""}
          <T>Help shape Recovery Atlas</T>
          {""}
        </h2>
        <p>
          {" "}
          <T>
            We welcome practical feedback from people in recovery, families,
            peer workers and service organizations. Tell us where a search
            became confusing, which access detail was missing, or which resource
            category would help. Keep personal medical information out of
            feedback.
          </T>{" "}
        </p>
        <Link className="secondary" href="/#feedback">
          {" "}
          <T>Suggest an improvement</T>{" "}
        </Link>
        <Link className="text-link" href="/community">
          {" "}
          <T>Your community profile & messages</T>{" "}
        </Link>
        <a
          href="https://www.samhsa.gov/substance-use/recovery/about"
          target="_blank"
          rel="noopener noreferrer"
        >
          {" "}
          <T>About recovery · SAMHSA</T>{" "}
        </a>
      </section>
      <p className="small muted">
        {" "}
        <T>
          External support directories are separate from our mapped listings. A
          linked service is not a guarantee of availability, accreditation or
          eligibility. Sources reviewed October 30, 2026; some sites limit
          automated access.
        </T>{" "}
      </p>
    </div>
  );
}

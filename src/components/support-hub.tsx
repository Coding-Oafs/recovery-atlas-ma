"use client";
import Link from "next/link";
import { useLanguage } from "./language-provider";
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
  const { language } = useLanguage();
  return (
    <div className="stack">
      <h1>
        {language === "es"
          ? "Apoyo para la vida diaria"
          : "Support for daily life"}
      </h1>
      <p>
        {language === "es"
          ? "La recuperación puede incluir salud, vivienda, propósito y comunidad. Estos enlaces abren las fuentes originales; compruebe los detalles y los requisitos."
          : "Recovery can include health, home, purpose and community. These links take you to original sources; confirm current services and eligibility directly."}
      </p>
      <div className="support-grid">
        {resources.map((r) => (
          <section id={r.id} className="peer-card stack" key={r.id}>
            <h2>{language === "es" ? r.es : r.title}</h2>
            <p lang="en">{r.text}</p>
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
        <h2>Help shape Recovery Atlas</h2>
        <p>
          We welcome practical feedback from people in recovery, families, peer
          workers and service organizations. Tell us where a search became
          confusing, which access detail was missing, or which resource category
          would help. Keep personal medical information out of feedback.
        </p>
        <Link className="secondary" href="/#feedback">
          Suggest an improvement
        </Link>
        <Link className="text-link" href="/community">
          Your community profile & messages
        </Link>
        <a
          href="https://www.samhsa.gov/substance-use/recovery/about"
          target="_blank"
          rel="noopener noreferrer"
        >
          About recovery · SAMHSA
        </a>
      </section>
      <p className="small muted">
        External support directories are separate from our mapped listings. A
        linked service is not a guarantee of availability, accreditation or
        eligibility. Sources reviewed October 30, 2026; some sites limit
        automated access.
      </p>
    </div>
  );
}

"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useRef } from "react";
import {
  Compass,
  Search,
  MapPin,
  Navigation,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  Heart,
  Users,
  Building2,
  Brain,
  HandHeart,
  Check,
  X,
  ShieldCheck,
  Info,
  Plus,
  Map as MapIcon,
  List,
  ChevronDown,
  Video,
  Clock,
  Phone,
  RotateCcw,
} from "lucide-react";
import type { Resource, Filters } from "@/lib/types";
import { categories } from "@/lib/types";
import { defaultFilters, miles } from "@/lib/search";
import Modal from "./modal";
import { useDirectoryResults } from "./use-directory-results";
import { useDirectoryNavigation } from "./use-directory-navigation";
import { useResourceNavigation } from "./use-resource-navigation";
import ResourceActions from "./resource-actions";
import { resourceFreshness } from "@/lib/resource-quality";
import { resourceMapTarget } from "@/lib/map-selection";
import ResourceDetail, { CorrectionForm, NextTime } from "./resource-detail";
import initialCoverage from "../../public/coverage.json";
import nationalManifest from "../../data/national-manifest.json";
import GuidedFinder from "./guided-finder";
import SearchAlternatives from "./search-alternatives";
import JurisdictionHelp from "./jurisdiction-help";
import { CompareButton, ComparisonTray } from "./shortlist-tools";
import { unreportedFields } from "@/lib/match-evidence";
import { regionStates, stateNames, usTimeZones } from "@/lib/region";
import { publicSiteUrl } from "@/lib/site";
import { useSaved } from "./saved-provider";
import AccountButton from "./account-panel";
import SavedActions from "./saved-actions";
import Link from "next/link";
import { useLanguage, T } from "./language-provider";
const RecoveryMap = dynamic(() => import("./region-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      {""}
      <T>Loading map…</T>
      {""}
    </div>
  ),
});
const directoryLinks = [
  {
    name: "Alcoholics Anonymous",
    detail: "Find local AA offices and meeting directories",
    url: "https://www.aa.org/find-aa",
    type: "meetings",
  },
  {
    name: "Narcotics Anonymous",
    detail: "Official meeting search",
    url: "https://www.na.org/meetingsearch/",
    type: "meetings",
  },
  {
    name: "SMART Recovery",
    detail: "Secular, skills-based peer support",
    url: "https://meetings.smartrecovery.org/meetings/",
    type: "meetings",
  },
  {
    name: "Recovery Dharma",
    detail: "Buddhist-inspired recovery",
    url: "https://recoverydharma.org/meetings/",
    type: "meetings",
  },
  {
    name: "Refuge Recovery",
    detail: "Meditation-based peer support",
    url: "https://refugerecoverymeetings.org/meetings",
    type: "meetings",
  },
  {
    name: "FindTreatment.gov",
    detail: "Official national treatment finder",
    url: "https://findtreatment.gov/",
    type: "treatment",
  },
  {
    name: "Al-Anon",
    detail: "Support for family and friends",
    url: "https://al-anon.org/al-anon-meetings/find-an-al-anon-meeting/",
    type: "support",
  },
];
function TypeIcon({ r }: { r: Resource }) {
  const { t } = useLanguage();

  return r.kind === "meeting" ? (
    <Users size={20} />
  ) : r.kind === "hospital" ? (
    <Building2 size={20} />
  ) : r.kind === "treatment" ? (
    <Heart size={20} />
  ) : (
    <Brain size={20} />
  );
}
function ResourceCard({
  r,
  saved,
  onSave,
  onOpen,
  onHover,
  center,
  now,
  timeFilters,
}: {
  r: Resource;
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  onHover: (id: string | null) => void;
  center: Filters["center"];
  now: Date | null;
  timeFilters: Filters;
}) {
  const { loading: savesLoading } = useSaved();
  const { t, language } = useLanguage();
  const distance =
    center && r.lat !== null && r.lng !== null
      ? miles(center, { lat: r.lat, lng: r.lng })
      : null;
  return (
    <article
      className="resource-card"
      data-resource-id={r.id}
      onMouseEnter={() => onHover(r.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="card-top">
        <span className={`resource-icon ${r.kind}`}>
          <TypeIcon r={r} />
        </span>
        <span className="card-type">
          {r.sourceName === "NPPES public facility registry"
            ? t("Facility registry")
            : (r.fellowship ??
              (r.kind === "clinic"
                ? t("Community care")
                : r.kind === "hospital"
                  ? t("Hospital services")
                  : r.kind === "provider"
                    ? r.sourceName.startsWith("NPPES")
                      ? t("Provider registry")
                      : t("Care provider")
                    : t("Treatment center")))}
        </span>
        <button
          className={`save-button ${saved ? "saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${r.name}`}
          aria-pressed={saved}
          disabled={savesLoading}
          onClick={onSave}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
      <button className="card-open" onClick={onOpen}>
        <h3>{r.name}</h3>
        <p className="card-location">
          <MapPin size={13} />
          {r.address
            ? `${r.city}, ${r.state}`
            : `Online · based in ${r.city}, ${r.state}`}
          {distance !== null ? (
            <span>
              · {distance.toFixed(1)} <T>mi</T>{" "}
              {r.coordinateAccuracy === "approximate" ? t(" (approx.)") : ""}
            </span>
          ) : null}
        </p>
        <p className="card-description">{r.description}</p>
      </button>
      <div className="card-tags">
        {r.meeting ? (
          <>
            <span className="tag meeting-tag">
              <Clock size={12} />
              <NextTime resource={r} now={now} timeFilters={timeFilters} />
            </span>
            <span className="tag neutral">
              {r.formats.includes("hybrid")
                ? t("Hybrid")
                : r.formats.includes("online")
                  ? t("Online")
                  : t("In person")}
            </span>
          </>
        ) : (
          <>
            <span className="tag">{r.services[0]}</span>
            {r.payment.includes("MassHealth") ? (
              <span className="tag neutral">
                {""}
                <T>MassHealth · confirm benefits</T>
                {""}
              </span>
            ) : (
              <span className="tag neutral">
                {""}
                <T>Payment: ask provider</T>
                {""}
              </span>
            )}
          </>
        )}
      </div>
      <ResourceActions resource={r} />
      <p
        className={`source-review ${now && resourceFreshness(r, now).needsReview ? "review-due" : ""}`}
      >
        {now && resourceFreshness(r, now).needsReview ? t("Review due · ") : ""}{" "}
        <T>Source reviewed</T> {r.sourceCheckedAt}
      </p>
      <div className="card-bottom">
        <span>
          <ShieldCheck size={13} />
          {r.sourceName.startsWith("NPPES")
            ? t("Registry · license not checked")
            : t("Sourced listing")}
        </span>
        <button onClick={onOpen}>
          {" "}
          <T>View details</T> <ArrowUpRight size={15} />
        </button>
      </div>
      {timeFilters.uncertainOnly && (
        <p className="notice">
          {t("Details need confirmation")}:{" "}
          {unreportedFields(r, timeFilters).map(t).join(", ")}
        </p>
      )}
      <CompareButton resource={r} />
    </article>
  );
}
export default function Directory({
  resources,
  mode,
}: {
  resources: Resource[];
  mode: "database" | "snapshot";
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters),
    [panel, setPanel] = useState(""),
    [more, setMore] = useState(false),
    [location, setLocation] = useState(""),
    [locationLabel, setLocationLabel] = useState(""),
    [locating, setLocating] = useState(false),
    [message, setMessage] = useState(""),
    [mobileView, setMobileView] = useState("list"),
    [highlight, setHighlight] = useState<string | null>(null),
    [limit, setLimit] = useState(20),
    [now, setNow] = useState<Date | null>(null);
  const { saved, toggleSave, clearGuest, error: savedError } = useSaved();
  const { t, language } = useLanguage();
  const pendingScroll = useRef(false);
  const [viewerZone, setViewerZone] = useState("America/New_York");
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setViewerZone(zone);
    setFilters((f) => ({ ...f, timeZone: zone }));
  }, []);
  const navigation = useDirectoryNavigation(
    { filters, location, locationLabel, mobileView, more },
    (s) => {
      pendingScroll.current = false;
      setFilters(s.filters);
      setLocation(s.location);
      setLocationLabel(s.locationLabel);
      setMobileView(s.mobileView);
      setMore(s.more);
    },
  );
  const [coverage, setCoverage] = useState(initialCoverage);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/coverage", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(setCoverage)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const effectiveFilters = filters;
  function applyDiscovery(f: Filters) {
    setFilters(f);
    setMore(true);
    setLimit(20);
    if (!f.center) {
      setLocation("");
      setLocationLabel("");
    }
  }

  const {
    resources: results,
    total: resultCount,
    mapped,
    online_or_unmapped,
    offset,
    asOf,
    searching,
    error: searchError,
    usingBackup,
    changePage,
    retry,
  } = useDirectoryResults(resources, effectiveFilters, saved, limit, mode, {
    enabled: navigation.ready,
    restore: navigation.restoration,
  });
  const {
    selected,
    open: openResource,
    close: closeResource,
    error: resourceError,
  } = useResourceNavigation([...results, ...resources]);
  const [mapSelection, setMapSelection] = useState<Resource | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState(0);
  const showMapAfterClose = useRef(false);
  useEffect(() => {
    if (!selected) return;
    setMapSelection(selected);
    setMapFocusRequest((n) => n + 1);
  }, [selected]);
  useEffect(() => {
    if (selected || !showMapAfterClose.current) return;
    showMapAfterClose.current = false;
    setMobileView("map");
    const frame = requestAnimationFrame(() => {
      const panel = document.getElementById("resource-map");
      panel?.scrollIntoView({ block: "start", behavior: "instant" });
      panel?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  useEffect(() => {
    if (!pendingScroll.current || searching || searchError) return;
    pendingScroll.current = false;
    const panel = document.getElementById("results");
    panel?.scrollTo({ top: 0, behavior: "instant" });
    panel?.scrollIntoView({ block: "start", behavior: "instant" });
    document.getElementById("results-title")?.focus({ preventScroll: true });
  }, [results, searching, searchError]);
  useEffect(() => {
    if (navigation.ready && !searching && !searchError && asOf)
      navigation.recordPage(offset, asOf);
  }, [
    navigation.ready,
    navigation.recordPage,
    searching,
    searchError,
    offset,
    asOf,
    filters,
    location,
    locationLabel,
    mobileView,
    more,
  ]);
  const [copied, setCopied] = useState(false);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetch("/api/facets")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setFacets)
      .catch(() => {});
  }, []);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const activeCount = [
    filters.state ?? "",
    filters.format,
    filters.fellowship,
    filters.payment,
    filters.service,
    filters.language,
    filters.population,
    filters.day,
    filters.accessibility,
    filters.soon,
    filters.meetingWindow ?? "",
    filters.startAfter ?? "",
    filters.startBefore ?? "",
  ].filter((v) => v !== "" && v !== false).length;
  function update<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters((f) => ({ ...f, [k]: v }));
    setLimit(20);
  }
  async function searchLocation(e?: React.FormEvent) {
    e?.preventDefault();
    if (!location.trim()) {
      update("center", null);
      setLocationLabel("");
      return;
    }
    setLocating(true);
    setMessage("");
    try {
      const res = await fetch("/api/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: location, state: filters.state ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setFilters((f) => ({
        ...f,
        center: { lat: data.lat, lng: data.lng },
        bounds: null,
      }));
      setLocationLabel(
        data.label + (data.approximate ? " · approximate center" : ""),
      );
      setLimit(20);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Location unavailable.");
    } finally {
      setLocating(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage(
        "This browser does not support location access. Enter a city or ZIP instead.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFilters((f) => ({
          ...f,
          center: { lat: p.coords.latitude, lng: p.coords.longitude },
          bounds: null,
        }));
        setLocationLabel("Your current location");
        setLocation("");
        setLocating(false);
        setMessage("");
      },
      () => {
        setMessage(
          "Location access wasn’t available. Enter a city or ZIP instead.",
        );
        setLocating(false);
      },
      { timeout: 10000, maximumAge: 120000 },
    );
  }
  function reset() {
    setFilters({ ...defaultFilters, timeZone: viewerZone });
    setLocation("");
    setLocationLabel("");
    setMessage("");
    setLimit(20);
  }
  const options = (key: "services" | "languages" | "populations") =>
    facets[key] ?? [...new Set(resources.flatMap((r) => r[key]))].sort();
  return (
    <>
      <a className="skip-link" href="#results">
        {" "}
        <T>Skip to results</T>{" "}
      </a>
      <div className="help-strip">
        <span>
          <Heart size={13} /> <T>You don’t have to figure it out alone.</T>{" "}
        </span>
        <button onClick={() => setPanel("help")}>
          {" "}
          <T>Talk to someone who can help</T> <ArrowUpRight size={13} />
        </button>
      </div>
      <header className="site-header">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Compass size={26} strokeWidth={1.5} />
          </span>
          <span>
            {" "}
            <T>recovery</T>
            {""}
            <span className="brand-light">
              {""}
              <T>atlas</T>
              {""}
            </span>
            <small>
              {""}
              <T>A LITTLE DIRECTION. A WAY FORWARD.</T>
              {""}
            </small>
          </span>
        </a>
        <nav aria-label={t("Main navigation")}>
          <button
            className="nav-active"
            onClick={() => {
              reset();
              setPanel("");
            }}
          >
            {t("Explore resources")}
          </button>
          <button onClick={() => setPanel("guide")}>
            {t("Finding your next step")}
          </button>
          <button onClick={() => setPanel("about")}>
            {t("About the project")}
          </button>
          <Link href="/community">{t("Community")}</Link>
        </nav>
        <button
          className={`saved-nav ${filters.savedOnly ? "active" : ""}`}
          onClick={() => {
            update("savedOnly", !filters.savedOnly);
          }}
        >
          <Bookmark size={16} />
          {t("Saved")}
          <span>{saved.length}</span>
        </button>
        <AccountButton />
      </header>
      <main>
        <section className="intro">
          <div className="intro-text">
            <span className="eyebrow">
              <span className="live-dot" />
              {t("giving recovery a home")}
            </span>
            <h1>
              {" "}
              <T>Your next step starts</T>{" "}
              <em>
                {""}
                <T>here.</T>
                {""}
              </em>
            </h1>
          </div>
        </section>
        <section className="search-section" aria-label={t("Search resources")}>
          <div
            className="guided-paths"
            aria-label={t("Choose a starting point")}
          >
            {[
              ["Find a meeting", "meetings"],
              ["Explore treatment", "treatment"],
              ["Find a therapist", "counseling"],
            ].map(([label, category]) => (
              <button
                key={category}
                className="secondary"
                onClick={() => {
                  setFilters((f) => ({
                    ...defaultFilters,
                    center: f.center,
                    radius: f.radius,
                    state: f.state,
                    timeZone: f.timeZone,
                    category,
                  }));
                  setLimit(20);
                }}
              >
                {t(label)}
              </button>
            ))}
            <Link className="secondary" href="/support">
              {t("Support for daily life")}
            </Link>
          </div>
          <GuidedFinder filters={filters} onApply={applyDiscovery} />
          <div className="search-bar">
            <label className="keyword-field">
              <Search size={19} />
              <span className="sr-only">
                {""}
                <T>Search keywords</T>
                {""}
              </span>
              <input
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
                placeholder={t("Meeting, service, or keyword…")}
              />
            </label>
            <form className="location-form" onSubmit={searchLocation}>
              <label className="location-field">
                <MapPin size={19} />
                <span className="sr-only">
                  {" "}
                  <T>US city, state, ZIP or address</T>{" "}
                </span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("City, state, ZIP or street address")}
                />
              </label>
              <button
                type="button"
                className="icon-button locate-button"
                aria-label={t("Use my current location")}
                disabled={locating}
                onClick={locate}
              >
                <Navigation size={17} />
              </button>
              <label className="radius-field">
                <span className="sr-only">
                  {""}
                  <T>Search radius</T>
                  {""}
                </span>
                <select
                  value={filters.radius}
                  onChange={(e) => update("radius", Number(e.target.value))}
                >
                  {[5, 10, 25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n} <T>miles</T>{" "}
                    </option>
                  ))}
                </select>
              </label>
              <button className="primary search-submit" disabled={locating}>
                {locating ? (
                  "Locating…"
                ) : (
                  <>
                    {t("Find support")} <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          </div>
          {message || resourceError ? (
            <p className="form-error" role="status">
              {t(message || resourceError)}
            </p>
          ) : null}
          {locationLabel || filters.bounds ? (
            <div className="location-status">
              <MapPin size={13} />
              {filters.bounds
                ? t("Searching the visible map area")
                : locationLabel}
              <button
                aria-label="Clear location restriction"
                onClick={() => {
                  setFilters((f) => ({ ...f, center: null, bounds: null }));
                  setLocationLabel("");
                  setLocation("");
                }}
              >
                <X size={13} />
              </button>
            </div>
          ) : null}
        </section>
        <section className="filter-section" aria-label={t("Filter resources")}>
          <div className="category-tabs">
            {categories.map((c, i) => {
              const Icon = [Compass, Users, Heart, Brain, HandHeart, Building2][
                i
              ];
              return (
                <button
                  key={c.id}
                  className={filters.category === c.id ? "active" : ""}
                  onClick={() => {
                    setFilters((f) => ({
                      ...defaultFilters,
                      query: f.query,
                      center: f.center,
                      radius: f.radius,
                      bounds: f.bounds,
                      savedOnly: f.savedOnly,
                      state: f.state,
                      timeZone: f.timeZone,
                      category: c.id,
                    }));
                    setLimit(20);
                  }}
                >
                  <Icon size={16} />
                  {t(c.label)}
                </button>
              );
            })}
          </div>
          <div className="quick-filters">
            <label className="filter-select">
              <Video size={14} />
              <select
                aria-label={t("Attendance format")}
                value={filters.format}
                onChange={(e) => update("format", e.target.value)}
              >
                <option value="">
                  {""}
                  <T>Any format</T>
                  {""}
                </option>
                <option value="in-person">
                  {""}
                  <T>In person</T>
                  {""}
                </option>
                <option value="online">
                  {""}
                  <T>Online meetings</T>
                  {""}
                </option>
                <option value="hybrid">
                  {""}
                  <T>Hybrid meetings</T>
                  {""}
                </option>
                <option value="telehealth">
                  {""}
                  <T>Telehealth care</T>
                  {""}
                </option>
              </select>
              <ChevronDown size={12} />
            </label>
            <label className="filter-select">
              <select
                aria-label={t("Result priority")}
                value={
                  filters.prioritizeRecovery === false ? "all" : "recovery"
                }
                onChange={(e) =>
                  update("prioritizeRecovery", e.target.value === "recovery")
                }
              >
                <option value="recovery">
                  {""}
                  <T>Recovery programs first</T>
                  {""}
                </option>
                <option value="all">
                  {""}
                  <T>All listings equally</T>
                  {""}
                </option>
              </select>
              <ChevronDown size={12} />
            </label>
            <label className="filter-select">
              <ShieldCheck size={14} />
              <select
                aria-label={t("Insurance or payment")}
                value={filters.payment}
                onChange={(e) => update("payment", e.target.value)}
              >
                <option value="">
                  {""}
                  <T>Insurance & payment</T>
                  {""}
                </option>
                {(
                  facets.payment ?? [
                    ...new Set(
                      resources.flatMap((r) => [
                        ...r.payment,
                        ...r.insurance.map((i) => i.name),
                      ]),
                    ),
                  ]
                )
                  .sort()
                  .map((p) => (
                    <option key={p}>{p}</option>
                  ))}
              </select>
              <ChevronDown size={12} />
            </label>
            <button
              className={`more-filter ${activeCount ? "has-filters" : ""}`}
              onClick={() => setMore(!more)}
              aria-expanded={more}
            >
              <SlidersHorizontal size={15} />
              {t("More filters")}
              {activeCount ? <span>{activeCount}</span> : null}
            </button>
            {activeCount ||
            filters.query ||
            filters.center ||
            filters.bounds ? (
              <button className="reset-button" onClick={reset}>
                <RotateCcw size={13} /> <T>Reset</T>{" "}
              </button>
            ) : null}
          </div>
          {more ? (
            <div className="expanded-filters">
              <label>
                {" "}
                <T>State</T>{" "}
                <select
                  aria-label="State"
                  value={filters.state ?? ""}
                  onChange={(e) => {
                    setFilters((f) => ({
                      ...f,
                      state: e.target.value,
                      center: null,
                      bounds: null,
                    }));
                    setLocation("");
                    setLocationLabel("");
                  }}
                >
                  <option value="">
                    {""}
                    <T>All states & territories</T>
                    {""}
                  </option>
                  {regionStates.map((s) => (
                    <option key={s} value={s}>
                      {stateNames[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                <T>Recovery approach</T>{" "}
                <select
                  value={filters.fellowship}
                  onChange={(e) => update("fellowship", e.target.value)}
                >
                  <option value="">
                    {""}
                    <T>Any approach</T>
                    {""}
                  </option>
                  {[
                    "AA",
                    "NA",
                    "SMART Recovery",
                    "Recovery Dharma",
                    "Refuge Recovery",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                <T>Service</T>{" "}
                <select
                  value={filters.service}
                  onChange={(e) => update("service", e.target.value)}
                >
                  <option value="">
                    {""}
                    <T>Any service</T>
                    {""}
                  </option>
                  {options("services").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                <T>Language</T>{" "}
                <select
                  value={filters.language}
                  onChange={(e) => update("language", e.target.value)}
                >
                  <option value="">
                    {""}
                    <T>Any / not reported</T>
                    {""}
                  </option>
                  {options("languages").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                {" "}
                <T>Meeting day</T>{" "}
                <select
                  value={filters.day}
                  onChange={(e) => update("day", e.target.value)}
                >
                  <option value="">
                    {""}
                    <T>Any day</T>
                    {""}
                  </option>
                  {[
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ].map((d, i) => (
                    <option key={d} value={i}>
                      {t(d)}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="meeting-time-filters stack">
                <legend>
                  {""}
                  <T>Meeting date &amp; time</T>
                  {""}
                </legend>
                <label>
                  {" "}
                  <T>When</T>{" "}
                  <select
                    aria-label="Meeting date window"
                    value={filters.meetingWindow ?? ""}
                    onChange={(e) =>
                      update(
                        "meetingWindow",
                        e.target.value as Filters["meetingWindow"],
                      )
                    }
                  >
                    <option value="">
                      {""}
                      <T>Any upcoming date</T>
                      {""}
                    </option>
                    <option value="today">
                      {""}
                      <T>Today</T>
                      {""}
                    </option>
                    <option value="tomorrow">
                      {""}
                      <T>Tomorrow</T>
                      {""}
                    </option>
                    <option value="24h">
                      {""}
                      <T>Next 24 hours</T>
                      {""}
                    </option>
                    <option value="weekend">
                      {""}
                      <T>This weekend</T>
                      {""}
                    </option>
                    <option value="7days">
                      {""}
                      <T>Next 7 days</T>
                      {""}
                    </option>
                    <option value="date">
                      {""}
                      <T>Choose a date</T>
                      {""}
                    </option>
                  </select>
                </label>
                {filters.meetingWindow === "date" ? (
                  <label>
                    {" "}
                    <T>Meeting date</T>{" "}
                    <input
                      type="date"
                      value={filters.meetingDate ?? ""}
                      onChange={(e) => update("meetingDate", e.target.value)}
                    />
                  </label>
                ) : null}
                <label>
                  {" "}
                  <T>Time of day</T>{" "}
                  <select
                    aria-label="Time of day preset"
                    value={
                      [
                        ["05:00", "12:00"],
                        ["12:00", "17:00"],
                        ["17:00", "22:00"],
                        ["22:00", "05:00"],
                      ].findIndex(
                        ([a, b]) =>
                          filters.startAfter === a && filters.startBefore === b,
                      ) >= 0
                        ? ["morning", "afternoon", "evening", "overnight"][
                            [
                              ["05:00", "12:00"],
                              ["12:00", "17:00"],
                              ["17:00", "22:00"],
                              ["22:00", "05:00"],
                            ].findIndex(
                              ([a, b]) =>
                                filters.startAfter === a &&
                                filters.startBefore === b,
                            )
                          ]
                        : !filters.startAfter && !filters.startBefore
                          ? "any"
                          : "custom"
                    }
                    onChange={(e) => {
                      const presets: Record<string, string[]> = {
                        any: ["", ""],
                        custom: ["00:00", ""],
                        morning: ["05:00", "12:00"],
                        afternoon: ["12:00", "17:00"],
                        evening: ["17:00", "22:00"],
                        overnight: ["22:00", "05:00"],
                      };
                      const p = presets[e.target.value];
                      if (p)
                        setFilters((f) => ({
                          ...f,
                          startAfter: p[0],
                          startBefore: p[1],
                        }));
                    }}
                  >
                    <option value="any">
                      {""}
                      <T>Any start time</T>
                      {""}
                    </option>
                    <option value="morning">
                      {""}
                      <T>Morning (5am–noon)</T>
                      {""}
                    </option>
                    <option value="afternoon">
                      {""}
                      <T>Afternoon (noon–5pm)</T>
                      {""}
                    </option>
                    <option value="evening">
                      {""}
                      <T>Evening (5pm–10pm)</T>
                      {""}
                    </option>
                    <option value="overnight">
                      {""}
                      <T>Overnight (10pm–5am)</T>
                      {""}
                    </option>
                    <option value="custom">
                      {""}
                      <T>Custom hours</T>
                      {""}
                    </option>
                  </select>
                </label>
                <div className="time-range">
                  <label>
                    {" "}
                    <T>Starts at or after</T>{" "}
                    <input
                      type="time"
                      value={filters.startAfter ?? ""}
                      onChange={(e) => update("startAfter", e.target.value)}
                    />
                  </label>
                  <label>
                    {" "}
                    <T>Starts before</T>{" "}
                    <input
                      type="time"
                      value={filters.startBefore ?? ""}
                      onChange={(e) => update("startBefore", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  {" "}
                  <T>Filter time zone</T>{" "}
                  <select
                    aria-label="Filter time zone"
                    value={filters.timeZone ?? "America/New_York"}
                    onChange={(e) => update("timeZone", e.target.value)}
                  >
                    {[...new Set([viewerZone, ...usTimeZones])].map((zone) => (
                      <option value={zone} key={zone}>
                        {zone === viewerZone ? t("Your local time: ") : ""}
                        {zone}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="small muted">
                  {" "}
                  <T>
                    Date and clock filters use the selected zone. The
                    meeting-day filter uses the group’s source time zone.
                    Overnight ranges can cross midnight. These filters use
                    scheduled start times; cancellations shown in our data are
                    excluded. They do not show provider opening hours.
                  </T>{" "}
                </p>
              </fieldset>
              <label>
                {" "}
                <T>Participants</T>{" "}
                <select
                  value={filters.population}
                  onChange={(e) => update("population", e.target.value)}
                >
                  <option value="">
                    {""}
                    <T>Any / not reported</T>
                    {""}
                  </option>
                  {options("populations").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.accessibility}
                  onChange={(e) => update("accessibility", e.target.checked)}
                />{" "}
                <T>Reported wheelchair access</T>{" "}
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.soon}
                  onChange={(e) => update("soon", e.target.checked)}
                />{" "}
                <T>Meetings starting in 3 hours</T>{" "}
              </label>
              {(filters.payment ||
                filters.language ||
                filters.accessibility) && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!filters.uncertainOnly}
                    onChange={(e) => update("uncertainOnly", e.target.checked)}
                  />
                  {t("Show only listings with unreported matching details")}
                </label>
              )}
              <p className="filter-footnote">
                {" "}
                <T>
                  Filters match reported information. Missing information means
                  “not reported.” Some approaches currently have
                  official-directory links only.
                </T>{" "}
              </p>
            </div>
          ) : null}
        </section>
        <section className="directory-workspace">
          <div
            className={`results-panel ${mobileView === "map" ? "mobile-hidden" : ""}`}
            id="results"
            aria-busy={searching}
          >
            <div className="results-heading">
              <div>
                <span className="eyebrow small">
                  {""}
                  <T>A PLACE TO BEGIN</T>
                  {""}
                </span>
                <h2 id="results-title" tabIndex={-1}>
                  {filters.savedOnly
                    ? t("Your saved resources")
                    : filters.category === "meetings"
                      ? t("Find your people")
                      : t("Explore your options")}
                  <span>{resultCount.toLocaleString()}</span>
                </h2>
              </div>
              <span className="sort-label">
                {filters.prioritizeRecovery !== false
                  ? t("Programs first · ")
                  : ""}
                {filters.category === "meetings" ||
                filters.format === "online" ||
                filters.soon
                  ? t("Next meeting first")
                  : filters.center
                    ? t("Nearest first")
                    : t("A–Z")}
              </span>
            </div>
            {filters.savedOnly ? (
              <SavedActions />
            ) : savedError ? (
              <p className="notice" role="alert">
                {savedError}
              </p>
            ) : null}
            <div className="coverage-note">
              <Info size={15} />
              <p>
                {searching
                  ? t("Searching regional sources…")
                  : t(
                      "National facility sources and regional meetings. Coverage varies by location.",
                    )}
                {online_or_unmapped > 0 ? (
                  <span>
                    {" "}
                    {online_or_unmapped.toLocaleString()}{" "}
                    <T>
                      online or without map coordinates; available in search
                      results.
                    </T>{" "}
                  </span>
                ) : null}
                <button onClick={() => setPanel("coverage")}>
                  {" "}
                  <T>About our coverage</T> <ArrowUpRight size={12} />
                </button>
                {mode === "snapshot" ? (
                  <strong>
                    {" "}
                    <T>Serving a dated backup snapshot.</T>
                    {""}
                  </strong>
                ) : null}
              </p>
            </div>
            {filters.uncertainOnly && (
              <p className="notice" role="status">
                {t(
                  "Details need confirmation. These listings have unreported payment, language or accessibility information. They are separate from documented matches.",
                )}
              </p>
            )}
            {searchError ? (
              <p className="notice" role="alert">
                {t(searchError)}.{" "}
                {usingBackup
                  ? t("Showing only the loaded backup listings.")
                  : t("Your current results have been kept.")}{" "}
                <button className="secondary" onClick={retry}>
                  {" "}
                  <T>Retry search</T>{" "}
                </button>
              </p>
            ) : null}
            {results.length ? (
              <div className="resource-list">
                {results.slice(0, limit).map((r) => (
                  <ResourceCard
                    key={r.id}
                    r={r}
                    saved={saved.includes(r.id)}
                    onSave={() => toggleSave(r.id)}
                    onOpen={() => openResource(r)}
                    onHover={setHighlight}
                    center={filters.center}
                    now={now}
                    timeFilters={filters}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Compass size={35} strokeWidth={1} />
                <h3>
                  {""}
                  <T>There are more paths to explore.</T>
                  {""}
                </h3>
                <p>
                  {filters.savedOnly
                    ? t(
                        "Save a resource using its bookmark button. Sign in to keep a private list across devices.",
                      )
                    : t(
                        "No published listings match these filters. Try a wider radius, fewer filters, or an official directory below.",
                      )}
                </p>
                {!filters.savedOnly && !searching && !searchError && (
                  <SearchAlternatives
                    filters={filters}
                    saved={saved}
                    asOf={asOf}
                    onApply={applyDiscovery}
                  />
                )}
                <button className="secondary" onClick={reset}>
                  {" "}
                  <T>Clear filters</T>{" "}
                </button>
              </div>
            )}
            {resultCount > limit ? (
              <nav
                className="result-pagination"
                aria-label={t("Resource result pages")}
              >
                <button
                  className="secondary"
                  disabled={offset === 0 || searching}
                  onClick={() => {
                    pendingScroll.current = true;
                    changePage(Math.max(0, offset - limit));
                  }}
                >
                  {t("Previous resources")}
                </button>
                <span role="status">
                  {offset + 1}–{Math.min(offset + limit, resultCount)} <T>of</T>
                  {""} {resultCount.toLocaleString()}
                </span>
                <button
                  className="secondary"
                  disabled={offset + limit >= resultCount || searching}
                  onClick={() => {
                    pendingScroll.current = true;
                    changePage(offset + limit);
                  }}
                >
                  {t("Next resources")}
                </button>
              </nav>
            ) : null}
            <div className="directory-fallback">
              <div className="section-inline">
                <h3>
                  {""}
                  <T>Keep exploring</T>
                  {""}
                </h3>
                <ArrowUpRight size={18} />
              </div>
              <p>
                {""}
                <T>More options from the organizations that maintain them.</T>
                {""}
              </p>
              <JurisdictionHelp state={filters.state} compact />
              <div className="directory-link-grid">
                {directoryLinks
                  .filter((x) =>
                    filters.category === "meetings"
                      ? x.type === "meetings"
                      : true,
                  )
                  .map((d) => (
                    <a
                      key={d.name}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>
                        <strong>{d.name}</strong>
                        <small>{t(d.detail)}</small>
                      </span>
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
              </div>
            </div>
            <div className="suggest-box" id="feedback">
              <HandHeart size={26} strokeWidth={1.3} />
              <div>
                <strong>
                  {""}
                  <T>Good information helps people find help.</T>
                  {""}
                </strong>
                <p>
                  {""}
                  <T>Know a resource we should include?</T>
                  {""}
                </p>
              </div>
              <button
                aria-label={t("Suggest a resource")}
                onClick={() => setPanel("suggest")}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div
            className={`map-panel ${mobileView === "list" ? "mobile-hidden" : ""}`}
            id="resource-map"
            tabIndex={-1}
            aria-label={t("Resource map")}
          >
            <RecoveryMap
              resources={results}
              selectedResource={mapSelection}
              focusRequest={mapFocusRequest}
              visible={mobileView === "map"}
              onClearSelection={() => setMapSelection(null)}
              filters={effectiveFilters}
              saved={saved}
              mappedTotal={mapped}
              center={filters.center}
              onSelect={openResource}
              onBounds={(b) => {
                setFilters((f) => ({ ...f, bounds: b, center: null }));
                setLocationLabel("");
              }}
              highlight={highlight}
            />
          </div>
        </section>
      </main>
      <ComparisonTray filters={filters} now={now} />
      <footer className="site-footer">
        <span className="footer-brand">
          <Compass size={18} /> <T>recovery atlas</T>{" "}
        </span>
        <p>
          {""}
          <T>Independent. Free to explore. Built with care.</T>
          {""}
        </p>
        <div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(publicSiteUrl + "/");
                setCopied(true);
              } catch {
                setMessage("Public link: " + publicSiteUrl + "/");
              }
            }}
          >
            {copied ? t("Public link copied") : t("Copy public link")}
          </button>
          <button onClick={() => setPanel("privacy")}>
            {""}
            <T>Privacy</T>
            {""}
          </button>
          <button onClick={() => setPanel("coverage")}>
            {" "}
            <T>Sources & coverage</T>{" "}
          </button>
          <button onClick={() => setPanel("suggest")}>
            {" "}
            <T>Suggest a resource</T>{" "}
          </button>
        </div>
      </footer>
      <div className="mobile-view-switch">
        <button
          className={mobileView === "list" ? "active" : ""}
          onClick={() => setMobileView("list")}
        >
          <List size={16} /> <T>List</T>{" "}
        </button>
        <button
          className={mobileView === "map" ? "active" : ""}
          onClick={() => setMobileView("map")}
        >
          <MapIcon size={16} /> <T>Map</T>{" "}
        </button>
      </div>
      {selected ? (
        <ResourceDetail
          key={selected.id}
          resource={selected}
          timeFilters={filters}
          onClose={closeResource}
          onShowMap={
            resourceMapTarget(selected)
              ? () => {
                  showMapAfterClose.current = true;
                  closeResource();
                }
              : undefined
          }
          saved={saved.includes(selected.id)}
          onSave={() => toggleSave(selected.id)}
          now={now}
        />
      ) : null}
      <Modal
        open={!!panel}
        onClose={() => setPanel("")}
        title={
          panel === "help"
            ? t("A real person. A next step.")
            : panel === "guide"
              ? t("There’s more than one path.")
              : panel === "privacy"
                ? t("Your search is personal.")
                : panel === "suggest"
                  ? t("Help someone find their next step.")
                  : panel === "coverage"
                    ? t("Useful information, honestly labeled.")
                    : t("Recovery looks different for everyone.")
        }
      >
        {panel === "help" ? <JurisdictionHelp state={filters.state} /> : null}
        {panel === "guide" ? (
          <div className="stack">
            <div className="guide-step">
              <Users />
              <div>
                <h3>
                  {""}
                  <T>Find connection</T>
                  {""}
                </h3>
                <p>
                  {" "}
                  <T>
                    AA, SMART Recovery, Recovery Dharma and other peer groups
                    offer different approaches. Read participation details and
                    try the official directories for more meeting choices.
                  </T>{" "}
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    update("category", "meetings");
                    setPanel("");
                  }}
                >
                  {" "}
                  <T>Explore meetings</T> <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div className="guide-step">
              <Heart />
              <div>
                <h3>
                  {""}
                  <T>Explore treatment</T>
                  {""}
                </h3>
                <p>
                  {" "}
                  <T>
                    Detox, residential and outpatient services offer different
                    levels of support. A provider or an official state treatment
                    helpline can help you understand the options and arrange an
                    assessment.
                  </T>{" "}
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    update("category", "treatment");
                    setPanel("");
                  }}
                >
                  {" "}
                  <T>Explore treatment</T> <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div className="guide-step">
              <Brain />
              <div>
                <h3>
                  {""}
                  <T>Support your mental health</T>
                  {""}
                </h3>
                <p>
                  {" "}
                  <T>
                    Community Behavioral Health Centers offer mental health and
                    substance use care. Check service areas, intake requirements
                    and payment details with the center.
                  </T>{" "}
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    update("category", "mental-health");
                    setPanel("");
                  }}
                >
                  {" "}
                  <T>Explore mental health care</T> <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <p className="notice">
              {" "}
              <T>
                This directory helps you find resources. A qualified
                professional can assess your needs and recommend care.
              </T>{" "}
            </p>
          </div>
        ) : null}
        {panel === "about" ? (
          <div className="stack">
            <p>
              {" "}
              <T>
                Recovery Atlas brings recovery meetings, treatment and mental
                health resources into one approachable place across all 50 US
                states, DC and US territories. Imported facility data and
                meeting coverage vary by jurisdiction.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                We believe people deserve clear information, room to choose
                their own approach, and a way to connect with real support.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Search results are ordered by relevance to your filters,
                distance or meeting time. There are no paid placements or
                referral fees.
              </T>{" "}
            </p>
            <p className="notice">
              {" "}
              <T>
                This is an independent directory. Listings do not imply
                affiliation, endorsement, verified clinical quality or
                guaranteed availability.
              </T>{" "}
            </p>
          </div>
        ) : null}
        {panel === "privacy" ? (
          <div className="stack">
            <p>
              {" "}
              <T>
                Community profiles are hidden by default. Adults can choose to
                make their handle, display name, bio, broad region and languages
                visible to signed-in adult members. A conversation starts with a
                request that the other person must accept. You can block or
                report received messages.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Messages are encrypted in storage and transit, but are not
                end-to-end encrypted. The moderation inbox shows only messages
                specifically reported by a participant. Messages are removed
                after 180 days, pending requests after 30 days and report
                evidence after 90 days. Deleting an account removes its
                conversations for both participants; report evidence can remain
                for the moderation period.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Calendar buttons share meeting details with the calendar service
                you choose. Downloads are snapshots and do not receive automatic
                schedule changes. Optional offline copies remain readable on
                this device after sign-out; remove them from the Offline
                resources page. Profiles and messages are never cached for
                offline use.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                No account is needed to browse. Signed-out saves stay in this
                browser. If you create an account, its saved resource IDs are
                stored privately in our database and can be accessed after
                signing in on another device. Browser-only saves are copied into
                an account only when you choose to import them. We do not
                install advertising trackers or session replay.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Search terms, selected filters and location coordinates are sent
                to this app to find matching resources. Street-address lookup
                passes the address to the U.S. Census geocoder. Saved resource
                IDs are sent when searching your favorites. We do not store a
                search history in the directory database.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                The map provider receives your IP address and requests for the
                map areas you view. Hosting providers process technical access
                information under their own policies. We do not promise that
                infrastructure logs contain no metadata.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Correction submissions are stored in our review inbox. Don’t
                include medical or insurance identification information. Rate
                limits use a keyed hash of your IP address with an expiration,
                not your raw IP address.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Accounts use a private username, a hashed password and optional
                passkeys. We do not request your real name or email. A recovery
                code can restore access if you forget your password. Account
                sessions use secure cookies; rate-limit records use keyed hashes
                and expire. You can download your saved list, sign out, or
                delete your account and its saved list in the account panel.
                Keep downloaded files private.
              </T>{" "}
            </p>
            <button
              className="secondary"
              onClick={() => {
                clearGuest();
                setMessage(
                  "Browser-only saves cleared. Account saves are managed in your account.",
                );
                setPanel("");
              }}
            >
              {" "}
              <T>Clear browser-only saves</T>{" "}
            </button>
          </div>
        ) : null}
        {panel === "coverage" ? (
          <div className="stack">
            <p>
              <strong>
                {coverage.total.toLocaleString()} <T>published listings ·</T>
                {""} {coverage.mapped.toLocaleString()}{" "}
                <T>mapped resources</T>{" "}
              </strong>
              <br />
              {coverage.approaches
                .map((a) => `${a.listings.toLocaleString()} ${a.name}`)
                .join(" · ")}{" "}
              <T>
                meetings. See the source review dates and state coverage below.
              </T>{" "}
            </p>
            <p>
              {t("National facility catalog")}:{" "}
              {nationalManifest.total.toLocaleString()} · {t("Directory year")}:{" "}
              {nationalManifest.directoryYear} · {t("Survey year")}:{" "}
              {nationalManifest.surveyYear}.{" "}
              {t(
                "Annual directory facts do not establish current availability.",
              )}
            </p>
            <p>
              {t(
                "American Samoa and the Minor Outlying Islands have no facility records in this import. Official help links remain available. Meeting imports are regional; use the national meeting directories for other areas.",
              )}
            </p>
            <table className="coverage-table">
              <caption>
                {" "}
                <T>Listings by state · source review</T> {coverage.reviewedAt}
              </caption>
              <thead>
                <tr>
                  <th scope="col">
                    {""}
                    <T>State</T>
                    {""}
                  </th>
                  <th scope="col">
                    {""}
                    <T>Listings</T>
                    {""}
                  </th>
                  <th scope="col">
                    {""}
                    <T>Mapped</T>
                    {""}
                  </th>
                  <th scope="col">
                    {""}
                    <T>Meetings</T>
                    {""}
                  </th>
                </tr>
              </thead>
              <tbody>
                {coverage.states.map((s) => (
                  <tr key={s.state}>
                    <th scope="row">
                      {stateNames[s.state as keyof typeof stateNames]}
                    </th>
                    <td>{s.listings.toLocaleString()}</td>
                    <td>{s.mapped.toLocaleString()}</td>
                    <td>{s.meetings.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {" "}
              <T>
                National and regional coverage includes public professional and
                facility registries, SAMHSA’s 2025 facility directories, state
                treatment listings and regional AA, NA, SMART, Dharma and Refuge
                meetings. Coverage varies by state and fellowship. A state count
                does not mean every local service or meeting is included.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Every listing links to its dated source. “Source reviewed” does
                not mean we contacted the provider or group; direct verification
                is shown separately.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Some source meeting schedules have older update dates. Confirm
                details with the group before traveling. The scheduled next
                meeting is a calculation, not confirmation that it will occur.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                NPPES records report a public practice address and specialty. An
                active NPI does not verify a professional license, accepting new
                patients or insurance participation. Missing payment details
                remain unknown. Confirm with the provider and your insurer.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                Every mapped resource is represented on the map, independently
                of list pagination. Groups show the number of matching resources
                inside them; zoom in to explore individuals. Shared locations
                offer a choice of resources. Some pins use an approximate
                ZIP-area location; check the address in the details. Published
                directories can omit services or contain stale records; coverage
                is not a guarantee that every US resource is listed.
              </T>{" "}
            </p>
            <p>
              {" "}
              <T>
                SAMHSA’s facility records reflect the 2025 directory and 2024
                survey. Confirm current operations, payment and admission
                details. State directories and individual sources can be newer.
                Additional fellowships and some regional meeting directories
                still need imports.
              </T>{" "}
            </p>
            <a
              className="text-link"
              href="/coverage.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              {" "}
              <T>View source counts and coverage report</T>{" "}
              <ArrowUpRight size={14} />
            </a>
            <p className="notice">
              {" "}
              <T>
                Insurance acceptance, availability, admission and clinical
                suitability must be confirmed. Online-only meetings never
                receive a physical map pin.
              </T>{" "}
            </p>
            <div className="directory-link-grid">
              {directoryLinks.map((d) => (
                <a
                  key={d.name}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {d.name}
                  <ArrowUpRight size={15} />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {panel === "suggest" ? (
          <CorrectionForm onDone={() => setPanel("")} />
        ) : null}
      </Modal>
    </>
  );
}

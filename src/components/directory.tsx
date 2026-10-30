"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useDeferredValue } from "react";
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
import type { Resource, Filters, MapResource } from "@/lib/types";
import { categories } from "@/lib/types";
import { defaultFilters, filterResources, miles } from "@/lib/search";
import Modal from "./modal";
import ResourceDetail, { CorrectionForm, NextTime } from "./resource-detail";
import coverage from "../../public/coverage.json";
import { regionStates, stateNames } from "@/lib/region";
import { publicSiteUrl } from "@/lib/site";
import { useSaved } from "./saved-provider";
import AccountButton from "./account-panel";
import SavedActions from "./saved-actions";
import Link from "next/link";
import { useLanguage } from "./language-provider";
const RecoveryMap = dynamic(() => import("./region-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});
const directoryLinks = [
  {
    name: "AA · Western Massachusetts",
    detail: "Western Mass Intergroup",
    url: "https://westernmassaa.org/",
    type: "meetings",
  },
  {
    name: "AA · Eastern Massachusetts",
    detail: "Local meetings & online options",
    url: "https://aaboston.org/meetings",
    type: "meetings",
  },
  {
    name: "AA · Central Massachusetts",
    detail: "Worcester & MetroWest",
    url: "https://aaworcester.org/meetinglist.aspx?grp=wai",
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
    name: "Narcotics Anonymous",
    detail: "Official meeting search",
    url: "https://www.na.org/meetingsearch/",
    type: "meetings",
  },
  {
    name: "Refuge Recovery",
    detail: "Meditation-based peer support",
    url: "https://refugerecoverymeetings.org/meetings",
    type: "meetings",
  },
  {
    name: "Massachusetts Substance Use Helpline",
    detail: "Treatment, recovery & harm reduction",
    url: "https://hub.helplinema.org/spa_result",
    type: "treatment",
  },
  {
    name: "FindTreatment.gov",
    detail: "National treatment facility directory",
    url: "https://findtreatment.gov/",
    type: "treatment",
  },
  {
    name: "MassHealth provider directory",
    detail: "Search providers for your MassHealth plan",
    url: "https://www.mass.gov/info-details/find-a-provider",
    type: "provider",
  },
];
function TypeIcon({ r }: { r: Resource }) {
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
  const distance =
    center && r.lat !== null && r.lng !== null
      ? miles(center, { lat: r.lat, lng: r.lng })
      : null;
  return (
    <article
      className="resource-card"
      onMouseEnter={() => onHover(r.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="card-top">
        <span className={`resource-icon ${r.kind}`}>
          <TypeIcon r={r} />
        </span>
        <span className="card-type">
          {r.sourceName === "NPPES public facility registry"
            ? "Facility registry"
            : (r.fellowship ??
              (r.kind === "clinic"
                ? "Community care"
                : r.kind === "hospital"
                  ? "Hospital services"
                  : r.kind === "provider"
                    ? r.sourceName.startsWith("NPPES")
                      ? "Provider registry"
                      : "Care provider"
                    : "Treatment center"))}
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
              · {distance.toFixed(1)} mi
              {r.coordinateAccuracy === "approximate" ? " (approx.)" : ""}
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
                ? "Hybrid"
                : r.formats.includes("online")
                  ? "Online"
                  : "In person"}
            </span>
          </>
        ) : (
          <>
            <span className="tag">{r.services[0]}</span>
            {r.payment.includes("MassHealth") ? (
              <span className="tag neutral">MassHealth · confirm benefits</span>
            ) : (
              <span className="tag neutral">Payment: ask provider</span>
            )}
          </>
        )}
      </div>
      <div className="card-bottom">
        <span>
          <ShieldCheck size={13} />
          {r.sourceName.startsWith("NPPES")
            ? "Registry · license not checked"
            : "Sourced listing"}
        </span>
        <button onClick={onOpen}>
          View details <ArrowUpRight size={15} />
        </button>
      </div>
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
    [selected, setSelected] = useState<Resource | null>(null),
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
  const [offset, setOffset] = useState(0);
  const [viewerZone, setViewerZone] = useState("America/New_York");
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setViewerZone(zone);
    setFilters((f) => ({ ...f, timeZone: zone }));
  }, []);
  const query = useDeferredValue(filters.query);
  useEffect(() => {
    setOffset(0);
  }, [filters, query, saved]);
  const effectiveFilters = useMemo(
    () => ({ ...filters, query }),
    [filters, query],
  );
  const [remote, setRemote] = useState<{
    resources: Resource[];
    mapped: number;
    total: number;
    online_or_unmapped: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [facets, setFacets] = useState<Record<string, string[]>>({});
  useEffect(() => {
    fetch("/api/facets")
      .then((r) => (r.ok ? r.json() : {}))
      .then(setFacets)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filters: { ...filters, query },
            saved,
            limit: Math.min(limit, 500),
            offset,
          }),
          signal: abort.signal,
        });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setRemote(data);
      } catch (e) {
        if (!abort.signal.aborted) {
          setRemote(null);
          setMessage(
            (e instanceof Error ? e.message : "Search unavailable") +
              ". Showing only the loaded backup listings.",
          );
        }
      } finally {
        if (!abort.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [filters, query, saved, limit, offset]);
  async function openMapResource(pin: MapResource) {
    const local =
      remote?.resources.find((r) => r.id === pin.id) ??
      resources.find((r) => r.id === pin.id);
    if (local) {
      setSelected(local);
      return;
    }
    try {
      const res = await fetch("/api/resources/" + encodeURIComponent(pin.id));
      if (!res.ok) throw Error("Resource details are temporarily unavailable.");
      setSelected(await res.json());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Resource unavailable");
    }
  }
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const localResults = useMemo(
    () =>
      filterResources(
        resources,
        { ...filters, query },
        saved,
        now ?? new Date("2026-10-22T12:00:00Z"),
      ),
    [resources, filters, query, saved, now],
  );
  const results =
    remote?.resources ?? localResults.slice(offset, offset + limit);
  const resultCount = remote?.total ?? localResults.length;
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
        Skip to results
      </a>
      <div className="help-strip">
        <span>
          <Heart size={13} />
          You don’t have to figure it out alone.
        </span>
        <button onClick={() => setPanel("help")}>
          Talk to someone who can help <ArrowUpRight size={13} />
        </button>
      </div>
      <header className="site-header">
        <a href="/" className="brand">
          <span className="brand-mark">
            <Compass size={26} strokeWidth={1.5} />
          </span>
          <span>
            recovery<span className="brand-light">atlas</span>
            <small>A LITTLE DIRECTION. A WAY FORWARD.</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
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
              Your next step starts <em>here.</em>
            </h1>
          </div>
        </section>
        <section className="search-section" aria-label="Search resources">
          <div className="guided-paths" aria-label="Choose a starting point">
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
                  setOffset(0);
                }}
              >
                {t(label)}
              </button>
            ))}
            <Link className="secondary" href="/support">
              {t("Support for daily life")}
            </Link>
          </div>
          <div className="search-bar">
            <label className="keyword-field">
              <Search size={19} />
              <span className="sr-only">Search keywords</span>
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
                  Northeast city, state, ZIP or address
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
                aria-label="Use my current location"
                disabled={locating}
                onClick={locate}
              >
                <Navigation size={17} />
              </button>
              <label className="radius-field">
                <span className="sr-only">Search radius</span>
                <select
                  value={filters.radius}
                  onChange={(e) => update("radius", Number(e.target.value))}
                >
                  {[5, 10, 25, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>
                      {n} miles
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
          {message ? (
            <p className="form-error" role="status">
              {message}
            </p>
          ) : null}
          {locationLabel || filters.bounds ? (
            <div className="location-status">
              <MapPin size={13} />
              {filters.bounds
                ? "Searching the visible map area"
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
        <section className="filter-section" aria-label="Filter resources">
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
                aria-label="Attendance format"
                value={filters.format}
                onChange={(e) => update("format", e.target.value)}
              >
                <option value="">Any format</option>
                <option value="in-person">In person</option>
                <option value="online">Online meetings</option>
                <option value="hybrid">Hybrid meetings</option>
                <option value="telehealth">Telehealth care</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <label className="filter-select">
              <ShieldCheck size={14} />
              <select
                aria-label="Insurance or payment"
                value={filters.payment}
                onChange={(e) => update("payment", e.target.value)}
              >
                <option value="">Insurance & payment</option>
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
                <RotateCcw size={13} />
                Reset
              </button>
            ) : null}
          </div>
          {more ? (
            <div className="expanded-filters">
              <label>
                State
                <select
                  aria-label="State"
                  value={filters.state ?? ""}
                  onChange={(e) => update("state", e.target.value)}
                >
                  <option value="">All Northeast states</option>
                  {regionStates.map((s) => (
                    <option key={s} value={s}>
                      {stateNames[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Recovery approach
                <select
                  value={filters.fellowship}
                  onChange={(e) => update("fellowship", e.target.value)}
                >
                  <option value="">Any approach</option>
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
                Service
                <select
                  value={filters.service}
                  onChange={(e) => update("service", e.target.value)}
                >
                  <option value="">Any service</option>
                  {options("services").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Language
                <select
                  value={filters.language}
                  onChange={(e) => update("language", e.target.value)}
                >
                  <option value="">Any / not reported</option>
                  {options("languages").map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Meeting day
                <select
                  value={filters.day}
                  onChange={(e) => update("day", e.target.value)}
                >
                  <option value="">Any day</option>
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
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="meeting-time-filters stack">
                <legend>Meeting date &amp; time</legend>
                <label>
                  When
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
                    <option value="">Any upcoming date</option>
                    <option value="today">Today</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="24h">Next 24 hours</option>
                    <option value="weekend">This weekend</option>
                    <option value="7days">Next 7 days</option>
                    <option value="date">Choose a date</option>
                  </select>
                </label>
                {filters.meetingWindow === "date" ? (
                  <label>
                    Meeting date
                    <input
                      type="date"
                      value={filters.meetingDate ?? ""}
                      onChange={(e) => update("meetingDate", e.target.value)}
                    />
                  </label>
                ) : null}
                <label>
                  Time of day
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
                    <option value="any">Any start time</option>
                    <option value="morning">Morning (5am–noon)</option>
                    <option value="afternoon">Afternoon (noon–5pm)</option>
                    <option value="evening">Evening (5pm–10pm)</option>
                    <option value="overnight">Overnight (10pm–5am)</option>
                    <option value="custom">Custom hours</option>
                  </select>
                </label>
                <div className="time-range">
                  <label>
                    Starts at or after
                    <input
                      type="time"
                      value={filters.startAfter ?? ""}
                      onChange={(e) => update("startAfter", e.target.value)}
                    />
                  </label>
                  <label>
                    Starts before
                    <input
                      type="time"
                      value={filters.startBefore ?? ""}
                      onChange={(e) => update("startBefore", e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Filter time zone
                  <select
                    aria-label="Filter time zone"
                    value={filters.timeZone ?? "America/New_York"}
                    onChange={(e) => update("timeZone", e.target.value)}
                  >
                    {[...new Set([viewerZone, "America/New_York", "UTC"])].map(
                      (zone) => (
                        <option value={zone} key={zone}>
                          {zone === viewerZone ? "Your local time: " : ""}
                          {zone}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <p className="small muted">
                  Date and clock filters use the selected zone. The meeting-day
                  filter uses the group’s source time zone. Overnight ranges can
                  cross midnight. These filters use scheduled start times;
                  cancellations shown in our data are excluded. They do not show
                  provider opening hours.
                </p>
              </fieldset>
              <label>
                Participants
                <select
                  value={filters.population}
                  onChange={(e) => update("population", e.target.value)}
                >
                  <option value="">Any / not reported</option>
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
                />
                Reported wheelchair access
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.soon}
                  onChange={(e) => update("soon", e.target.checked)}
                />
                Meetings starting in 3 hours
              </label>
              <p className="filter-footnote">
                Filters match reported information. Missing information means
                “not reported.” Some approaches currently have
                official-directory links only.
              </p>
            </div>
          ) : null}
        </section>
        <section className="directory-workspace">
          <div
            className={`results-panel ${mobileView === "map" ? "mobile-hidden" : ""}`}
            id="results"
          >
            <div className="results-heading">
              <div>
                <span className="eyebrow small">A PLACE TO BEGIN</span>
                <h2>
                  {filters.savedOnly
                    ? "Your saved resources"
                    : filters.category === "meetings"
                      ? "Find your people"
                      : "Explore your options"}
                  <span>{resultCount.toLocaleString()}</span>
                </h2>
              </div>
              <span className="sort-label">
                {filters.category === "meetings" ||
                filters.format === "online" ||
                filters.soon
                  ? "Next meeting first"
                  : filters.center
                    ? "Nearest first"
                    : "A–Z"}
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
                  ? "Searching regional sources…"
                  : "Regional source coverage · published listings and provider registry records."}
                {remote && remote.online_or_unmapped > 0 ? (
                  <span>
                    {" "}
                    {remote.online_or_unmapped.toLocaleString()} online or
                    without map coordinates; available in search results.
                  </span>
                ) : null}
                <button onClick={() => setPanel("coverage")}>
                  About our coverage <ArrowUpRight size={12} />
                </button>
                {mode === "snapshot" ? (
                  <strong> Serving a dated backup snapshot.</strong>
                ) : null}
              </p>
            </div>
            {results.length ? (
              <div className="resource-list">
                {results.slice(0, limit).map((r) => (
                  <ResourceCard
                    key={r.id}
                    r={r}
                    saved={saved.includes(r.id)}
                    onSave={() => toggleSave(r.id)}
                    onOpen={() => setSelected(r)}
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
                <h3>There are more paths to explore.</h3>
                <p>
                  {filters.savedOnly
                    ? "Save a resource using its bookmark button. Sign in to keep a private list across devices."
                    : "No published listings match these filters. Try a wider radius, fewer filters, or an official directory below."}
                </p>
                <button className="secondary" onClick={reset}>
                  Clear filters
                </button>
              </div>
            )}
            {resultCount > limit ? (
              <nav
                className="result-pagination"
                aria-label="Resource result pages"
              >
                <button
                  className="secondary"
                  disabled={offset === 0 || searching}
                  onClick={() => {
                    setOffset((n) => Math.max(0, n - limit));
                    document
                      .getElementById("results")
                      ?.scrollIntoView({ block: "start" });
                  }}
                >
                  {t("Previous resources")}
                </button>
                <span role="status">
                  {offset + 1}–{Math.min(offset + limit, resultCount)} of{" "}
                  {resultCount.toLocaleString()}
                </span>
                <button
                  className="secondary"
                  disabled={offset + limit >= resultCount || searching}
                  onClick={() => {
                    setOffset((n) => n + limit);
                    document
                      .getElementById("results")
                      ?.scrollIntoView({ block: "start" });
                  }}
                >
                  {t("Next resources")}
                </button>
              </nav>
            ) : null}
            <div className="directory-fallback">
              <div className="section-inline">
                <h3>Keep exploring</h3>
                <ArrowUpRight size={18} />
              </div>
              <p>More options from the organizations that maintain them.</p>
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
                        <small>{d.detail}</small>
                      </span>
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
              </div>
            </div>
            <div className="suggest-box" id="feedback">
              <HandHeart size={26} strokeWidth={1.3} />
              <div>
                <strong>Good information helps people find help.</strong>
                <p>Know a resource we should include?</p>
              </div>
              <button
                aria-label="Suggest a resource"
                onClick={() => setPanel("suggest")}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div
            className={`map-panel ${mobileView === "list" ? "mobile-hidden" : ""}`}
          >
            <RecoveryMap
              resources={results}
              filters={effectiveFilters}
              saved={saved}
              mappedTotal={
                remote?.mapped ?? results.filter((r) => r.lat !== null).length
              }
              center={filters.center}
              onSelect={openMapResource}
              onBounds={(b) => {
                setFilters((f) => ({ ...f, bounds: b, center: null }));
                setLocationLabel("");
              }}
              highlight={highlight}
            />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Compass size={18} /> recovery atlas
        </span>
        <p>Independent. Free to explore. Built with care.</p>
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
            {copied ? "Public link copied" : "Copy public link"}
          </button>
          <button onClick={() => setPanel("privacy")}>Privacy</button>
          <button onClick={() => setPanel("coverage")}>
            Sources & coverage
          </button>
          <button onClick={() => setPanel("suggest")}>
            Suggest a resource
          </button>
        </div>
      </footer>
      <div className="mobile-view-switch">
        <button
          className={mobileView === "list" ? "active" : ""}
          onClick={() => setMobileView("list")}
        >
          <List size={16} />
          List
        </button>
        <button
          className={mobileView === "map" ? "active" : ""}
          onClick={() => setMobileView("map")}
        >
          <MapIcon size={16} />
          Map
        </button>
      </div>
      {selected ? (
        <ResourceDetail
          key={selected.id}
          resource={selected}
          timeFilters={filters}
          onClose={() => setSelected(null)}
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
            ? "A real person. A next step."
            : panel === "guide"
              ? "There’s more than one path."
              : panel === "privacy"
                ? "Your search is personal."
                : panel === "suggest"
                  ? "Help someone find their next step."
                  : panel === "coverage"
                    ? "Useful information, honestly labeled."
                    : "Recovery looks different for everyone."
        }
      >
        {panel === "help" ? (
          <div className="stack">
            <a
              className="help-card"
              href="https://findtreatment.gov/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin />
              <span>
                <strong>Find treatment in any covered state</strong>
                <small>
                  SAMHSA’s public treatment finder · No directory account
                  required
                </small>
              </span>
              <ArrowUpRight size={17} />
            </a>
            <p>
              If there is an immediate medical emergency or suspected overdose,
              call <a href="tel:911">911</a>.
            </p>
            <a className="help-card" href="tel:8003275050">
              <Heart />
              <span>
                <strong>Massachusetts Substance Use Helpline</strong>
                <small>800-327-5050 · Free and confidential · 24/7</small>
              </span>
              <Phone size={17} />
            </a>
            <a className="help-card" href="tel:8337732445">
              <Brain />
              <span>
                <strong>Massachusetts Behavioral Health Help Line</strong>
                <small>833-773-2445 · Call or text · 24/7</small>
              </span>
              <Phone size={17} />
            </a>
            <a
              className="help-card"
              href="tel:988?oai_link_source=model_response_hotline"
            >
              <HandHeart />
              <span>
                <strong>988 Suicide & Crisis Lifeline</strong>
                <small>Call 988 for crisis counseling and referrals</small>
              </span>
              <Phone size={17} />
            </a>
            <a
              className="text-link"
              href="https://988lifeline.org/chat/?oai_link_source=model_response_hotline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Chat with 988 <ArrowUpRight size={14} />
            </a>
            <p className="muted">
              Official sources:{" "}
              <a
                href="https://helplinema.org/contact-us/"
                target="_blank"
                rel="noopener noreferrer"
              >
                MA Substance Use Helpline
              </a>{" "}
              ·{" "}
              <a
                href="https://www.mass.gov/community-behavioral-health-centers"
                target="_blank"
                rel="noopener noreferrer"
              >
                Mass.gov
              </a>
            </p>
          </div>
        ) : null}
        {panel === "guide" ? (
          <div className="stack">
            <div className="guide-step">
              <Users />
              <div>
                <h3>Find connection</h3>
                <p>
                  AA, SMART Recovery, Recovery Dharma and other peer groups
                  offer different approaches. Read participation details and try
                  the official directories for more meeting choices.
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    update("category", "meetings");
                    setPanel("");
                  }}
                >
                  Explore meetings <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div className="guide-step">
              <Heart />
              <div>
                <h3>Explore treatment</h3>
                <p>
                  Detox, residential and outpatient services offer different
                  levels of support. A provider or an official state treatment
                  helpline can help you understand the options and arrange an
                  assessment.
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    update("category", "treatment");
                    setPanel("");
                  }}
                >
                  Explore treatment <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <div className="guide-step">
              <Brain />
              <div>
                <h3>Support your mental health</h3>
                <p>
                  Community Behavioral Health Centers offer mental health and
                  substance use care. Check service areas, intake requirements
                  and payment details with the center.
                </p>
                <button
                  className="text-link"
                  onClick={() => {
                    update("category", "mental-health");
                    setPanel("");
                  }}
                >
                  Explore mental health care <ArrowRight size={14} />
                </button>
              </div>
            </div>
            <p className="notice">
              This directory helps you find resources. A qualified professional
              can assess your needs and recommend care.
            </p>
          </div>
        ) : null}
        {panel === "about" ? (
          <div className="stack">
            <p>
              Recovery Atlas brings recovery meetings, treatment and mental
              health resources into one approachable place across Connecticut,
              Massachusetts, Maine, New Hampshire, New Jersey, New York,
              Pennsylvania, Rhode Island and Vermont.
            </p>
            <p>
              We believe people deserve clear information, room to choose their
              own approach, and a way to connect with real support.
            </p>
            <p>
              Search results are ordered by relevance to your filters, distance
              or meeting time. There are no paid placements or referral fees.
            </p>
            <p className="notice">
              This is an independent directory. Listings do not imply
              affiliation, endorsement, verified clinical quality or guaranteed
              availability.
            </p>
          </div>
        ) : null}
        {panel === "privacy" ? (
          <div className="stack">
            <p>
              Community profiles are hidden by default. Adults can choose to
              make their handle, display name, bio, broad region and languages
              visible to signed-in adult members. A conversation starts with a
              request that the other person must accept. You can block or report
              received messages.
            </p>
            <p>
              Messages are encrypted in storage and transit, but are not
              end-to-end encrypted. The moderation inbox shows only messages
              specifically reported by a participant. Messages are removed after
              180 days, pending requests after 30 days and report evidence after
              90 days. Deleting an account removes its conversations for both
              participants; report evidence can remain for the moderation
              period.
            </p>
            <p>
              Calendar buttons share meeting details with the calendar service
              you choose. Downloads are snapshots and do not receive automatic
              schedule changes. Optional offline copies remain readable on this
              device after sign-out; remove them from the Offline resources
              page. Profiles and messages are never cached for offline use.
            </p>
            <p>
              No account is needed to browse. Signed-out saves stay in this
              browser. If you create an account, its saved resource IDs are
              stored privately in our database and can be accessed after signing
              in on another device. Browser-only saves are copied into an
              account only when you choose to import them. We do not install
              advertising trackers or session replay.
            </p>
            <p>
              Search terms, selected filters and location coordinates are sent
              to this app to find matching resources. Street-address lookup
              passes the address to the U.S. Census geocoder. Saved resource IDs
              are sent when searching your favorites. We do not store a search
              history in the directory database.
            </p>
            <p>
              The map provider receives your IP address and requests for the map
              areas you view. Hosting providers process technical access
              information under their own policies. We do not promise that
              infrastructure logs contain no metadata.
            </p>
            <p>
              Correction submissions are stored in our review inbox. Don’t
              include medical or insurance identification information. Rate
              limits use a keyed hash of your IP address with an expiration, not
              your raw IP address.
            </p>
            <p>
              Accounts use a private username, a hashed password and optional
              passkeys. We do not request your real name or email. A recovery
              code can restore access if you forget your password. Account
              sessions use secure cookies; rate-limit records use keyed hashes
              and expire. You can download your saved list, sign out, or delete
              your account and its saved list in the account panel. Keep
              downloaded files private.
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
              Clear browser-only saves
            </button>
          </div>
        ) : null}
        {panel === "coverage" ? (
          <div className="stack">
            <p>
              <strong>
                {coverage.total.toLocaleString()} published listings ·{" "}
                {coverage.mapped.toLocaleString()} mapped resources
              </strong>
              <br />
              {coverage.approaches
                .map((a) => `${a.listings.toLocaleString()} ${a.name}`)
                .join(" · ")}{" "}
              meetings. See the source review dates and state coverage below.
            </p>
            <table className="coverage-table">
              <caption>
                Listings by state · source review {coverage.reviewedAt}
              </caption>
              <thead>
                <tr>
                  <th scope="col">State</th>
                  <th scope="col">Listings</th>
                  <th scope="col">Mapped</th>
                  <th scope="col">Meetings</th>
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
              Northeast coverage includes public professional and facility
              registries, SAMHSA’s 2025 facility directories, state treatment
              listings and regional AA, NA, SMART, Dharma and Refuge meetings.
              Coverage varies by state and fellowship. A state count does not
              mean every local service or meeting is included.
            </p>
            <p>
              Every listing links to its dated source. “Source reviewed” does
              not mean we contacted the provider or group; direct verification
              is shown separately.
            </p>
            <p>
              Some source meeting schedules have older update dates. Confirm
              details with the group before traveling. The scheduled next
              meeting is a calculation, not confirmation that it will occur.
            </p>
            <p>
              NPPES records report a public practice address and specialty. An
              active NPI does not verify a professional license, accepting new
              patients or insurance participation. Missing payment details
              remain unknown. Confirm with the provider and your insurer.
            </p>
            <p>
              Every mapped resource is represented on the map, independently of
              list pagination. Groups show the number of matching resources
              inside them; zoom in to explore individuals. Shared locations
              offer a choice of resources. Some pins use an approximate ZIP-area
              location; check the address in the details. Published directories
              can omit services or contain stale records; coverage is not a
              guarantee that every Northeast resource is listed.
            </p>
            <p>
              SAMHSA’s facility records reflect the 2025 directory and 2024
              survey. Confirm current operations, payment and admission details.
              State directories and individual sources can be newer. Additional
              fellowships and some regional meeting directories still need
              imports.
            </p>
            <a
              className="text-link"
              href="/coverage.json"
              target="_blank"
              rel="noopener noreferrer"
            >
              View source counts and coverage report <ArrowUpRight size={14} />
            </a>
            <p className="notice">
              Insurance acceptance, availability, admission and clinical
              suitability must be confirmed. Online-only meetings never receive
              a physical map pin.
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

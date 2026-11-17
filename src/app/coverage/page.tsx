import Link from "next/link";
import { getCountyCoverage } from "@/lib/county-coverage";
import { regionStates, stateNames } from "@/lib/region";
import { getCoverage } from "@/lib/coverage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Local coverage and gaps – Recovery Atlas",
  alternates: { canonical: "/coverage" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams,
    state = regionStates.includes(p.state as any) ? p.state! : "",
    query = (p.q || "").slice(0, 100),
    page = Math.max(1, Math.min(200, Number(p.page) || 1)),
    program = p.program || "aaPhysical",
    missing = p.missing === "yes";
  const [local, national] = await Promise.all([
    getCountyCoverage({ state, query, page, program, missing }),
    getCoverage(),
  ]);
  const link = (n: number) =>
    "/coverage?" +
    new URLSearchParams({
      state,
      q: query,
      program,
      missing: missing ? "yes" : "",
      page: String(n),
    }).toString();
  return (
    <main className="coverage-page">
      <Link className="text-link" href="/">
        Back to directory
      </Link>
      <h1>Local coverage and gaps</h1>
      <p>
        <Link href="/coverage/cities">View city and community coverage</Link>
      </p>
      <p>
        See where imported resources are available and where more local sources
        are needed. A zero means no imported listings in that category; it does
        not mean no meetings or services exist.
      </p>
      <p className="notice">
        {national.nationalOnline.toLocaleString()} global online meetings are
        available from every state and territory. They are counted separately
        from physical locations below.
      </p>
      <form className="coverage-filters" method="get">
        <label>
          State or territory
          <select name="state" defaultValue={state}>
            <option value="">All jurisdictions</option>
            {regionStates.map((s) => (
              <option key={s} value={s}>
                {stateNames[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          County, parish or equivalent
          <input name="q" defaultValue={query} maxLength={100} />
        </label>
        <label>
          Show gaps for
          <select name="program" defaultValue={program}>
            <option value="aaPhysical">In-person AA</option>
            <option value="naPhysical">In-person NA</option>
            <option value="smartPhysical">In-person SMART</option>
            <option value="providers">Providers</option>
            <option value="support">Recovery support</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="missing"
            value="yes"
            defaultChecked={missing}
          />
          Only places with no imported listings
        </label>
        <button className="primary">Update coverage</button>
      </form>
      <p>
        {local.total.toLocaleString()} counties or equivalents.{" "}
        {local.generatedAt
          ? "Counts generated " +
            new Date(local.generatedAt).toISOString().slice(0, 10) +
            "."
          : "County counts are being prepared."}
      </p>
      <div className="coverage-scroll">
        <table className="coverage-table">
          <caption>
            Physical resources by county; approximate points shown separately
          </caption>
          <thead>
            <tr>
              <th scope="col">County / equivalent</th>
              <th scope="col">State</th>
              <th scope="col">AA</th>
              <th scope="col">NA</th>
              <th scope="col">SMART</th>
              <th scope="col">Providers</th>
              <th scope="col">Support</th>
              <th scope="col">Approximate pins</th>
            </tr>
          </thead>
          <tbody>
            {local.rows.map((r: any) => (
              <tr key={r.fips}>
                <th scope="row">
                  <Link href={"/?state=" + r.state + "&county=" + r.fips}>
                    {r.name}
                  </Link>
                </th>
                <td>{r.state}</td>
                {[
                  "aaPhysical",
                  "naPhysical",
                  "smartPhysical",
                  "providers",
                  "support",
                  "approximate",
                ].map((k) => (
                  <td key={k}>
                    {r.counts
                      ? Number(r.counts[k] || 0).toLocaleString()
                      : "Pending"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!local.rows.length && (
        <p role="status">
          {local.mode === "unavailable"
            ? "Live county coverage is temporarily unavailable."
            : "No counties match these filters."}
        </p>
      )}
      <nav aria-label="County coverage pages" className="coverage-pagination">
        {page > 1 && (
          <Link className="secondary" href={link(page - 1)}>
            Previous
          </Link>
        )}
        <span>
          Page {page} of {Math.max(1, Math.ceil(local.total / 25))}
        </span>
        {page * 25 < local.total && (
          <Link className="secondary" href={link(page + 1)}>
            Next
          </Link>
        )}
      </nav>
      <h2>How to read these counts</h2>
      <p>
        Locations are assigned to Census county boundaries. ZIP and city
        centroids can fall in a different county from the actual venue;
        approximate points are flagged and may be missing from boundary counts.
        Address coordinates can be publisher supplied or Census street-range
        interpolation, which does not verify a building entrance. Online-only
        meetings have no map pin or physical county assignment.
      </p>
      <p>
        Provider registry listings do not establish licensure, current services,
        insurance participation or appointment availability. County presence
        does not establish complete city or rural coverage. American Samoa,
        Guam, the Northern Mariana Islands, Puerto Rico and the U.S. Virgin
        Islands use Census county equivalents. The Minor Outlying Islands are
        not included in this boundary file.
      </p>
      <p>
        For additional meetings, check{" "}
        <a
          href="https://www.aa.org/find-aa"
          target="_blank"
          rel="noopener noreferrer"
        >
          local AA offices
        </a>
        ,{" "}
        <a
          href="https://aa-intergroup.org/meetings/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Online Intergroup AA
        </a>{" "}
        and{" "}
        <a
          href="https://meetings.smartrecovery.org/meetings/"
          target="_blank"
          rel="noopener noreferrer"
        >
          SMART Recovery
        </a>
        . Boundary source:{" "}
        <a
          href="https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          2025 Census cartographic county boundaries
        </a>
        .
      </p>
    </main>
  );
}

import Link from "next/link";
import { getCityCoverage } from "@/lib/city-coverage";
import { regionStates, stateNames, isRegionState } from "@/lib/region";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "City coverage – Recovery Atlas",
  alternates: { canonical: "/coverage/cities" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams,
    state = isRegionState(p.state || "") ? p.state! : "",
    q = (p.q || "").slice(0, 100),
    page = Math.max(1, Math.min(3000, Number(p.page) || 1)),
    missing = p.missing === "yes",
    result = await getCityCoverage(state, q, page, missing);
  const href = (n: number) =>
    "/coverage/cities?" +
    new URLSearchParams({
      state,
      q,
      missing: missing ? "yes" : "",
      page: String(n),
    });
  return (
    <main className="coverage-page">
      <Link className="text-link" href="/coverage">
        County coverage
      </Link>
      <h1>City and community coverage</h1>
      <p>
        Counts use city names reported by publishers and public practice
        registries. Postal community names and alternate spellings may differ
        from municipal boundaries. A zero means no imported listings under that
        name; nearby resources can still be found with a radius search.
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
          City or community
          <input name="q" defaultValue={q} maxLength={100} />
        </label>
        <label className="checkbox-label">
          <input
            name="missing"
            value="yes"
            type="checkbox"
            defaultChecked={missing}
          />
          No imported in-person AA
        </label>
        <button className="primary">Update coverage</button>
      </form>
      <p>{Number(result.total).toLocaleString()} city or community names.</p>
      <div className="coverage-scroll">
        <table className="coverage-table">
          <caption>
            Imported local resources; global online meetings counted separately
          </caption>
          <thead>
            <tr>
              <th scope="col">City / community</th>
              <th scope="col">State</th>
              <th scope="col">In-person AA</th>
              <th scope="col">In-person NA</th>
              <th scope="col">SMART</th>
              <th scope="col">Providers</th>
              <th scope="col">Support</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r: any) => (
              <tr key={r.state + r.city}>
                <th scope="row">
                  <Link
                    href={
                      "/?state=" +
                      r.state +
                      "&place=" +
                      encodeURIComponent(r.name)
                    }
                  >
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
                ].map((k) => (
                  <td key={k}>{Number(r.counts[k] || 0).toLocaleString()}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!result.rows.length && (
        <p role="status">
          {result.mode === "unavailable"
            ? "City coverage is temporarily unavailable."
            : "No communities match these filters."}
        </p>
      )}
      <nav className="coverage-pagination" aria-label="City coverage pages">
        {page > 1 && (
          <Link className="secondary" href={href(page - 1)}>
            Previous
          </Link>
        )}
        <span>
          Page {page} of {Math.max(1, Math.ceil(result.total / 25))}
        </span>
        {page * 25 < result.total && (
          <Link className="secondary" href={href(page + 1)}>
            Next
          </Link>
        )}
      </nav>
      <p>
        Community names include the app’s postal-place lookup and
        source-reported places. They do not constitute a complete municipal or
        neighborhood inventory. <Link href="/">Search nearby resources</Link> or
        use <a href="https://www.aa.org/find-aa">official AA directories</a> for
        more choices.
      </p>
    </main>
  );
}

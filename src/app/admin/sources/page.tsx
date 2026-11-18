import Link from "next/link";
import { isAdmin } from "@/lib/security";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Source health – Recovery Atlas",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await isAdmin()))
    return (
      <main className="standalone">
        <h1>Administrator access required</h1>
        <Link href="/admin">Sign in</Link>
      </main>
    );
  const sql = db(),
    [jobs, geocoding, missing, runs] = await Promise.all([
      sql`SELECT id,name,url,adapter,status,last_success_at,last_attempt_at,next_run_at,last_error,record_count,enabled FROM atlas_source_job ORDER BY enabled DESC,status,name`,
      sql`SELECT status,count(*)::int AS count FROM atlas_geocode_cache GROUP BY status`,
      sql`SELECT source_id,count(*)::int AS count,min(missing_since) AS since FROM atlas_source_member WHERE missing_since IS NOT NULL GROUP BY source_id ORDER BY count(*) DESC LIMIT 30`,
      sql`SELECT source_id,status,counts,error,created_at FROM atlas_source_run ORDER BY created_at DESC LIMIT 25`,
    ]);
  return (
    <main className="coverage-page">
      <Link className="text-link" href="/admin">
        Administrator dashboard
      </Link>
      <h1>Source health and coverage jobs</h1>
      <p>
        Success and attempt dates are separate. Publisher outages preserve
        existing listings. New source facts update a matching baseline; local
        edits and unknown baselines create review proposals. Missing rows are
        tracked and do not automatically close meetings.
      </p>
      <h2>Public address enrichment</h2>
      <p>
        {geocoding
          .map((r) => r.status + ": " + r.count.toLocaleString())
          .join(" · ") || "No addresses queued yet."}
      </p>
      <p>
        Census matches are street-range interpolation. Publisher-designated
        approximate locations are excluded from enrichment.
      </p>
      <div className="coverage-scroll">
        <table className="coverage-table">
          <caption>Independent source jobs</caption>
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th>Last success</th>
              <th>Next attempt</th>
              <th>Records</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <th scope="row">
                  <a href={j.url} target="_blank" rel="noopener noreferrer">
                    {j.name}
                  </a>
                  <small>{j.adapter}</small>
                </th>
                <td>{j.enabled ? j.status : "Manual access review"}</td>
                <td>
                  {j.last_success_at
                    ? new Date(j.last_success_at).toISOString()
                    : "Not yet"}
                </td>
                <td>{new Date(j.next_run_at).toISOString()}</td>
                <td>{j.record_count ?? "Unknown"}</td>
                <td>{j.last_error || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Previously seen meetings absent from a complete capture</h2>
      {missing.map((r) => (
        <p key={r.source_id}>
          {r.source_id}: {r.count.toLocaleString()} since{" "}
          {new Date(r.since).toISOString().slice(0, 10)}
        </p>
      ))}
      <Link className="secondary" href="/admin/quality">
        Review proposed changes
      </Link>
      <h2>Recent runs</h2>
      {runs.map((r, i) => (
        <article className="peer-card" key={i}>
          <h3>
            {r.source_id} — {r.status}
          </h3>
          <p>{new Date(r.created_at).toISOString()}</p>
          <pre className="source-run">{JSON.stringify(r.counts, null, 2)}</pre>
          {r.error && <p>{r.error}</p>}
        </article>
      ))}
    </main>
  );
}

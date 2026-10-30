import Link from "next/link";
import { isAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { login, logout, reviewSubmission, importResources } from "./actions";
import { SourceDate } from "@/components/resource-detail";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Administrator · Recovery Atlas",
  robots: { index: false, follow: false },
};
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  if (!(await isAdmin()))
    return (
      <main className="standalone">
        <Link href="/" className="text-link">
          ← Back to directory
        </Link>
        <h1 style={{ marginTop: 25 }}>Directory care starts here.</h1>
        <p>Administrator access</p>
        <form action={login} className="stack">
          <label>
            Administrator password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              maxLength={200}
            />
          </label>
          {params.error ? (
            <p role="alert" className="form-error">
              {params.error === "configuration"
                ? "Administrator access is not configured."
                : params.error === "rate"
                  ? "Too many attempts. Try again in 15 minutes."
                  : "Sign-in failed. Check your password and try again."}
            </p>
          ) : null}
          <button className="primary">Sign in</button>
        </form>
        <p className="muted" style={{ marginTop: 20, fontSize: 11 }}>
          Session expires after eight hours. Public browsing never requires
          sign-in.
        </p>
      </main>
    );
  const sql = db();
  const [resources, submissions, sources, checks, runs, audit, counts] =
    await Promise.all([
      sql`SELECT id,data,published,updated_at FROM resources WHERE (${params.q ?? ""}='' OR data->>'name' ILIKE ${"%" + (params.q ?? "").slice(0, 150) + "%"} OR id=${params.q ?? ""}) ORDER BY data->>'name' LIMIT 200`,
      sql`SELECT * FROM submissions WHERE status='pending' ORDER BY created_at ASC LIMIT 50`,
      sql`SELECT * FROM sources ORDER BY name`,
      sql`SELECT DISTINCT ON (resource_id) resource_id,status,error,checked_at FROM source_checks ORDER BY resource_id,checked_at DESC`,
      sql`SELECT * FROM sync_runs ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT action,resource_id,created_at FROM audit_events ORDER BY created_at DESC LIMIT 10`,
      sql`SELECT count(*) FILTER(WHERE published) AS published,count(*) FILTER(WHERE (data->>'sourceCheckedAt')::date<current_date-90) AS stale FROM resources`,
    ]);
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <Link className="text-link" href="/">
            ← Public directory
          </Link>
          <h1 style={{ marginTop: 15 }}>A little care for the directory.</h1>
        </div>
        <div className="admin-nav">
          <Link className="secondary" href="/admin/quality">
            Quality & refresh inbox
          </Link>
          <Link className="secondary" href="/moderation">
            Community reports
          </Link>
          <Link href="/admin/export" className="secondary">
            Export listings
          </Link>
          <form action={logout}>
            <button className="secondary">Sign out</button>
          </form>
        </div>
      </header>
      {params.updated || params.imported ? (
        <p className="notice" role="status">
          {params.imported
            ? "Import complete. Existing listings were preserved."
            : "Listing updated. Public directory refreshed."}
        </p>
      ) : null}
      {params.error ? (
        <p className="form-error" role="alert">
          Import could not be completed. Check the resource schema and file
          size.
        </p>
      ) : null}
      <div className="admin-stat">
        <div>
          <strong>{Number(counts[0].published).toLocaleString()}</strong>
          <small>Published listings</small>
        </div>
        <div>
          <strong>{submissions.length}</strong>
          <small>Pending submissions</small>
        </div>
        <div>
          <strong>{Number(counts[0].stale).toLocaleString()}</strong>
          <small>Source reviews over 90 days old</small>
        </div>
        <div>
          <strong>{checks.filter((c) => c.error).length}</strong>
          <small>Links needing manual review</small>
        </div>
      </div>
      <div className="admin-grid">
        <div>
          <section className="admin-box">
            <h2>Listings</h2>
            <form method="get" className="admin-nav">
              <label className="sr-only" htmlFor="admin-resource-search">
                Find a listing by name or ID
              </label>
              <input
                id="admin-resource-search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Find a listing by name or ID"
              />
              <button className="secondary">Search</button>
            </form>
            <p className="muted">
              Showing up to 200 matching listings. Use the search to find any
              record.
            </p>
            <p className="muted" style={{ fontSize: 11 }}>
              Use “Edit” to update facts, verification dates or publication.
              Check named insurance plans against the exact service and
              location.
            </p>
            <table className="admin-list">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Source reviewed</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resources.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.data.name}
                      <br />
                      <small className="muted">
                        {r.data.city} · {r.data.kind}
                      </small>
                    </td>
                    <td>
                      <SourceDate value={r.data.sourceCheckedAt} />
                    </td>
                    <td>{r.published ? "Published" : "Hidden"}</td>
                    <td>
                      <Link
                        className="text-link"
                        href={"/admin/resource/" + r.id}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="admin-box">
            <h2>Import reviewed listings</h2>
            <p className="muted" style={{ fontSize: 12 }}>
              Paste a JSON array matching the documented schema. Imports add new
              IDs only; they never overwrite existing edits. Review sources and
              reuse requirements before publishing.
            </p>
            <form action={importResources} className="stack">
              <label>
                Resource JSON
                <textarea
                  name="json"
                  rows={7}
                  maxLength={250000}
                  required
                  placeholder="[{ … }]"
                />
              </label>
              <button className="primary">
                Validate & import new listings
              </button>
            </form>
          </section>
        </div>
        <aside>
          <section className="admin-box">
            <h2>Review inbox</h2>
            {!submissions.length ? (
              <p className="muted">No pending submissions.</p>
            ) : (
              submissions.map((s) => (
                <div className="admin-review" key={s.id}>
                  <strong>
                    {s.kind === "new"
                      ? "New resource"
                      : (resources.find((r) => r.id === s.resource_id)?.data
                          .name ?? s.resource_id)}
                  </strong>
                  <p>{s.message}</p>
                  {/^https:\/\//.test(s.source_url) ? (
                    <a
                      className="text-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={s.source_url}
                    >
                      Submitted source ↗
                    </a>
                  ) : null}
                  <p className="muted" style={{ fontSize: 10 }}>
                    Check the source, edit the listing separately, then mark
                    this submission reviewed.
                  </p>
                  <form action={reviewSubmission}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      className="secondary"
                      name="status"
                      value="reviewed"
                    >
                      Mark reviewed
                    </button>
                    <button
                      className="secondary"
                      name="status"
                      value="dismissed"
                    >
                      Dismiss
                    </button>
                  </form>
                </div>
              ))
            )}
          </section>
          <section className="admin-box">
            <h2>Source connections</h2>
            {sources.map((s) => (
              <div className="admin-review" key={s.id}>
                <a
                  className="text-link"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.name} ↗
                </a>
                <p style={{ fontSize: 10 }}>{s.access_status}</p>
                <p className="muted" style={{ fontSize: 11 }}>
                  {s.notes}
                </p>
              </div>
            ))}
          </section>
          <section className="admin-box">
            <h2>Recent maintenance</h2>
            {runs.length ? (
              runs.map((r) => (
                <p key={r.id} style={{ fontSize: 11 }}>
                  {r.source} · {r.status}
                  <br />
                  {new Date(r.created_at).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}{" "}
                  ET
                </p>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 11 }}>
                Daily source link checks will appear here. They do not verify
                service availability.
              </p>
            )}
            <h3 style={{ fontSize: 13 }}>Recent edits</h3>
            {audit.length ? (
              audit.map((a, i) => (
                <p key={i} style={{ fontSize: 10 }}>
                  {a.action} · {a.resource_id}
                </p>
              ))
            ) : (
              <p className="muted" style={{ fontSize: 11 }}>
                No administrator edits yet.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

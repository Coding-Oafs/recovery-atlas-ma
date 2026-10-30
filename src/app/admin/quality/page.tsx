import Link from "next/link";
import { isAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { reviewQuality } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Directory quality · Recovery Atlas",
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
    [claims, proposals, runs, counts, duplicates] = await Promise.all([
      sql`SELECT c.*,r.resource_name AS name,u.username FROM atlas_provider_claim c JOIN resources r ON r.id=c.resource_id JOIN atlas_user u ON u.id=c.user_id WHERE c.status='pending' ORDER BY c.created_at LIMIT 50`,
      sql`SELECT p.*,r.resource_name AS name FROM atlas_quality_proposal p JOIN resources r ON r.id=p.resource_id WHERE p.status IN ('pending','conflict') ORDER BY p.created_at LIMIT 100`,
      sql`SELECT source,status,details,created_at FROM sync_runs ORDER BY created_at DESC LIMIT 15`,
      sql`SELECT count(*) FILTER(WHERE (data->>'sourceCheckedAt')::date<current_date-CASE WHEN resource_kind='meeting' THEN 30 ELSE 90 END)::int AS stale FROM resources WHERE published`,
      sql`SELECT resource_name,data->>'address' AS address,data->>'state' AS state,count(*)::int AS listings,array_agg(id) AS ids FROM resources WHERE published AND data->>'address'<>'' GROUP BY resource_name,data->>'address',data->>'state' HAVING count(*)>1 ORDER BY count(*) DESC LIMIT 20`,
    ]);
  return (
    <main className="community-page">
      <Link className="text-link" href="/admin">
        ← Administrator dashboard
      </Link>
      <h1>Directory quality</h1>
      <p className="notice">
        {counts[0].stale.toLocaleString()} listings are due for source review.
        Source observation, direct confirmation and professional license checks
        are separate facts.
      </p>
      <h2>Organization access requests</h2>
      {claims.length ? (
        claims.map((c) => (
          <article className="peer-card stack" key={c.id}>
            <h3>{c.name}</h3>
            <p>
              Account @{c.username} · role: {c.role}
            </p>
            <p>{c.notes}</p>
            <a href={c.evidence_url} target="_blank" rel="noopener noreferrer">
              Submitted evidence page
            </a>
            <p className="notice">
              Confirm the person’s role through an independently obtained
              official organization contact before approving.
            </p>
            <form action={reviewQuality} className="saved-tool-buttons">
              <input type="hidden" name="kind" value="claim" />
              <input type="hidden" name="id" value={c.id} />
              <button className="secondary" name="action" value="approve">
                Approve verified update access
              </button>
              <button className="secondary" name="action" value="dismiss">
                Dismiss
              </button>
            </form>
          </article>
        ))
      ) : (
        <p>No pending access requests.</p>
      )}
      <h2>Proposed listing changes</h2>
      {proposals.length ? (
        proposals.map((p) => (
          <article className="peer-card stack" key={p.id}>
            <h3>{p.name}</h3>
            {p.status === "conflict" ? (
              <p className="notice" role="status">
                The current listing changed after this proposal. Open the full
                listing to compare and make a reviewed manual edit, then dismiss
                this obsolete proposal.
              </p>
            ) : null}
            <p>
              {p.source} · {p.reason}
            </p>
            <details>
              <summary>Review proposed fields</summary>
              <dl>
                {Object.keys(p.proposal)
                  .filter(
                    (k) =>
                      JSON.stringify(p.proposal[k]) !==
                      JSON.stringify(p.before_data?.[k]),
                  )
                  .map((k) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        <p>Current: {JSON.stringify(p.before_data?.[k])}</p>
                        <p>Proposed: {JSON.stringify(p.proposal[k])}</p>
                      </dd>
                    </div>
                  ))}
              </dl>
            </details>
            <form action={reviewQuality} className="saved-tool-buttons">
              <input type="hidden" name="kind" value="proposal" />
              <input type="hidden" name="id" value={p.id} />
              <button
                className="secondary"
                name="action"
                value="approve"
                disabled={p.status === "conflict"}
              >
                Approve reviewed changes
              </button>
              <button className="secondary" name="action" value="dismiss">
                Dismiss
              </button>
            </form>
            <Link
              className="text-link"
              href={"/admin/resource/" + p.resource_id}
            >
              Open full listing
            </Link>
          </article>
        ))
      ) : (
        <p>No pending listing changes.</p>
      )}
      <h2>Possible duplicate listings</h2>
      <p>
        These share the exact name and address. Review source identities and
        programs before changing anything; separate meetings and clinicians can
        share an address.
      </p>
      {duplicates.map((d, i) => (
        <details className="peer-card" key={i}>
          <summary>
            {d.resource_name} · {d.listings} listings
          </summary>
          <p>
            {d.address} · {d.state}
          </p>
          {d.ids.map((id: string) => (
            <p key={id}>
              <Link href={"/admin/resource/" + id}>{id}</Link>
            </p>
          ))}
        </details>
      ))}
      <h2>Refresh and maintenance history</h2>
      {runs.map((r, i) => (
        <details className="peer-card" key={i}>
          <summary>
            {r.source} · {r.status} · {new Date(r.created_at).toLocaleString()}
          </summary>
          <pre className="wrapped-pre">
            {JSON.stringify(r.details, null, 2)}
          </pre>
        </details>
      ))}
    </main>
  );
}

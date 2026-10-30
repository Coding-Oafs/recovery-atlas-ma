import Link from "next/link";
import { moderator } from "@/lib/moderator";
import { db } from "@/lib/db";
import { decryptPrivate } from "@/lib/community";
import { moderateReport, reinstateMember } from "./actions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Moderation � Recovery Atlas",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const actor = await moderator();
  if (!actor)
    return (
      <main className="standalone">
        <h1>Moderator access</h1>
        <p>Sign in with an account that has been granted moderator access.</p>
        <Link className="primary" href="/account">
          Sign in
        </Link>
        <Link className="text-link" href="/">
          Back to resources
        </Link>
      </main>
    );
  const sql = db(),
    [reports, suspended, audit] = await Promise.all([
      sql`SELECT r.id,r.reason,r.evidence_encrypted,r.created_at,p.handle AS subject,u.handle AS reporter FROM atlas_community_report r LEFT JOIN atlas_profile p ON p.user_id=r.subject_id LEFT JOIN atlas_profile u ON u.user_id=r.reporter_id WHERE r.status='pending' ORDER BY r.created_at LIMIT 100`,
      sql`SELECT user_id,handle,display_name FROM atlas_profile WHERE suspended ORDER BY updated_at DESC LIMIT 100`,
      sql`SELECT action,created_at,after_data->>'actor' AS actor FROM audit_events WHERE action IN ('community-moderation','community-reinstate') ORDER BY created_at DESC LIMIT 30`,
    ]);
  return (
    <main className="community-page">
      <Link className="text-link" href="/community">
        ? Community
      </Link>
      <h1>Moderation inbox</h1>
      <p>
        Review reported content only. Protect private information, document
        action through these controls, and use urgent professional resources for
        emergencies.
      </p>
      <h2>Pending reports ({reports.length})</h2>
      {reports.length ? (
        reports.map((r) => {
          let evidence: { message: string; sentAt: string } | null = null;
          try {
            evidence = JSON.parse(decryptPrivate(r.evidence_encrypted));
          } catch {}
          return (
            <article className="peer-card stack" key={r.id}>
              <p>
                <strong>@{r.subject ?? "deleted member"}</strong> � reported by
                @{r.reporter ?? "deleted member"} �{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
              <p>Reason: {r.reason}</p>
              <blockquote className="reported-message">
                {evidence?.message ?? "Evidence unavailable"}
              </blockquote>
              <p className="small muted">
                Sent{" "}
                {evidence
                  ? new Date(evidence.sentAt).toLocaleString()
                  : "unknown"}
              </p>
              <form action={moderateReport} className="saved-tool-buttons">
                <input type="hidden" name="id" value={r.id} />
                <button className="secondary" name="action" value="reviewed">
                  Mark reviewed
                </button>
                <button className="secondary" name="action" value="dismissed">
                  Dismiss report
                </button>
                <button className="secondary" name="action" value="suspend">
                  Review & pause member
                </button>
              </form>
            </article>
          );
        })
      ) : (
        <p>No pending reports.</p>
      )}
      <h2>Paused members</h2>
      {suspended.length ? (
        suspended.map((p) => (
          <form
            action={reinstateMember}
            className="peer-card inline-form"
            key={p.user_id}
          >
            <p>
              {p.display_name} @{p.handle}
            </p>
            <input type="hidden" name="id" value={p.user_id} />
            <button className="secondary">Restore community access</button>
          </form>
        ))
      ) : (
        <p>No members are paused.</p>
      )}
      <h2>Recent moderation actions</h2>
      <ul>
        {audit.map((a, i) => (
          <li key={i}>
            {a.action} � {new Date(a.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </main>
  );
}

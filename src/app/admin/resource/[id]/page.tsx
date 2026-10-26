import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/security";
import { db } from "@/lib/db";
import { saveResource } from "../../actions";
import AdminResourceFields from "@/components/admin-resource-fields";
import { regionStates, stateNames } from "@/lib/region";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Edit resource · Recovery Atlas",
  robots: { index: false, follow: false },
};
export default async function Edit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const rows = await db()`SELECT data,published FROM resources WHERE id=${id}`;
  if (!rows.length) notFound();
  const r = rows[0].data;
  const textFields: [string, string][] = [
    ["name", "Name"],
    ["address", "Street address"],
    ["city", "City"],
    ["zip", "ZIP"],
    ["phone", "Phone"],
    ["website", "Official website"],
    ["hours", "Published hours"],
    ["availability", "Current availability statement"],
    ["sourceUrl", "Source website"],
    ["sourceName", "Source name"],
    ["sourceCheckedAt", "Source review date (YYYY-MM-DD)"],
    ["verifiedAt", "Direct verification date (leave blank unless contacted)"],
    ["lat", "Latitude"],
    ["lng", "Longitude"],
    ["services", "Services (comma-separated)"],
    ["languages", "Languages (comma-separated)"],
    ["accessibility", "Accessibility (comma-separated)"],
    ["populations", "Participants (comma-separated)"],
    ["payment", "Payment categories (comma-separated)"],
  ];
  return (
    <main className="admin-shell">
      <Link href="/admin" className="text-link">
        ← Administrator dashboard
      </Link>
      <h1 style={{ marginTop: 25 }}>Edit {r.name}</h1>
      <p className="notice">
        A source review date records when you checked published information. Set
        direct verification only after contacting the provider or group.
        Coordinates must match the street location; use approximate if
        uncertain.
      </p>
      <form action={saveResource} className="admin-box admin-fields">
        <input type="hidden" name="id" value={id} />
        <label>
          State
          <select name="state" defaultValue={r.state}>
            {regionStates.map((s) => (
              <option key={s} value={s}>
                {stateNames[s]}
              </option>
            ))}
          </select>
        </label>
        {textFields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              defaultValue={
                Array.isArray(r[key]) ? r[key].join(", ") : (r[key] ?? "")
              }
              required={[
                "name",
                "website",
                "sourceUrl",
                "sourceName",
                "sourceCheckedAt",
              ].includes(key)}
              maxLength={key === "name" ? 220 : 2000}
            />
          </label>
        ))}
        <label>
          Map precision
          <select name="coordinateAccuracy" defaultValue={r.coordinateAccuracy}>
            <option value="address">Address matched</option>
            <option value="approximate">Approximate area</option>
            <option value="unavailable">Not available</option>
          </select>
        </label>
        {[
          ["description", "Description"],
          ["intake", "Intake & access"],
          ["paymentNote", "Insurance & payment notes"],
        ].map(([key, label]) => (
          <label className="full" key={key}>
            {label}
            <textarea name={key} defaultValue={r[key]} rows={4} required />
          </label>
        ))}
        <label className="checkbox-label full">
          <input
            type="checkbox"
            name="published"
            defaultChecked={rows[0].published}
          />
          Published in public directory
        </label>
        <AdminResourceFields resource={r} />
        <button className="primary full">Save listing & record change</button>
      </form>
    </main>
  );
}

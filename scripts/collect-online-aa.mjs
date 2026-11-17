import { writeFile, mkdir } from "node:fs/promises";
/** Public service used by the Online Intergroup client. Default response is ONLY one hour. */
export async function collectOnlineAA(root) {
  const rows = new Map();
  let requests = 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  async function window(from, hours) {
    const url = new URL(
      "https://central-query.apps.code4recovery.org/api/v1/meetings",
    );
    url.search = new URLSearchParams({
      start: from.toISOString(),
      hours: String(hours),
      limit: "1000",
    }).toString();
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    requests++;
    if (!r.ok) throw Error("Online Intergroup HTTP " + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw Error("Changed online directory structure");
    if (data.length === 1000) {
      if (hours <= 1)
        throw Error("Online source limit reached; incomplete import");
      await window(from, hours / 2);
      await window(new Date(+from + (hours / 2) * 3600000), hours / 2);
      return;
    }
    for (const m of data) if (m.slug) rows.set(m.slug, m);
  }
  for (let hour = 0; hour < 168; hour += 6)
    await window(new Date(+start + hour * 3600000), 6);
  await mkdir(root + "/.local/national-meetings", { recursive: true });
  await writeFile(
    root + "/.local/national-meetings/oiaa.json",
    JSON.stringify([...rows.values()]),
  );
  return {
    records: rows.size,
    requests,
    source: "https://aa-intergroup.org/meetings/",
  };
}

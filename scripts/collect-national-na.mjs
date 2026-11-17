import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
// Third-party finders must use this daily static export, not the live BMLT aggregator API.
export async function collectNationalNA(root) {
  const dir = root + "/.local/coverage-fix";
  await mkdir(dir, { recursive: true });
  const manifestResponse = await fetch(
    "https://cdn.aws.bmlt.app/aggregator/manifest.json",
    { signal: AbortSignal.timeout(20000) },
  );
  if (!manifestResponse.ok)
    throw Error("NA export manifest HTTP " + manifestResponse.status);
  const manifest = await manifestResponse.json();
  if (
    !manifest.generated_at ||
    Date.now() - Date.parse(manifest.generated_at) > 2 * 86400000
  )
    throw Error("NA export is stale");
  const r = await fetch(
    "https://cdn.aws.bmlt.app/aggregator/meetings.ndjson.gz",
    { signal: AbortSignal.timeout(30000) },
  );
  if (!r.ok) throw Error("NA export HTTP " + r.status);
  const bytes = Buffer.from(await r.arrayBuffer()),
    hash = createHash("sha256").update(bytes).digest("hex");
  if (!JSON.stringify(manifest).includes(hash))
    throw Error("NA export checksum mismatch");
  await writeFile(dir + "/na-export.gz", bytes);
  await writeFile(dir + "/na-manifest.json", JSON.stringify(manifest, null, 2));
  return {
    generatedAt: manifest.generated_at,
    sha256: hash,
    bytes: bytes.length,
  };
}

import { readFile, writeFile } from "node:fs/promises";
export async function stageMeetingRelease({
  sql,
  install,
  file,
  progressFile,
  resultFile,
}) {
  const jobs = JSON.parse(await readFile(file, "utf8")),
    summary = [];
  for (const job of jobs) {
    const s = job.source;
    try {
      await sql.query(
        "INSERT INTO atlas_source_job(id,name,url,adapter,config)VALUES($1,$2,$3,$4,$5::jsonb)ON CONFLICT DO NOTHING",
        [
          s.id,
          s.fellowship + " / " + new URL(s.page).hostname,
          s.feed || s.page,
          s.adapter,
          JSON.stringify(s),
        ],
      );
      summary.push({
        id: s.id,
        ...(await install(
          sql,
          s.id,
          [...new Map(job.rows.map((r) => [r.id, r])).values()],
          {
            publish: false,
            release: "local-meetings-20261117",
            complete: true,
          },
        )),
      });
    } catch (e) {
      summary.push({ id: s.id, error: e.message });
    }
    await writeFile(progressFile, JSON.stringify(summary, null, 2));
  }
  await sql.query(
    "UPDATE atlas_import_release SET status='staged',details=$1::jsonb WHERE id='local-meetings-20261117'",
    [JSON.stringify(summary)],
  );
  const result = {
    sources: summary.length,
    errors: summary.filter((s) => s.error),
    queued: summary.reduce((n, s) => n + (s.queued || 0), 0),
  };
  await writeFile(resultFile, JSON.stringify(result));
  return result;
}

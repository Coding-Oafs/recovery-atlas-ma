import { NextRequest, NextResponse } from "next/server";
import { equal } from "@/lib/security";
import { db } from "@/lib/db";
import { runProviderJob } from "@/lib/provider-jobs";
import { retryHours } from "@/lib/source-pipeline-core";
import { revalidateTag } from "next/cache";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !equal(
      request.headers.get("authorization") || "",
      "Bearer " + process.env.CRON_SECRET,
    )
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sql = db();
  const [job] = await sql.query(
    `WITH due AS(SELECT id FROM atlas_source_job WHERE enabled AND adapter='nppes-weekly' AND next_run_at<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY url,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE atlas_source_job s SET status='running',lease_until=now()+interval '15 minutes',last_attempt_at=now() FROM due WHERE due.id=s.id RETURNING s.*`,
  );
  if (!job) return NextResponse.json({ status: "nothing-due" });
  try {
    const result = await runProviderJob(sql, job as any);
    await sql.query(
      "UPDATE atlas_source_job SET status='healthy',last_success_at=now(),attempts=0,last_error=NULL,lease_until=NULL,next_run_at=now()+interval '10 years' WHERE id=$1",
      [job.id],
    );
    await sql.query(
      "INSERT INTO atlas_source_run(source_id,status,counts)VALUES($1,'completed',$2::jsonb)",
      [job.id, JSON.stringify(result)],
    );
    revalidateTag("resources", "max");
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Provider update unavailable";
    await sql.query(
      "UPDATE atlas_source_job SET status='needs-review',last_error=$2,attempts=attempts+1,lease_until=NULL,next_run_at=now()+make_interval(hours=>$3::int) WHERE id=$1",
      [job.id, message, retryHours(job.attempts + 1)],
    );
    return NextResponse.json(
      { error: "Weekly provider update held for review" },
      { status: 503 },
    );
  }
}

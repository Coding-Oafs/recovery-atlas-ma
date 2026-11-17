import { NextRequest, NextResponse } from "next/server";
import { equal } from "@/lib/security";
import { db } from "@/lib/db";
import {
  seedAddressQueue,
  runGeocodingBatch,
  applyGeocodedAddresses,
} from "@/lib/location-jobs";
import { refreshCountyCoverage } from "@/lib/refresh-county-coverage";
import { refreshCityCoverage } from "@/lib/refresh-city-coverage";
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
  await sql.query(
    "INSERT INTO atlas_source_job(id,name,url,adapter,interval_hours)VALUES('public-location-enrichment','Public address and county enrichment','https://geocoding.geo.census.gov/geocoder/','census-batch',8)ON CONFLICT DO NOTHING",
  );
  const [job] = await sql.query(
    "UPDATE atlas_source_job SET status='running',lease_until=now()+interval '15 minutes',last_attempt_at=now() WHERE id='public-location-enrichment' AND (lease_until IS NULL OR lease_until<now()) RETURNING config",
  );
  if (!job) return NextResponse.json({ status: "already-running" });
  try {
    const seeded = await seedAddressQueue(sql, job.config.cursor || ""),
      cached = await applyGeocodedAddresses(sql),
      geocoding = await runGeocodingBatch(sql, 10000),
      county = await refreshCountyCoverage(sql, 50000, false);

    const result = { seeded, cached, geocoding, county };
    await sql.query(
      "UPDATE atlas_source_job SET config=jsonb_set(config,'{cursor}',to_jsonb($1::text)),status='healthy',attempts=0,lease_until=NULL,last_success_at=now(),last_error=NULL,next_run_at=now()+interval '8 hours' WHERE id='public-location-enrichment'",
      [seeded.cursor],
    );
    await sql.query(
      "INSERT INTO atlas_source_run(source_id,status,counts)VALUES('public-location-enrichment','completed',$1::jsonb)",
      [JSON.stringify(result)],
    );
    revalidateTag("resources", "max");
    return NextResponse.json(result);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Location enrichment unavailable";
    await sql.query(
      "UPDATE atlas_source_job SET status='needs-review',last_error=$1,attempts=attempts+1,lease_until=NULL,next_run_at=now()+interval '8 hours' WHERE id='public-location-enrichment'",
      [message],
    );
    return NextResponse.json(
      { error: "Location enrichment held for retry" },
      { status: 503 },
    );
  }
}

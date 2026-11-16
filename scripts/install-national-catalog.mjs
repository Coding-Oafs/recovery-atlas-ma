import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {neon} from "@neondatabase/serverless";
if(!process.env.DATABASE_URL){console.log("No database configured; using bundled public catalog.");process.exit(0);}
const manifest=JSON.parse(readFileSync("data/national-manifest.json","utf8"));
if(!manifest.generatedAt||manifest.total<10000)throw Error("National catalog must be generated and checked before a database release.");
const rows=JSON.parse(gunzipSync(readFileSync("data/national-catalog.json.gz")).toString("utf8"));
if(rows.length!==manifest.total||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error("National catalog manifest mismatch");
const sql=neon(process.env.DATABASE_URL);
let inserted=0;
for(let i=0;i<rows.length;i+=250){
 const batch=rows.slice(i,i+250);
 const added=await sql`INSERT INTO resources(id,data,location,published)
 SELECT r->>'id',r,CASE WHEN r->>'lat' IS NULL OR r->>'lng' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,true
 FROM jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
 ON CONFLICT(id) DO NOTHING RETURNING id`;
 inserted+=added.length;
}
if(inserted)await sql`INSERT INTO sync_runs(source,status,details) VALUES('national-annual-catalog','completed',${JSON.stringify({inserted,directoryYear:manifest.directoryYear,surveyYear:manifest.surveyYear,generatedAt:manifest.generatedAt,note:"Insert-only public annual-source facts. Existing records and publication decisions preserved."})}::jsonb)`;
console.log(JSON.stringify({catalog:rows.length,inserted,existingPreserved:rows.length-inserted}));

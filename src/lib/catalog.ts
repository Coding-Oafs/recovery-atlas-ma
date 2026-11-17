import "server-only";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import seed from "../../data/resources.json";
import type { Resource } from "./types";
let cached:Resource[]|undefined;
export function bundledResources():Resource[] {
 if(cached) return cached;
 let national:Resource[]=[];
 try { national=JSON.parse(gunzipSync(readFileSync(path.join(process.cwd(),"data/national-catalog.json.gz"))).toString("utf8")); }
 catch(error) { if((error as NodeJS.ErrnoException).code!=="ENOENT") throw error; }
 // Curated originals retain priority over an imported record with the same ID.
 const rows=new Map(national.map(r=>[r.id,r]));
 for(const r of seed) rows.set(r.id,r as Resource);
 return cached=[...rows.values()];
}

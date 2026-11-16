import {readFile} from "node:fs/promises";
import {gunzipSync} from "node:zlib";
const curated=JSON.parse(await readFile("data/resources.json","utf8"));
let national=[];try{national=JSON.parse(gunzipSync(await readFile("data/national-catalog.json.gz")).toString("utf8"));}catch(e){if(e.code!=="ENOENT")throw e;}
const manifest=JSON.parse(await readFile("data/national-manifest.json","utf8"));
if(manifest.total!==national.length)throw Error("National manifest mismatch");
for(const group of [curated,national]){
 const ids=new Set();
 for(const r of group){
  if(ids.has(r.id))throw Error("Duplicate ID "+r.id);ids.add(r.id);
  if(!r.sourceUrl.startsWith("https://"))throw Error("Missing source "+r.id);
  if((r.lat===null)!==(r.lng===null))throw Error("Coordinate pair "+r.id);
  if(r.lat!==null&&(!Number.isFinite(r.lat)||!Number.isFinite(r.lng)||Math.abs(r.lat)>85||Math.abs(r.lng)>180))throw Error("Invalid coordinates "+r.id);
  if(r.kind==="meeting"&&r.formats.includes("online")&&!r.formats.includes("hybrid")&&r.lat!==null)throw Error("Online pin "+r.id);
 }
}
console.log(JSON.stringify({curated:curated.length,national:national.length,jurisdictions:manifest.jurisdictions},null,2));

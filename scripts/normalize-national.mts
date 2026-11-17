import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync,gzipSync} from "node:zlib";
import {createHash} from "node:crypto";
import zipcodes from "zipcodes";
import {resourceSchema,type Resource} from "../src/lib/types";
import {regionStates,isRegionState,territoryPlaces,stateNames} from "../src/lib/region";
const today=new Date().toISOString().slice(0,10);
const clean=(v:unknown)=>String(v??"").replace(/\s+/g," ").trim();
const hash=(s:string)=>createHash("sha256").update(s.toLowerCase().replace(/[^a-z0-9]/g,"")).digest("hex").slice(0,20);
const services:Record<string,string>={SA:"Substance use treatment",DT:"Detox / withdrawal management",MH:"Mental-health treatment",SUMH:"Co-occurring substance use and mental-health treatment",HI:"Hospital inpatient services",OP:"Outpatient care",RES:"Residential treatment",HID:"Hospital inpatient detoxification",OD:"Outpatient detoxification",IOP:"Intensive outpatient care",PHP:"Partial hospitalization / day treatment",RL:"Long-term residential treatment",RS:"Short-term residential treatment",OTP:"Opioid treatment program",MM:"Methadone maintenance",BUM:"Buprenorphine maintenance",NXN:"Naltrexone treatment",HH:"Transitional recovery housing",CMHC:"Community mental health center",PSY:"Psychiatric hospital",SHP:"State psychiatric hospital",IPSY:"Hospital psychiatric unit",TELE:"Telehealth counseling",PEER:"Peer support",DBT:"Dialectical behavior therapy",CBT:"Cognitive behavioral therapy"};
const payments:Record<string,string>={MC:"Medicare",MD:"Medicaid",TRICARE:"TRICARE",PI:"Private insurance (plan not specified)",CASH:"Self-pay",SS:"Sliding scale",PA:"Payment assistance"};
const records=new Map<string,Resource>();const excluded:Record<string,number>={};
for(const kind of ["su","mh"]){
 const rows=JSON.parse(gunzipSync(readFileSync(".local/national/"+kind+".json.gz")).toString("utf8"));
 for(const p of rows){
  const state=clean(p.state).toUpperCase();
  if(!isRegionState(state)){excluded[state]=(excluded[state]??0)+1;continue;}
  const codes=new Set<string>(clean(p.service_code_info).split(/[\s*]+/));
  const key=hash([p.name1,p.name2,p.street1,p.city,p.state].join("|"));
  const id="samhsa-2025-"+key,old=records.get(id);
  const zip=clean(p.zip).split(".")[0].padStart(5,"0");
  const postal=zipcodes.lookup(zip);
  // A ZIP centroid is approximate; never substitute a territory capital for a facility.
  const location=postal?.state===state?postal:undefined;
  const sourceUrl=kind==="su"?"https://www.samhsa.gov/data/report/2025-national-directory-drug-and-alcohol-use-treatment":"https://www.samhsa.gov/data/report/2025-national-directory-mental-health-treatment-facilit";
  const r:Resource={
   id,name:[clean(p.name1),clean(p.name2)].filter(Boolean).join(" — ").slice(0,220),
   kind:codes.has("SHP")||codes.has("PSY")||codes.has("HI")?"hospital":kind==="su"?"treatment":"clinic",
   categories:[...(kind==="su"||codes.has("SA")?["treatment" as const]:[]),...(kind==="mh"||codes.has("MH")||codes.has("SUMH")?["mental-health" as const]:[])],
   address:[clean(p.street1),clean(p.street2),clean(p.city)+", "+state+" "+zip].filter(Boolean).join(", ").slice(0,300),
   city:clean(p.city),state,country:"US",zip:/^\d{5}$/.test(zip)?zip:"",postalCode:zip,
   lat:location?.latitude??null,lng:location?.longitude??null,coordinateAccuracy:location?"approximate":"unavailable",
   phone:clean(p.intake1||p.phone).slice(0,70),website:sourceUrl,sourceUrl,
   sourceName:"SAMHSA 2025 national facility directories",sourceCheckedAt:today,sourceUpdatedAt:null,verifiedAt:null,
   description:"Facility reported in SAMHSA’s 2025 directory, based on the 2024 facility survey. Confirm current services, eligibility, location and payment directly.",
   services:Object.entries(services).filter(([c])=>codes.has(c)).map(([,v])=>v),
   formats:codes.has("TELE")?["in-person","telehealth"]:["in-person"],fellowship:null,
   languages:codes.has("SP")?["Spanish"]:[],accessibility:codes.has("ASL")?["Sign language services"]:[],
   populations:[],hours:"Not reported; confirm with provider.",intake:"Contact the published intake number to confirm current services, referral requirements, eligibility and availability.",
   payment:Object.entries(payments).filter(([c])=>codes.has(c)).map(([,v])=>v),insurance:[],
   paymentNote:"Broad payment categories are facility-reported in the 2024 survey. Exact insurance plans, network participation, costs and authorization are not confirmed.",
   meeting:null,availability:"Not reported",
   practical:{walkIn:"unknown",referral:"unknown",minimumAge:null,maximumAge:null,transit:"",entrance:"",childcare:"unknown",newcomers:"",notes:""}
  };
  if(old){r.categories=[...new Set([...old.categories,...r.categories])];r.services=[...new Set([...old.services,...r.services])].slice(0,30);r.payment=[...new Set([...old.payment,...r.payment])];}
  resourceSchema.parse(r);records.set(id,r);
 }
}
const rows=[...records.values()].sort((a,b)=>a.id.localeCompare(b.id));
if(rows.length<10000)throw Error("Incomplete national source; review before release.");
writeFileSync("data/national-catalog.json.gz",gzipSync(JSON.stringify(rows),{level:9}));
const sources=JSON.parse(readFileSync(".local/national/sources.json","utf8"));
const manifest={generatedAt:today,surveyYear:2024,directoryYear:2025,total:rows.length,mapped:rows.filter(r=>r.lat!==null).length,sources,excludedJurisdictions:excluded,
 jurisdictions:regionStates.map(state=>({state,name:stateNames[state],listings:rows.filter(r=>r.state===state).length,mapped:rows.filter(r=>r.state===state&&r.lat!==null).length,meetings:0,status:rows.some(r=>r.state===state)?"annual-facility-data":"no-imported-facility-data"})),
 limitations:["Annual facility survey, not current openings or network verification.","Meeting coverage remains source-dependent; national official meeting directories are linked.","ZIP centroids are approximate; facilities without supported postal coordinates remain searchable without pins.","Selecting a jurisdiction does not imply complete coverage."]};
writeFileSync("data/national-manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log(JSON.stringify(manifest,null,2));

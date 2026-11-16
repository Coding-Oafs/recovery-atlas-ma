import type { Resource, Filters } from "./types";
export function unreportedFields(r: Resource, f: Filters): string[] {
 const missing:string[]=[];
 if(f.payment && !r.payment.length && !r.insurance.length) missing.push("Payment");
 if(f.language && !r.languages.length) missing.push("Language");
 if(f.accessibility && !r.accessibility.length) missing.push("Accessibility");
 return missing;
}
export function matchesEvidence(r: Resource, f: Filters): boolean {
 const payment=!f.payment || r.payment.includes(f.payment) || r.insurance.some(i=>i.name===f.payment);
 const language=!f.language || r.languages.includes(f.language);
 const access=!f.accessibility || r.accessibility.includes("Wheelchair access");
 if(!f.uncertainOnly) return payment && language && access;
 // Unknown is a separate opt-in result set. Known non-matches stay excluded.
 return unreportedFields(r,f).length>0
  && (payment || (!r.payment.length && !r.insurance.length))
  && (language || !r.languages.length)
  && (access || !r.accessibility.length);
}

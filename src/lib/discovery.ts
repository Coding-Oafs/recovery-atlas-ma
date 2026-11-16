import type { Filters } from "./types";
export function searchAlternatives(f:Filters) {
 const result:{id:string;label:string;filters:Filters}[]=[];
 if(f.center && f.radius<200) result.push({id:"radius",label:"Expand search radius",filters:{...f,radius:Math.min(200,f.radius<50?50:f.radius*2)}});
 if(f.soon || f.meetingWindow || f.day!=="" || f.startAfter || f.startBefore) result.push({id:"week",label:"Search the next seven days",filters:{...f,soon:false,meetingWindow:"7days",meetingDate:"",day:"",startAfter:"",startBefore:""}});
 if(f.category==="meetings" && f.format!=="online")result.push({id:"online",label:"Find online meetings",filters:{...f,format:"online",center:null,bounds:null}});
 if(f.payment || f.language || f.accessibility)result.push({id:"unknown",label:f.uncertainOnly?"Return to documented matches":"Show listings with unreported details",filters:{...f,uncertainOnly:!f.uncertainOnly}});
 if(f.query)result.push({id:"keyword",label:"Search without these keywords",filters:{...f,query:""}});
 return result.slice(0,5);
}

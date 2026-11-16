import type { Resource, Filters } from "./types";
import { filterResources } from "./search";
export function catalogQuery(all:Resource[], f:Filters, saved:string[], limit:number, options:{
 map?:{bounds:number[];zoom:number}; selection?:{bounds:number[];offset:number};offset?:number;asOf?:string;
}={}) {
 let rows=filterResources(all,f,saved,options.asOf?new Date(options.asOf):new Date());
 const view=options.map?.bounds ?? options.selection?.bounds;
 if(view) {const [w,s,e,n]=view;rows=rows.filter(r=>r.lng!==null&&r.lat!==null&&r.lng>=w&&r.lng<=e&&r.lat>=s&&r.lat<=n);}
 if(options.map) {
  const zoom=Math.floor(options.map.zoom), size=40075016.68557849/2**zoom*(zoom>=14?12:55)/512;
  const cells=new Map<string,{id:string;kind:string;lat:number;lng:number;count:number;bounds:number[]}>();
  for(const r of rows) {
   if(r.lat===null||r.lng===null)continue;
   const x=6378137*r.lng*Math.PI/180,y=6378137*Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,r.lat))*Math.PI/360));
   const key=Math.round(x/size)+":"+Math.round(y/size), old=cells.get(key);
   if(old){ old.lat=(old.lat*old.count+r.lat)/(old.count+1);old.lng=(old.lng*old.count+r.lng)/(old.count+1);old.count++;old.id="group-"+key;old.kind="cluster";old.bounds=[Math.min(old.bounds[0],r.lng-1e-7),Math.min(old.bounds[1],r.lat-1e-7),Math.max(old.bounds[2],r.lng+1e-7),Math.max(old.bounds[3],r.lat+1e-7)]; }
   else cells.set(key,{id:r.id,kind:r.kind,lat:r.lat,lng:r.lng,count:1,bounds:[r.lng-1e-7,r.lat-1e-7,r.lng+1e-7,r.lat+1e-7]});
  }
  return {pins:[...cells.values()],represented:rows.filter(r=>r.lat!==null).length};
 }
 const offset=options.selection?.offset??options.offset??0;
 return {resources:rows.slice(offset,offset+limit),total:rows.length,mapped:rows.filter(r=>r.lat!==null).length,online_or_unmapped:rows.filter(r=>r.lat===null).length,sourceMode:"snapshot"};
}

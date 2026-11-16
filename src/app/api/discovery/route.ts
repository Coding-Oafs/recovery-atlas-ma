import { NextRequest,NextResponse } from "next/server";
import { searchInput } from "@/lib/search-input";
import { sameOrigin,rateLimit } from "@/lib/security";
import { queryDirectory } from "@/lib/directory-query";
import { searchAlternatives } from "@/lib/discovery";
export async function POST(request:NextRequest){
 if(!await sameOrigin())return NextResponse.json({error:"Invalid origin"},{status:403});
 const parsed=searchInput.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid search filters"},{status:400});
 if(!await rateLimit("discovery",60,10))return NextResponse.json({error:"Please wait before searching again."},{status:429});
 try{
 const {filters,saved,asOf}=parsed.data;
 const suggestions=await Promise.all(searchAlternatives(filters).map(async a=>{
  const result=await queryDirectory(a.filters,saved,1,{asOf});
  return {id:a.id,total:"total" in result?Number(result.total):0};
 }));
 return NextResponse.json({suggestions},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Alternatives unavailable"},{status:503});}
}

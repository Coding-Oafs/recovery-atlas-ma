"""Download official annual facility workbooks; retain the source, hash and retrieval date."""
import os,json,gzip,hashlib,urllib.request,datetime
import openpyxl
os.makedirs(".local/national",exist_ok=True)
sources=[]
for kind,report in [("su","rpt57009"),("mh","rpt57010")]:
    url=f"https://www.samhsa.gov/data/sites/default/files/reports/{report}/2025_{kind.upper()}_Facilities_for_All_City_All.xlsx"
    request=urllib.request.Request(url,headers={"User-Agent":"RecoveryAtlas/1.0 public-directory-import"})
    with urllib.request.urlopen(request,timeout=60) as response: content=response.read(15000000)
    if not content.startswith(b"PK"): raise ValueError("Expected official XLSX workbook")
    filename=f".local/national/{kind}.xlsx"
    with open(filename,"wb") as stream:stream.write(content)
    workbook=openpyxl.load_workbook(filename,read_only=True,data_only=True)
    sheet=workbook["Facilities List"]
    iterator=sheet.iter_rows(values_only=True)
    headers=[str(v).strip() if v is not None else "" for v in next(iterator)]
    if not {"name1","state","city","service_code_info"}.issubset(headers):raise ValueError(f"Changed workbook headers: {headers}")
    rows=[dict(zip(headers,row)) for row in iterator if any(row)]
    if len(rows)<1000:raise ValueError("Unexpectedly small source; review required")
    with gzip.open(f".local/national/{kind}.json.gz","wt",encoding="utf8") as stream:json.dump(rows,stream,default=str)
    sources.append({"kind":kind,"url":url,"sha256":hashlib.sha256(content).hexdigest(),"rows":len(rows)})
with open(".local/national/sources.json","w") as stream:json.dump(sources,stream)
print(json.dumps(sources,indent=2))

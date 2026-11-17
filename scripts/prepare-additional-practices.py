"""Join NPPES additional public practice addresses to the selected provider metadata."""
import csv,gzip,hashlib,io,json,re,zipfile
from collections import defaultdict,Counter
from pathlib import Path
base=Path('.local/national-providers');sites=defaultdict(list);states=set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI'.split())
def key(r):return '|'.join(re.sub(r'\s+',' ',str(r.get(k,''))).strip().lower() for k in ['address','address2','city','state','postal'])
with zipfile.ZipFile(base/'nppes-2026-11-v2.zip') as archive:
 name=next(n for n in archive.namelist() if n.startswith('pl_pfile_') and 'fileheader' not in n)
 with io.TextIOWrapper(archive.open(name),encoding='utf-8-sig',newline='') as file:
  for row in csv.DictReader(file):
   state=row['Provider Secondary Practice Location Address - State Name'].upper();country=row['Provider Secondary Practice Location Address - Country Code (If outside U.S.)']
   if state not in states or country not in ('','US','USA'):continue
   site={'address':row['Provider Secondary Practice Location Address- Address Line 1'],'address2':row['Provider Secondary Practice Location Address-  Address Line 2'],'city':row['Provider Secondary Practice Location Address - City Name'],'state':state,'postal':row['Provider Secondary Practice Location Address - Postal Code'],'phone':row['Provider Secondary Practice Location Address - Telephone Number']}
   if site['address'] and site['city']:sites[row['NPI']].append(site)
count=0;by_state=Counter()
with gzip.open(base/'filtered.ndjson.gz','rt',encoding='utf-8') as file,gzip.open(base/'additional.ndjson.gz','wt',encoding='utf-8') as output:
 for line in file:
  r=json.loads(line)
  if r['npi'] not in sites:continue
  seen={key(r)}
  for site in sites[r['npi']]:
   k=key(site)
   if k in seen:continue
   seen.add(k);v={**r,**site,'siteKey':hashlib.sha256(k.encode()).hexdigest()[:12]};output.write(json.dumps(v,separators=(',',':'))+'\n');count+=1;by_state[v['state']]+=1
print(json.dumps({'additionalPracticeRows':count,'states':dict(sorted(by_state.items()))}))

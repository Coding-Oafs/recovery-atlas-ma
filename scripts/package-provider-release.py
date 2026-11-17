"""Package whitelisted public practice facts as small, checksummed monthly release assets."""
import argparse,gzip,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--input',required=True,action='append');p.add_argument('--output',required=True);p.add_argument('--source-url',required=True);p.add_argument('--checked-at',required=True);p.add_argument('--baseline-date',required=True);args=p.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True);taxonomies={r['code'] for r in json.loads(Path('data/provider-taxonomies.json').read_text())};assets=[];batch=[];count=0
def flush():
 global batch,count
 if not batch:return
 name='providers-'+str(len(assets)).zfill(4)+'.ndjson.gz';content=gzip.compress(('\n'.join(batch)+'\n').encode(),mtime=0);(out/name).write_bytes(content);assets.append({'name':name,'sha256':hashlib.sha256(content).hexdigest(),'records':len(batch)});count+=len(batch);batch=[]
for source in args.input:
 with gzip.open(source,'rt',encoding='utf-8') as file:
  for line in file:
   r=json.loads(line)
   if not any(t['code'] in taxonomies for t in r['taxonomies']):continue
   batch.append(json.dumps(r,separators=(',',':')))
   if len(batch)>=5000:flush()
flush();manifest={'version':1,'sourceUrl':args.source_url,'checkedAt':args.checked_at,'baselineDate':args.baseline_date,'taxonomySource':'https://www.nucc.org/images/stories/CSV/nucc_taxonomy_261.csv','total':count,'assets':assets,'note':'Public NPPES practice-location registry facts only; no license, payer or availability inference.'};(out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps({'records':count,'chunks':len(assets)}))

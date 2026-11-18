"""Filter the official NPPES v2 monthly/weekly file without expanding its huge CSV.

Only public practice-location facts and relevant NUCC taxonomy labels are retained.
No tax identifiers, mailing addresses or deactivated provider details are emitted.
"""
import argparse, csv, gzip, hashlib, io, json, re, time, urllib.request, zipfile
from collections import Counter
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--archive',default='.local/national-providers/nppes-2026-11-v2.zip')
parser.add_argument('--output',default='.local/national-providers/filtered.ndjson.gz')
parser.add_argument('--source-url',default='https://download.cms.gov/nppes/NPPES_Data_Dissemination_November_2026_V2.zip')
parser.add_argument('--taxonomy-file')
args=parser.parse_args()
target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
taxonomy_url='https://www.nucc.org/images/stories/CSV/nucc_taxonomy_261.csv'
taxonomy_text=Path(args.taxonomy_file).read_text(encoding='utf-8-sig') if args.taxonomy_file else urllib.request.urlopen(taxonomy_url,timeout=30).read().decode('utf-8-sig')
selected={}
for item in csv.DictReader(io.StringIO(taxonomy_text)):
    classification=item.get('Classification','');specialization=item.get('Specialization','')
    text=classification+' '+specialization
    if classification=='Psychiatry & Neurology':text=specialization
    relevant=item.get('Grouping')=='Behavioral Health & Social Service Providers' or re.search(r'psychiatr|psycholog|psychoanal|addiction|substance (?:abuse|use)|mental health|psych/mental',text,re.I)
    if relevant:selected[item['Code']]={'code':item['Code'],'label':(item.get('Display Name') or ', '.join(x for x in [classification,specialization] if x)).strip()}

csv.field_size_limit(10_000_000)
states=set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI UM'.split())
count=0;scanned=0;by_state=Counter();by_type=Counter();started=time.time()
with zipfile.ZipFile(args.archive) as archive:
    candidates=[n for n in archive.namelist() if re.search(r'(?:^|/)npidata_pfile_.*\.csv$',n,re.I) and 'fileheader' not in n.lower()]
    if len(candidates)!=1:raise RuntimeError('Ambiguous NPPES provider CSV: '+str(candidates))
    with archive.open(candidates[0]) as compressed, io.TextIOWrapper(compressed,encoding='utf-8-sig',newline='') as source, gzip.open(target,'wt',encoding='utf-8') as output:
        reader=csv.DictReader(source)
        required=['NPI','Entity Type Code','Provider Business Practice Location Address State Name']
        if any(k not in (reader.fieldnames or []) for k in required):raise RuntimeError('Changed NPPES column layout')
        for row in reader:
            scanned+=1
            deactivated=row.get('NPI Deactivation Date','').strip();reactivated=row.get('NPI Reactivation Date','').strip()
            if deactivated:
                try:
                    if not reactivated or time.strptime(reactivated,'%m/%d/%Y')<=time.strptime(deactivated,'%m/%d/%Y'):continue
                except ValueError:continue
            state=row.get('Provider Business Practice Location Address State Name','').strip().upper()
            country=row.get('Provider Business Practice Location Address Country Code (If outside U.S.)','').strip()
            if state not in states or country not in ('','US','USA'):continue
            taxonomies=[selected[row.get(f'Healthcare Provider Taxonomy Code_{i}','')] for i in range(1,16) if row.get(f'Healthcare Provider Taxonomy Code_{i}','') in selected]
            if not taxonomies:continue
            kind=row.get('Entity Type Code','')
            if kind not in ('1','2'):continue
            record={
                'npi':row['NPI'],'entity':kind,
                'organization':row.get('Provider Organization Name (Legal Business Name)',''),
                'first':row.get('Provider First Name',''),'middle':row.get('Provider Middle Name',''),
                'last':row.get('Provider Last Name (Legal Name)',''),'credential':row.get('Provider Credential Text',''),
                'address':row.get('Provider First Line Business Practice Location Address',''),
                'address2':row.get('Provider Second Line Business Practice Location Address',''),
                'city':row.get('Provider Business Practice Location Address City Name',''),'state':state,
                'postal':row.get('Provider Business Practice Location Address Postal Code',''),
                'phone':row.get('Provider Business Practice Location Address Telephone Number',''),
                'updated':row.get('Last Update Date',''),'taxonomies':taxonomies,
            }
            if not record['address'] or not record['city']:continue
            output.write(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
            count+=1;by_state[state]+=1;by_type[kind]+=1
            if scanned%200000==0:print(json.dumps({'scanned':scanned,'selected':count,'seconds':round(time.time()-started)}),flush=True)
manifest={'source':args.source_url,'taxonomySource':taxonomy_url,'taxonomyVersion':'26.1','scanned':scanned,'selected':count,'states':dict(sorted(by_state.items())),'entityTypes':dict(by_type),'seconds':round(time.time()-started),'note':'Public practice-location registry facts only. NPI registration does not establish licensure, insurance participation or appointment availability.'}
manifest_path=target.with_suffix('.manifest.json');manifest_path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print(json.dumps(manifest),flush=True)

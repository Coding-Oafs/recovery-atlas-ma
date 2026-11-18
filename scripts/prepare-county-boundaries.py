"""Convert the Census public cartographic county boundaries to importable GeoJSON facts."""
import csv, io, json, zipfile, shapefile
from pathlib import Path
base=Path('.local/expansion-v2')
population={}
with (base/'county-population.csv').open(encoding='utf-8-sig') as file:
 for row in csv.DictReader(file):
  if row.get('SUMLEV')=='050':population[row['STATE'].zfill(2)+row['COUNTY'].zfill(3)]=int(row['POPESTIMATE2025'])
gazetteer={r['fips']:r for r in json.loads(Path('data/us-counties.json').read_text())}
states={'01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY','60':'AS','66':'GU','69':'MP','72':'PR','78':'VI'}
rows=[]
with zipfile.ZipFile(base/'county-boundaries.zip') as archive:
 name=next(n[:-4] for n in archive.namelist() if n.endswith('.shp'))
 reader=shapefile.Reader(shp=io.BytesIO(archive.read(name+'.shp')),shx=io.BytesIO(archive.read(name+'.shx')),dbf=io.BytesIO(archive.read(name+'.dbf')))
 for sr in reader.iterShapeRecords():
  r=sr.record.as_dict();fips=r['GEOID'];state=states.get(r['STATEFP'])
  if not state:continue
  g=sr.shape.__geo_interface__
  if g['type']=='Polygon':g={'type':'MultiPolygon','coordinates':[g['coordinates']]}
  # Representative points are labels only. Spatial assignment uses the actual boundary.
  reference=gazetteer.get(fips);bounds=sr.shape.bbox
  rows.append({'fips':fips,'state':state,'name':r.get('NAMELSAD',r['NAME']),'lat':reference['lat'] if reference else (bounds[1]+bounds[3])/2,'lng':reference['lng'] if reference else (bounds[0]+bounds[2])/2,'boundary':g,'population':population.get(fips),'sourceUrl':'https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html','sourceDate':'2025-01-01'})
(base/'county-import.json').write_text(json.dumps(rows,separators=(',',':')))
print(json.dumps({'counties':len(rows),'withPopulation':sum(r['population'] is not None for r in rows),'states':len(set(r['state'] for r in rows))}))

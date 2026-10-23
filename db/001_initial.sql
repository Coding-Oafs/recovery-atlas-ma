CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS resources (
 id text PRIMARY KEY, data jsonb NOT NULL, published boolean NOT NULL DEFAULT true,
 location geography(Point,4326), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING gist(location);
CREATE INDEX IF NOT EXISTS resources_data_idx ON resources USING gin(data);
CREATE TABLE IF NOT EXISTS submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), resource_id text, kind text NOT NULL CHECK(kind IN ('correction','new')),
 message text NOT NULL, source_url text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewed','dismissed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, action text NOT NULL, resource_id text, before_data jsonb, after_data jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS rate_limits(key text PRIMARY KEY, count integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS source_checks(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, resource_id text NOT NULL, status integer, error text, checked_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sync_runs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source text NOT NULL, status text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sources(id text PRIMARY KEY,name text NOT NULL,url text NOT NULL,access_status text NOT NULL,notes text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO sources(id,name,url,access_status,notes) VALUES
 ('mass-cbhc','Mass.gov CBHC directory','https://www.mass.gov/find-a-cbhc/locations','curated-public-facts','31 published locations reviewed 2026-10-22. Automated ingestion requires a separately reviewed source adapter.'),
 ('samhsa','SAMHSA FindTreatment.gov','https://findtreatment.gov/api-request-form','access-required','API application and requesting-server IP requirements must be resolved before enabling an import.'),
 ('aa','AA service entities','https://aaboston.org/meetings','curated-public-facts','Selected factual listings with individual citations; no bulk feed access is implied.'),
 ('smart','SMART Recovery','https://meetings.smartrecovery.org/meetings/','directory-link','Link to official directory until authorized import access is available.'),
 ('dharma','Recovery Dharma','https://recoverydharma.org/meetings/','directory-link','Selected public factual entries may be curated. Bulk feed permission is not established.')
ON CONFLICT(id) DO NOTHING;

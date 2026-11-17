CREATE TABLE IF NOT EXISTS atlas_import_release (
 id text PRIMARY KEY, source text NOT NULL, status text NOT NULL DEFAULT 'staging',
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), activated_at timestamptz
);
CREATE TABLE IF NOT EXISTS atlas_import_release_member (
 release_id text NOT NULL REFERENCES atlas_import_release(id), resource_id text NOT NULL REFERENCES resources(id),
 PRIMARY KEY(release_id,resource_id)
);
CREATE TABLE IF NOT EXISTS atlas_county (
 fips text PRIMARY KEY CHECK(fips~'^[0-9]{5}$'), state text NOT NULL, name text NOT NULL,
 boundary geometry(MultiPolygon,4326), lat double precision NOT NULL, lng double precision NOT NULL,
 source_url text NOT NULL, source_date date NOT NULL, population bigint
);
CREATE INDEX IF NOT EXISTS atlas_county_boundary_idx ON atlas_county USING gist(boundary);
CREATE TABLE IF NOT EXISTS atlas_resource_county (
 resource_id text PRIMARY KEY REFERENCES resources(id) ON DELETE CASCADE, county_fips text NOT NULL REFERENCES atlas_county(fips),
 accuracy text NOT NULL CHECK(accuracy IN('address','approximate')), checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atlas_resource_county_fips_idx ON atlas_resource_county(county_fips);
CREATE TABLE IF NOT EXISTS atlas_geocode_cache (
 address_key text PRIMARY KEY, address text NOT NULL, city text NOT NULL, state text NOT NULL, zip text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending', lat double precision, lng double precision, county_fips text,
 matched_address text, match_type text, attempts integer NOT NULL DEFAULT 0, checked_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
 source_url text NOT NULL DEFAULT 'https://geocoding.geo.census.gov/geocoder/'
);
CREATE INDEX IF NOT EXISTS atlas_geocode_pending_idx ON atlas_geocode_cache(next_attempt_at) WHERE status IN('pending','retry');
CREATE TABLE IF NOT EXISTS atlas_source_job (
 id text PRIMARY KEY, name text NOT NULL, url text NOT NULL, adapter text NOT NULL, config jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0, next_run_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz,
 last_success_at timestamptz, last_attempt_at timestamptz, last_error text, record_count integer, etag text, last_modified text,
 interval_hours integer NOT NULL DEFAULT 24 CHECK(interval_hours>=1), enabled boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS atlas_source_job_due_idx ON atlas_source_job(next_run_at) WHERE enabled;
CREATE TABLE IF NOT EXISTS atlas_source_run (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, source_id text NOT NULL REFERENCES atlas_source_job(id),
 status text NOT NULL, counts jsonb NOT NULL DEFAULT '{}', error text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS atlas_meeting_identity (
 fingerprint text PRIMARY KEY, resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS atlas_source_member (
 source_id text NOT NULL REFERENCES atlas_source_job(id), external_id text NOT NULL, resource_id text NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
 facts jsonb NOT NULL, last_seen_at timestamptz NOT NULL DEFAULT now(), missing_since timestamptz,
 PRIMARY KEY(source_id,external_id)
);
CREATE TABLE IF NOT EXISTS atlas_county_coverage (
 county_fips text PRIMARY KEY REFERENCES atlas_county(fips), counts jsonb NOT NULL DEFAULT '{}', generated_at timestamptz NOT NULL DEFAULT now()
);

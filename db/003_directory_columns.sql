ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_state text GENERATED ALWAYS AS (data->>'state') STORED;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_kind text GENERATED ALWAYS AS (data->>'kind') STORED;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_name text GENERATED ALWAYS AS (data->>'name') STORED;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_source text GENERATED ALWAYS AS (data->>'sourceName') STORED;
CREATE INDEX IF NOT EXISTS resources_state_fast_idx ON resources(resource_state) WHERE published;
CREATE INDEX IF NOT EXISTS resources_name_fast_idx ON resources(resource_name,id) WHERE published;
CREATE INDEX IF NOT EXISTS resources_kind_fast_idx ON resources(resource_kind) WHERE published;
CREATE INDEX IF NOT EXISTS resources_source_fast_idx ON resources(resource_source,id) WHERE published;

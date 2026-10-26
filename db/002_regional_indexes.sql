CREATE INDEX IF NOT EXISTS resources_state_idx ON resources((data->>'state')) WHERE published;
CREATE INDEX IF NOT EXISTS resources_name_idx ON resources((data->>'name'),id) WHERE published;
CREATE INDEX IF NOT EXISTS resources_kind_idx ON resources((data->>'kind')) WHERE published;
CREATE INDEX IF NOT EXISTS resources_categories_idx ON resources USING gin((data->'categories')) WHERE published;
CREATE INDEX IF NOT EXISTS resources_formats_idx ON resources USING gin((data->'formats')) WHERE published;
CREATE INDEX IF NOT EXISTS resources_location_geometry_idx ON resources USING gist((location::geometry)) WHERE published;

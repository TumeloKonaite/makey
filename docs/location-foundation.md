# Listing location foundation

Listings retain the legacy `location` and `area` values and also store normalized
address fields plus nullable latitude/longitude. Existing rows require no backfill.

## PostGIS deployment

Production Terraform allow-lists `postgis` through the Azure Flexible Server
`azure.extensions` setting. The location migration then attempts to install the
extension and, when successful, creates a generated `geography(Point, 4326)`
column and a GiST index.

If the database platform does not provide PostGIS, or the migration role cannot
install it, the migration logs a notice and safely continues. Latitude, longitude,
and all normalized address fields remain available; only spatial SQL/indexing is
disabled. Re-running the migration is not required to keep listings readable.

## Geocoding

Set `GEOCODING_BASE_URL` to a contracted or self-hosted Nominatim-compatible JSON
or GeoJSON search endpoint. Optional bearer credentials use `GEOCODING_API_KEY`.
The browser calls `/locations/search` only and never receives either value.

The backend restricts requests to South Africa, applies a timeout, normalizes
provider responses, and uses a bounded in-process TTL cache. A shared external
cache can later replace the service cache without changing the API or UI.

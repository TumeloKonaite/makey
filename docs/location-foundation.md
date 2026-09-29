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


## Public map privacy

Owner-entered coordinates and address metadata are retained exactly for authenticated owner workflows and geographic database queries. Anonymous `/listings` and `/listings/{id}` responses never return the street address or geocoder place identifier. Their map point is deterministically displaced by approximately 120–350 metres using the listing ID, so it remains stable across refreshes without identifying the residence. The deliberately small radius normally keeps the point in the same suburb/city; locality labels are never altered. Public payloads mark the coordinate provider as `approximate`.

# Production geocoding

## Selected provider

Production uses LocationIQ's EU v1 forward-geocoding endpoint:

```text
https://eu1.locationiq.com/v1/search
```

It is a managed, Nominatim-compatible API, supports `countrycodes=za`, and
documents country-formatted postal addresses for South Africa. The application
also rejects results whose returned country code is not `ZA`.

Use a paid LocationIQ geocoding plan sized for observed traffic; the free plan
is for evaluation and is not the production dependency. Current published
limits start at 25,000 requests/day and 20 requests/second for the Developer
plan, with higher daily/monthly and per-second limits on larger plans. Paid
plans have soft overage limits and eventually return HTTP 429. The application
uses a bounded one-hour cache to reduce duplicate calls, but operators must
monitor quota usage and 429/5xx responses.

LocationIQ publishes a 99.9% default uptime guarantee and offers custom
contracts/SLAs and dedicated endpoints. Treat that statement as the baseline,
not as a substitute for reviewing the purchased order form. The API uses
OpenStreetMap, OpenAddresses, GeoNames, and other datasets and advertises
worldwide coverage; the South Africa restriction and deployment smoke queries
are the release-time coverage check.

References:

- [Forward geocoding API and South Africa support](https://docs.locationiq.com/reference/search)
- [Plans and rate limits](https://locationiq.com/pricing)
- [Availability and SLA expectations](https://help.locationiq.com/support/solutions/articles/36000216118-what-kind-of-sla-uptime-and-response-times-can-i-expect-)
- [Terms and acceptable use](https://locationiq.com/tos)
- [Data attribution](https://locationiq.com/attribution)

## Attribution and acceptable use

Review the terms and the purchased plan before launch and whenever they change.
The free plan requires a prominent “Search by LocationIQ.com” link. LocationIQ's
attribution page identifies upstream dataset licences, including OpenStreetMap's
ODbL attribution. Product surfaces that display provider data must retain the
attribution required by the selected plan and underlying dataset; map surfaces
must show the applicable map/data attribution.

Do not mine, reverse engineer, resell, sublicense, or disclose the access token.
LocationIQ permits only temporary request-response caching without separate
permission: free accounts are limited to 48 hours, while paid customers may
cache while subscribed. The configured one-hour TTL complies with either case.
Stored output has separate allowances in the terms. Re-check these conditions
with counsel/product ownership before changing retention or reuse.

## Configuration and release validation

The backend requires both values whenever `ENVIRONMENT` is not `local` or
`test`:

```ini
GEOCODING_BASE_URL=https://eu1.locationiq.com/v1/search
GEOCODING_API_KEY=<LocationIQ access token>
```

Terraform supplies the URL as an ordinary Container App environment variable.
The protected GitHub `production` environment supplies
`TF_VAR_GEOCODING_API_KEY`; Terraform stores it as the
`geocoding-api-key` Azure Container Apps secret and maps
`GEOCODING_API_KEY` by secret reference. Never place the token in tfvars,
workflow variables, source, logs, or a browser bundle. Terraform state contains
managed secret values, so retain the existing restricted and encrypted state
controls.

Application settings validation rejects a missing URL, missing token, local-only
host, or non-HTTPS provider URL before the server starts. Terraform also rejects
an empty token or non-HTTPS URL. After apply, CD calls
`/locations/search` for Sandton, Cape Town, and Soweto and requires at least
one normalized `ZA` result for each; failure triggers the existing rollback
path.

Deploy to a non-production Azure environment first with a separate LocationIQ
token and run the same three queries. Confirm quota, latency, normalized
city/province/postal-code values, and attribution before approving production.

## Token rotation

1. Create a second LocationIQ token with the same plan and server restrictions.
2. Replace the protected GitHub environment secret
   `TF_VAR_GEOCODING_API_KEY`; do not put the value in a repository variable.
3. Run the approved deployment. Confirm the new Container App revision is ready
   and all three geocoding smoke queries pass.
4. Revoke the old LocationIQ token.
5. Review provider access/quota dashboards and Azure logs for unexpected use.

If authentication fails, the endpoint returns a sanitized 502 and CD smoke
validation fails. A missing production setting prevents startup rather than
releasing a revision that returns “Location search is not configured.”

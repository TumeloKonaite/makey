# Production listing-image object storage

## Confirmed provider and contract

Production listing images remain in **Google Cloud Storage (GCS)** through its
S3-compatible XML API. Azure Container Apps will use the same provider; this
work does not add Azure Blob Storage or copy objects.

| Setting | Confirmed production value |
| --- | --- |
| Provider | Google Cloud Storage, S3-compatible/XML API |
| `OBJECT_STORAGE_ENDPOINT` | `https://storage.googleapis.com` |
| `OBJECT_STORAGE_REGION` | `us-central1` |
| `OBJECT_STORAGE_BUCKET` | `makey` |
| `OBJECT_STORAGE_PUBLIC_URL` | `https://storage.googleapis.com` |
| Access model | Public reads; authenticated application writes and deletes |

The canonical variables are `OBJECT_STORAGE_ENDPOINT`,
`OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_PUBLIC_URL`,
`OBJECT_STORAGE_ACCESS_KEY`, and `OBJECT_STORAGE_SECRET_KEY`. The legacy
`MINIO_*` aliases remain supported. The application does not read the issue's
example `S3_*` names.

`MinioImageStorage` remains the repository: it streams uploads to GCS, deletes
objects through the object API, and builds
`https://storage.googleapis.com/makey/<object-name>`. PostgreSQL stores the
public URL and object key, not image bytes. Production startup does not create
or configure the bucket. No listing-image path uses writable Container Apps
storage.

Existing objects and database URLs already use this provider and URL shape. No
object, object-key, or database-URL migration is required. Existing images stay
available through Azure deployment and rollback because both compute platforms
refer to the same external bucket. Any later provider, bucket, access-model, or
URL migration requires a separate issue.

## Azure configuration and least privilege

Terraform supplies the four non-secret values above as Container App
environment variables. GitHub's protected `production` environment supplies
`OBJECT_STORAGE_ACCESS_KEY` and `OBJECT_STORAGE_SECRET_KEY`; CD passes them as
sensitive Terraform inputs, creates the `object-storage-access-key` and
`object-storage-secret-key` Container Apps secrets, and maps the runtime
variables to secret references.

Never put credentials in `terraform.tfvars`, GitHub variables, committed env
files, workflow output, deployment evidence, command arguments, or application
logs. Sensitive Terraform values still exist in state: keep its Azure container
private, versioned, soft-delete protected, and restricted to deployment and
break-glass identities. Do not publish saved plans or environment dumps.

Use an HMAC key for a dedicated GCP service account scoped to bucket `makey`.
The application needs only `storage.buckets.get` (readiness),
`storage.objects.create`, `storage.objects.get`, and `storage.objects.delete`.
Use a bucket-scoped custom role; do not grant bucket creation/policy changes,
project-wide Storage Admin, object listing, or HMAC administration. The official
[XML API permission map](https://cloud.google.com/storage/docs/access-control/iam-xml)
is the authority for these permissions.

## Bucket operations and public access

Manage bucket IAM, lifecycle, CORS, retention, versioning, soft delete, and HMAC
keys in the existing GCP project, outside this Terraform root, under the GCP
project's normal audit/change process. The local MinIO startup helper is disabled
in production and is not a GCS management mechanism.

The current URL model requires anonymous reads. Keep public access prevention
disabled and retain the intended public-read binding. Prefer retrieval without
listing where the bucket's access-control mode supports it. Verify the effective
policy in GCP before deployment; the application must not mutate it. See GCS
[public access guidance](https://cloud.google.com/storage/docs/access-control/making-data-public).

Anyone who knows or discovers a public URL can fetch and redistribute its image;
URLs are not secrets or per-viewer revocable. Browser/crawler traffic incurs
operations and egress, and objects/metadata must contain no sensitive data.
Private objects and signed URLs are out of scope.

Browsers only display public object URLs; upload and delete pass through the
API. GCS CORS is not needed for ordinary `<img src>` display. If frontend code
later uses fetch/XHR or canvas pixel access, add an origin-specific rule for the
deployed frontend and `GET`/`HEAD`; do not use credentialed wildcard CORS.

## Costs, limits, and recovery controls

Expected cost comprises stored GiB-months, Class A writes, Class B reads, and
internet egress for Azure/public delivery. Soft-deleted or noncurrent versions
can remain billable. Confirm the actual storage class, monthly usage, budgets,
and current SKUs in GCP Billing; Google maintains rates on the official
[Cloud Storage pricing page](https://cloud.google.com/storage/pricing). Do not
assume cross-cloud transfer is free.

The application's stricter limit is JPEG/PNG/WebP up to `MAX_IMAGE_UPLOAD_MB`
(default 5 MiB). GCS permits objects up to 5 TiB; XML API limits include 16 KiB
combined request URL/headers and 10,000 multipart parts. Review the current
[GCS quotas and limits](https://cloud.google.com/storage/quotas) before capacity
changes. Alert on errors, latency, bytes stored, operations, and egress spend.

Before first deployment, record via the GCP console or read-only CLI whether
lifecycle rules, soft-delete retention, Object Versioning, Autoclass, retention
policy, default holds, and CORS are enabled. Their effective values are not in
this repository; do not guess or change them in this issue. Restore a deleted
object/version when those controls permit, otherwise use the existing provider
backup process. Restoring the original key preserves its public URL.

## Credential creation and rotation

Create an HMAC key for the dedicated service account in GCS interoperability
settings. Its secret is shown once. Store both values directly as protected
GitHub production secrets. GCS permits at most 10 HMAC keys per service account
and creation may take 60 seconds to propagate; see the official
[HMAC guidance](https://cloud.google.com/storage/docs/authentication/hmackeys).

Rotate without downtime:

1. Create a second least-privilege HMAC key and wait for propagation.
2. Replace both protected GitHub secrets and run approved CD. Never print or pass
   the values in command arguments.
3. Confirm the new revision reaches `/ready`. Full upload/delete testing remains
   part of first production deployment.
4. Disable the old key, observe readiness/storage errors for the approved overlap
   period, then delete it. If validation fails, re-enable it or redeploy the
   previous secrets before diagnosis.

## Diagnosis and rollback

1. Check `/health` and `/ready`; storage failure is sanitized as
   `Object-storage dependency is unavailable.`
2. Confirm the active revision has all six variable names and two secret
   references. Inspect names/references only, never values.
3. Securely verify bucket location, HMAC status, bucket-scoped permissions, and
   GCS audit-log denials.
4. A `403` on readiness/upload/delete suggests HMAC/IAM; anonymous URL `403`
   suggests public-access policy; `404` suggests bucket/key/deletion; timeout,
   DNS, or TLS errors suggest endpoint/network configuration.
5. Confirm the public base has no bucket suffix: code adds
   `/makey/<object-name>`. Compare failing database URLs with that shape.

If Azure cannot reach GCS, stop promotion and route traffic to the last healthy
pre-Azure deployment/revision. Do not copy images to local disk, rewrite URLs,
change buckets, or add an Azure Blob fallback. Restore the previous HMAC key if
rotation caused failure. The shared bucket and URLs remain available throughout.

## Deferred runtime validation

The first-production-deployment issue must test from the running Container App:
supported upload/retrieval; rejection of unauthorized, unsupported, and
oversized uploads; owner deletion; object/database consistency; survival across
restart, revision replacement, and scale-to-zero; and accessibility of existing
production images.

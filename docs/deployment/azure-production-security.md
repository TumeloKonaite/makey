# Azure production identity, secrets, and deployment

Production images use `<acr>.azurecr.io/rooms-api:<full-40-character-git-sha>`.
The SHA tag is the deployment and rollback source of truth; mutable convenience
tags must never be passed to Terraform. The CD workflow records the selected SHA
in its run and confirms Azure Container Apps reports that exact image.

## Trust paths

- GitHub Actions obtains a short-lived Azure token through OIDC. The Entra
  federated credential subject must be
  `repo:<owner>/<repository>:environment:production`.
- The publishing principal receives `AcrPush` on this ACR only.
- The Container App has a system-assigned identity and receives `AcrPull` on
  this ACR only. ACR admin access is disabled and no registry password is stored.
- Terraform receives application credentials from protected environment secrets,
  stores them as Container App secrets, and maps them to runtime variables by
  secret reference.

Create the federated credential once using an administrator bootstrap identity:

```bash
az ad app federated-credential create --id <application-client-id> --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<owner>/<repository>:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

Do not add a branch-wide or pull-request subject and do not create an
`AZURE_CLIENT_SECRET`.

## GitHub production environment

Create a protected environment named `production`. Require a reviewer, prevent
self-review where supported, restrict deployment to `main` or approved release
tags, and do not allow forked pull requests to access it.

Environment secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
- `TF_VAR_database_url`, `TF_VAR_clerk_secret_key`,
  `TF_VAR_clerk_webhook_secret`
- `OBJECT_STORAGE_ACCESS_KEY`, `OBJECT_STORAGE_SECRET_KEY`

Environment variables:

- `ACR_NAME`, `AZURE_LOCATION`, `AZURE_RESOURCE_GROUP`
- `CONTAINER_APP_NAME`, `CONTAINER_APP_ENVIRONMENT_NAME`
- `LOG_ANALYTICS_WORKSPACE_NAME`, `FRONTEND_ORIGIN`
- `POSTGRESQL_RESOURCE_GROUP_NAME`, `POSTGRESQL_SERVER_NAME`,
  `POSTGRESQL_DATABASE_NAME`
- `TF_STATE_RESOURCE_GROUP`, `TF_STATE_STORAGE_ACCOUNT`
- `TF_VAR_environment_variables`: a Terraform map expression containing only
  non-sensitive object-storage endpoint, public URL, bucket, and optional region

Never configure `AZURE_CLIENT_SECRET`, GHCR credentials, ACR admin
credentials, or secret values as GitHub variables.

## Azure RBAC

Grant the GitHub deployment principal only:

- `AcrPush` on the production ACR.
- Resource-management permissions for the resources represented by this
  production root, preferably a custom role scoped to the production resource
  group rather than subscription-wide `Contributor`.
- `Storage Blob Data Contributor` on the private `tfstate` container.
- During initial identity provisioning only, permission to create the
  ACR-scoped `AcrPull` assignment. Use a separate bootstrap identity or
  temporarily grant `Role Based Access Control Administrator` at ACR scope,
  then remove it after apply.

Do not grant Owner. Audit with `az role assignment list --all --assignee
<object-id>` and verify the runtime principal has only ACR-scoped `AcrPull`.

## State and secrets

The Azure Storage backend uses Entra authentication. Disable public access,
enable blob versioning and soft delete, encrypt storage, restrict network access
where feasible, and restrict readers to deployment/break-glass identities.
Azure Blob leases provide state locking. Terraform's `sensitive` flag only
redacts CLI output: all Terraform-managed Container App secret values remain in
state. Never publish plan files as artifacts or print environment variables.

Rotate a secret by replacing its protected GitHub environment secret and running
the approved CD workflow. Verify the new revision, then revoke the old
credential at its source. For Azure identity compromise, remove the federated
credential or role assignments immediately and review Entra, GitHub, ACR, and
Container Apps audit logs.

## Deploy and validate

A successful CI run on `main` triggers CD through the protected environment.
CD authenticates with OIDC, pushes `rooms-api:<git-sha>`, applies the exact
reference, checks the deployed image, and calls `/health` and `/ready`.
Inspect the revision and identity independently:

```bash
az containerapp revision list -g <resource-group> -n <app> -o table
az containerapp show -g <resource-group> -n <app> \
  --query '{image:properties.template.containers[0].image,identity:identity.principalId}'
az acr show -g <resource-group> -n <acr> --query adminUserEnabled
az role assignment list --scope <acr-resource-id> -o table
```

Confirm Clerk login/webhook behavior and a PostgreSQL-backed endpoint without
printing secret values. Review GitHub and Azure logs to confirm no secrets were
emitted.

## Rollback

Run the CD workflow manually from `main` and set `image_sha` to a previously
deployed full SHA. The workflow verifies that tag exists in ACR and deploys it
without rebuilding. Confirm the prior revision becomes healthy and both health
endpoints pass. Retain SHA tags according to the release-retention policy; do
not purge images still eligible for rollback.

## Key Vault follow-up

Key Vault is intentionally deferred. Track the work in
[Key Vault follow-up](./key-vault-follow-up.md).

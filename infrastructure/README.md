# Rooms backend infrastructure

This directory contains a reusable Azure backend module and two deliberately
separate Terraform roots. `environments/local` targets only the Floci Azure
emulator. `environments/production` targets Azure. Apply it with production
inputs and a reviewed plan.

## Layout and requirements

- `modules/rooms_backend`: Azure resource group, ACR, Log Analytics, Container
  Apps environment, and the FastAPI Container App.
- `environments/local`: fixed fake identities and a hard-coded Floci metadata
  endpoint. It cannot use an active Azure CLI login.
- `environments/production`: normal AzureRM provider and example remote state.
- Terraform 1.9 or newer and Docker with Compose v2 are required.
- AzureRM is constrained to the 4.x provider line. Each root gets its own
  committed `.terraform.lock.hcl` after a successful `terraform init`.

Install Terraform using the official HashiCorp package for your operating
system, then confirm `terraform version`. Do not copy provider settings between
the two environment roots.

## Local Floci workflow

Floci 0.13.0 is pinned in the Compose file. Port 4577 is bound only to the
loopback interface. The Docker socket is mounted because real Container Apps
mode launches the configured image; do not run untrusted Terraform or images
with this stack. ACR is intentionally management-plane-only locally because an
external registry is not needed for the lifecycle test.

Start Floci independently of the application stack:

```bash
cd infrastructure/environments/local/floci
docker compose up -d
docker compose ps
```

The AzureRM provider requires HTTPS for custom-cloud discovery. Floci creates a
self-signed certificate. Download it and point Go/Terraform at that certificate
without changing the machine-wide trust store:

```bash
curl -fsS http://localhost:4577/_floci/tls-cert -o floci-az.crt
export SSL_CERT_FILE="$PWD/floci-az.crt"
curl -fsS http://localhost:4577/_floci/health
```

`floci-az.crt` is explicitly ignored by this infrastructure directory's
`.gitignore`; delete it when finished if it is no longer needed. No Azure CLI
or `ARM_*` variables are required. If Azure credentials exist in the shell,
the local provider still sets `use_cli = false`, uses fake credentials, selects
the custom `stack` cloud, and discovers it only at `localhost:4577`. Confirm a
trace contains `localhost:4577` if necessary:

```bash
TF_LOG=DEBUG terraform plan 2>&1 | grep 'localhost:4577'
```

Run the lifecycle from the repository root:

```bash
terraform fmt -check -recursive infrastructure/
cd infrastructure/environments/local
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform validate
terraform plan -out=local.tfplan
terraform show local.tfplan
terraform apply local.tfplan
terraform output
```

Review the saved plan before apply. It should only create the local names ending
in `local-floci`, under fake subscription
`00000000-0000-0000-0000-000000000001`; it must contain no unexpected replace
or destroy operation.

The example runs pinned nginx because it is public and has no marketplace
credentials. Test Floci's ingress using the returned FQDN as the Host header:

```bash
curl --fail --show-error --silent \
  -H "Host: $(terraform output -raw backend_fqdn)" \
  "$(terraform output -raw backend_url)/"
```

The expected response is nginx's HTML welcome page. To test the FastAPI image,
build/tag an image reachable by Floci, set `container_image` and
`container_port = 8000`, then request `/health`; the expected response is
`{"status":"ok"}`. A successful request proves only that the local container
and Floci proxy worked.

Destroy through another reviewed plan:

```bash
terraform plan -destroy -out=destroy.tfplan
terraform show destroy.tfplan
terraform apply destroy.tfplan
terraform show
cd floci
docker compose down
```

`terraform show` should report no state resources. Add `--volumes` to the final
Compose command only when the local Floci certificate/data volume should also
be deleted.

## Production preparation

The shared module accepts either a new or existing resource group and configures
external ingress, CPU/memory, replica bounds, runtime environment variables,
secret references, registry access, and HTTP startup/liveness/readiness probes.
No database,
object store, Clerk credential, or other secret value belongs in Git. Secret
variables are marked sensitive, but values still enter Terraform state; the
remote state store therefore requires access controls, encryption, and audit
logging. Production uses system-assigned managed identity for ACR pulls. See
`docs/deployment/azure-production-security.md` for OIDC, RBAC, secrets, state,
deployment, rollback, and the linked Key Vault follow-up.

## What Floci does not prove

Successful Floci validation does **not** prove an identical Azure deployment.
It does not validate Azure quotas, RBAC/AAD enforcement, policy, regional
availability, global naming conflicts, real ACR authentication, managed
identity, DNS/certificates, private networking, Azure load balancing, Log
Analytics ingestion/retention/billing, production autoscaling, image pull
permissions, or PostgreSQL connectivity/TLS. Scale rules beyond min/max are not
evaluated locally. Floci's ARM state is ephemeral and resource-group deletion
does not reproduce Azure cascading behaviour. The production plan must be
reviewed and then exercised in a non-production Azure environment before the
first production apply.

The local root disables Log Analytics creation because AzureRM 4.81 checks the
subscription-level `deletedWorkspaces` endpoint before creating a workspace,
and Floci 0.13.0 returns 404 for that operation. Production leaves Log Analytics
enabled. Local validation therefore covers the shared module's remaining ARM
graph but does not test workspace creation or the Container Apps log link.
It also disables tags locally because Floci 0.13.0 does not round-trip resource
group tags and rejects the provider's follow-up tag update with HTTP 405;
production continues to apply all standard and supplied tags.

## Troubleshooting

- `x509: certificate signed by unknown authority`: recreate `floci-az.crt` and
  export `SSL_CERT_FILE` in the same shell that runs Terraform.
- `HTTP response to HTTPS client`: TLS was not enabled; recreate the Compose
  service and check `FLOCI_AZ_TLS_ENABLED=true`.
- Provider tries Azure: stop immediately. Verify you are in
  `environments/local`, the metadata host is still `localhost:4577`, and the
  fake IDs remain unchanged.
- Image/ingress does not start: check `docker compose logs floci-az`, confirm
  Docker socket access, and use an image whose architecture matches the host.
- FQDN does not resolve: this is expected locally; call localhost:4577 and pass
  the FQDN in the `Host` header as shown above.
- An unsupported AzureRM read fails: compare the requested operation with
  Floci's service documentation. Record the limitation and validate that part
  in an isolated Azure development subscription; do not weaken the local
  provider safeguards.

## Production Container Apps deployment

The production root now uses an Azure Storage backend with the dedicated key
`rooms-marketplace/production/container-apps.tfstate`. Bootstrap the state
resource group, storage account, and `tfstate` container separately. Enable
blob versioning and disable public blob access on the storage account. Grant
the deployment identity Blob Data Contributor on the container and the Azure
resource permissions needed by the configuration. The backend uses Azure AD
authentication; do not use or commit storage keys. Keep the state container
private and restrict its readers: Terraform state contains Container App secret
values even though outputs omit them. Local Floci state remains in its separate
root and is never migrated into this backend.

From `infrastructure/environments/production`, copy
`terraform.tfvars.example` to the ignored `terraform.tfvars` and fill in the
real, non-secret inputs. Supply `TF_VAR_database_url`, `TF_VAR_clerk_secret_key`,
`TF_VAR_clerk_webhook_secret`, `TF_VAR_object_storage_access_key`, and
`TF_VAR_object_storage_secret_key` through the protected production environment;
never write them to a committed file or shell history. The production frontend URL and external object storage
settings must also be real before deployment.

The existing PostgreSQL Flexible Server is read from
`rg-rooms-marketplace-prod/rooms-marketplace-postgres`; this configuration
never creates or replaces it. Confirm its public network access is enabled
before applying. The firewall rule `temporary-allow-azure-services` uses
Azure's special `0.0.0.0` to `0.0.0.0` range, which permits connections from
Azure hosted services broadly, including other tenants. This is **not** a
client-wide `0.0.0.0/0` rule. Database authentication and TLS with hostname
verification remain required. Remove this rule when private networking is
implemented. If another Terraform stack currently owns the same firewall
rule, import or transfer ownership before applying to avoid two writers.

Supply the complete production database URL through `TF_VAR_database_url`. It must use
the `postgresql+psycopg` driver, TLS hostname verification, and the Azure root
bundle at `/etc/ssl/certs/azure-postgresql-roots.pem`.

The shared module creates ACR. Push the production image to the configured ACR
before the full Container App apply. For a new registry, create only the
registry first with a reviewed, targeted plan, push the immutable image tag,
then run a full plan and apply. Do not use a mutable `latest` tag. The image
already starts Uvicorn at `0.0.0.0:8000`; Terraform does not override its
command. Configure an external object store and existing bucket before
starting the app; `/ready` checks both it and PostgreSQL.

```bash
az login
terraform init -reconfigure \
  -backend-config="resource_group_name=rg-rooms-terraform-state" \
  -backend-config="storage_account_name=strmprodstate538a26" \
  -backend-config="container_name=tfstate"
terraform fmt -check -recursive ../../
terraform validate
terraform plan -out=production.tfplan
terraform show production.tfplan
terraform apply production.tfplan
curl --fail --show-error "$(terraform output -raw container_app_url)/health"
terraform plan
```

Also verify `/ready` returns 200, the approved frontend receives a CORS allow
origin header while an unapproved origin does not, HTTP is rejected or
redirected, and a database query succeeds over TLS. Confirm state is present in
the configured blob container and `terraform output` contains no secrets.
After idle scale down, request `/health` again and observe a revision return to
one replica. `min_replicas = 0` causes cold starts; background jobs must not
rely on a continuously running API replica. The deployment is capped at one
replica.

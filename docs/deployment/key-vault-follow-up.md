# Follow-up: move production secrets to Azure Key Vault

Status: proposed follow-up to the Container Apps identity and secrets rollout.

- Provision a production Key Vault with RBAC authorization, soft delete, purge
  protection, diagnostic audit logging, and restricted network/public access.
- Grant the Container App system identity `Key Vault Secrets User` only at the
  required vault or secret scope.
- Replace inline Container App values with Key Vault-backed secret references.
- Define rotation, expiry monitoring, revocation, rollback, and break-glass
  procedures for database, Clerk, and object-storage credentials.
- Verify secret-reference revisions, managed-identity access, and audit events.
- Review whether secret values remain in Terraform state and migrate away from
  directly supplied values.
- Remove obsolete GitHub-held application secrets after validation.

output "resource_group_id" {
  description = "Resource group ID."
  value       = local.resource_group_id
}

output "resource_group_name" {
  value = local.resource_group_name
}

output "container_app_name" {
  value = azurerm_container_app.this.name
}

output "container_app_environment_name" {
  value = azurerm_container_app_environment.this.name
}

output "migration_job_name" {
  value = try(azurerm_container_app_job.migrations[0].name, null)
}
output "migration_job_start_command" {
  value = var.enable_migration_job ? "az containerapp job start --name ${azurerm_container_app_job.migrations[0].name} --resource-group ${local.resource_group_name}" : null
}

output "latest_revision_name" {
  value = azurerm_container_app.this.latest_revision_name
}

output "container_registry_login_server" {
  description = "Container Registry login server."
  value       = azurerm_container_registry.this.login_server
}

output "container_app_id" {
  description = "Container App resource ID."
  value       = azurerm_container_app.this.id
}

output "container_app_principal_id" {
  description = "Object ID of the Container App system-assigned identity."
  value       = try(azurerm_container_app.this.identity[0].principal_id, null)
}

output "container_app_fqdn" {
  description = "Container App ingress FQDN."
  value       = azurerm_container_app.this.ingress[0].fqdn
}

output "backend_url" {
  description = "HTTPS URL exposed by Azure Container Apps. Floci ingress uses the FQDN as a Host header on its local endpoint."
  value       = "https://${azurerm_container_app.this.ingress[0].fqdn}"
}

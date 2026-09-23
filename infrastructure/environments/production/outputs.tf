output "container_app_url" {
  value = module.rooms_backend.backend_url
}

output "container_app_name" {
  value = module.rooms_backend.container_app_name
}

output "container_app_environment_name" {
  value = module.rooms_backend.container_app_environment_name
}

output "container_app_fqdn" {
  value = module.rooms_backend.container_app_fqdn
}

output "latest_revision_name" {
  value = module.rooms_backend.latest_revision_name
}

output "resource_group_name" {
  value = module.rooms_backend.resource_group_name
}

output "postgresql_server_fqdn" {
  value = data.azurerm_postgresql_flexible_server.existing.fqdn
}

output "postgresql_database_name" {
  value = var.postgresql_database_name
}

output "container_registry_login_server" {
  value = module.rooms_backend.container_registry_login_server
}


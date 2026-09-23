data "azurerm_postgresql_flexible_server" "existing" {
  name                = var.postgresql_server_name
  resource_group_name = var.postgresql_resource_group_name
}

# Temporary public-network exception. Azure interprets 0.0.0.0-0.0.0.0
# as "Allow public access from any Azure service within Azure".
resource "azurerm_postgresql_flexible_server_firewall_rule" "temporary_azure_services" {
  name             = "temporary-allow-azure-services"
  server_id        = data.azurerm_postgresql_flexible_server.existing.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

module "rooms_backend" {
  source = "../../modules/rooms_backend"

  environment                    = "production"
  location                       = var.location
  resource_group_name            = var.resource_group_name
  create_resource_group          = var.create_resource_group
  container_registry_name        = var.container_registry_name
  use_acr_managed_identity       = true
  log_analytics_workspace_name   = var.log_analytics_workspace_name
  container_app_environment_name = var.container_app_environment_name
  container_app_name             = var.container_app_name
  container_image                = var.container_image
  container_port                 = var.container_port
  cpu                            = var.cpu
  memory                         = var.memory
  min_replicas                   = var.min_replicas
  max_replicas                   = var.max_replicas
  environment_variables = merge(var.environment_variables, {
    CORS_ALLOWED_ORIGINS     = var.frontend_origin
    CLERK_AUTHORIZED_PARTIES = var.frontend_origin
  })
  secrets = merge(var.secrets, {
    database-url              = var.database_url
    clerk-secret-key          = var.clerk_secret_key
    clerk-webhook-secret      = var.clerk_webhook_secret
    object-storage-access-key = var.object_storage_access_key
    object-storage-secret-key = var.object_storage_secret_key
  })
  secret_environment_variables = merge(var.secret_environment_variables, {
    DATABASE_URL              = "database-url"
    CLERK_SECRET_KEY          = "clerk-secret-key"
    CLERK_WEBHOOK_SECRET      = "clerk-webhook-secret"
    OBJECT_STORAGE_ACCESS_KEY = "object-storage-access-key"
    OBJECT_STORAGE_SECRET_KEY = "object-storage-secret-key"
  })
  tags = merge(var.tags, {
    application = "rooms-marketplace"
    environment = "production"
  })
}

check "container_image_uses_managed_acr" {
  assert {
    condition     = startswith(var.container_image, "${var.container_registry_name}.azurecr.io/")
    error_message = "container_image must come from the ACR managed by this production root."
  }
}

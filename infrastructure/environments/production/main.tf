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

locals {
  database_url = "postgresql+psycopg://${replace(urlencode(var.postgresql_username), "+", "%20")}:${replace(urlencode(var.postgresql_password), "+", "%20")}@${data.azurerm_postgresql_flexible_server.existing.fqdn}:${var.postgresql_port}/${replace(urlencode(var.postgresql_database_name), "+", "%20")}?sslmode=${var.postgresql_sslmode}&sslrootcert=/etc/ssl/certs/azure-postgresql-roots.pem"
}

module "rooms_backend" {
  source = "../../modules/rooms_backend"

  environment                    = "production"
  location                       = var.location
  resource_group_name            = var.resource_group_name
  create_resource_group          = var.create_resource_group
  container_registry_name        = var.container_registry_name
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
    database-url = local.database_url
  })
  secret_environment_variables = merge(var.secret_environment_variables, {
    DATABASE_URL = "database-url"
  })
  tags = merge(var.tags, {
    application = "rooms-marketplace"
    environment = "production"
  })
}

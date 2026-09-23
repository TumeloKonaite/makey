module "rooms_backend" {
  source = "../../modules/rooms_backend"

  environment                    = "local"
  location                       = var.location
  resource_group_name            = "rg-rooms-local-floci"
  container_registry_name        = "roomsflocilocal"
  use_acr_managed_identity       = false
  log_analytics_workspace_name   = "log-rooms-local-floci"
  enable_log_analytics           = false
  container_app_environment_name = "cae-rooms-local-floci"
  container_app_name             = "ca-rooms-api-local-floci"
  container_image                = var.container_image
  container_port                 = var.container_port
  cpu                            = 0.5
  memory                         = "1Gi"
  min_replicas                   = 1
  max_replicas                   = 1
  environment_variables          = var.environment_variables
  secrets                        = var.secrets
  secret_environment_variables   = var.secret_environment_variables
  tags                           = var.tags
  enable_tags                    = false
}

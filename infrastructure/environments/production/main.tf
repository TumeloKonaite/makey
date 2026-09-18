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
  environment_variables          = var.environment_variables
  secrets                        = var.secrets
  secret_environment_variables   = var.secret_environment_variables
  tags                           = var.tags
}


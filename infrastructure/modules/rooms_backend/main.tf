locals {
  resource_group_name = var.resource_group_name
  resource_group_id   = var.create_resource_group ? azurerm_resource_group.this[0].id : data.azurerm_resource_group.this[0].id
  common_tags = var.enable_tags ? merge(var.tags, {
    environment = var.environment
    managed-by  = "terraform"
  }) : {}
  acr_pull_identity_id = var.use_acr_managed_identity ? azurerm_user_assigned_identity.acr_pull[0].id : null
}

resource "azurerm_user_assigned_identity" "acr_pull" {
  count = var.use_acr_managed_identity ? 1 : 0

  name                = "${substr(var.container_app_name, 0, 24)}-acr"
  resource_group_name = local.resource_group_name
  location            = var.location
  tags                = local.common_tags

  depends_on = [azurerm_resource_group.this]
}

resource "azurerm_role_assignment" "acr_pull" {
  count = var.use_acr_managed_identity ? 1 : 0

  scope                            = azurerm_container_registry.this.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_user_assigned_identity.acr_pull[0].principal_id
  skip_service_principal_aad_check = true
}

resource "azurerm_container_app_job" "migrations" {
  count                        = var.enable_migration_job ? 1 : 0
  name                         = coalesce(var.migration_job_name, "${var.container_app_name}-migrations")
  location                     = var.location
  resource_group_name          = local.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  replica_retry_limit          = var.migration_job_retry_limit
  replica_timeout_in_seconds   = var.migration_job_timeout_seconds
  tags                         = local.common_tags

  dynamic "identity" {
    for_each = var.use_acr_managed_identity ? [1] : []
    content {
      type         = "SystemAssigned, UserAssigned"
      identity_ids = [local.acr_pull_identity_id]
    }
  }
  dynamic "secret" {
    for_each = var.use_acr_managed_identity ? [] : [1]
    content {
      name  = "registry-password"
      value = azurerm_container_registry.this.admin_password
    }
  }
  dynamic "secret" {
    for_each = nonsensitive(toset(values(var.migration_secret_environment_variables)))
    content {
      name  = secret.value
      value = var.secrets[secret.value]
    }
  }
  dynamic "registry" {
    for_each = var.use_acr_managed_identity ? [1] : []
    content {
      server   = azurerm_container_registry.this.login_server
      identity = local.acr_pull_identity_id
    }
  }
  dynamic "registry" {
    for_each = var.use_acr_managed_identity ? [] : [1]
    content {
      server               = azurerm_container_registry.this.login_server
      username             = azurerm_container_registry.this.admin_username
      password_secret_name = "registry-password"
    }
  }
  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }
  template {
    container {
      name    = "alembic"
      image   = var.container_image
      cpu     = var.migration_job_cpu
      memory  = var.migration_job_memory
      command = ["/bin/sh"]
      args = [
        "-c",
        "alembic -c /app/alembic.ini upgrade head && python /app/app/scripts/verify_migration_state.py",
      ]
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      dynamic "env" {
        for_each = var.migration_secret_environment_variables
        content {
          name        = env.key
          secret_name = env.value
        }
      }
    }
  }
  depends_on = [azurerm_resource_group.this, azurerm_role_assignment.acr_pull]
}

resource "azurerm_resource_group" "this" {
  count = var.create_resource_group ? 1 : 0

  name     = var.resource_group_name
  location = var.location
  tags     = local.common_tags
}

data "azurerm_resource_group" "this" {
  count = var.create_resource_group ? 0 : 1

  name = var.resource_group_name
}

resource "azurerm_container_registry" "this" {
  name                = var.container_registry_name
  resource_group_name = local.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = !var.use_acr_managed_identity
  tags                = local.common_tags

  depends_on = [azurerm_resource_group.this]

  lifecycle {
    # Floci omits this AzureRM default on read; the effective default remains Legacy.
    ignore_changes = [role_assignment_mode]
  }
}

resource "azurerm_log_analytics_workspace" "this" {
  count = var.enable_log_analytics ? 1 : 0

  name                = var.log_analytics_workspace_name
  resource_group_name = local.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.common_tags

  depends_on = [azurerm_resource_group.this]
}

resource "azurerm_container_app_environment" "this" {
  name                       = var.container_app_environment_name
  resource_group_name        = local.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = var.enable_log_analytics ? azurerm_log_analytics_workspace.this[0].id : null
  tags                       = local.common_tags
}

resource "azurerm_container_app" "this" {
  name                         = var.container_app_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = local.resource_group_name
  revision_mode                = "Single"
  tags                         = local.common_tags

  dynamic "identity" {
    for_each = var.use_acr_managed_identity ? [1] : []
    content {
      type         = "SystemAssigned, UserAssigned"
      identity_ids = [local.acr_pull_identity_id]
    }
  }

  dynamic "secret" {
    for_each = var.use_acr_managed_identity ? [] : [1]
    content {
      name  = "registry-password"
      value = azurerm_container_registry.this.admin_password
    }
  }

  dynamic "secret" {
    for_each = nonsensitive(toset(keys(var.secrets)))
    content {
      name  = secret.value
      value = var.secrets[secret.value]
    }
  }

  dynamic "registry" {
    for_each = var.use_acr_managed_identity ? [1] : []
    content {
      server   = azurerm_container_registry.this.login_server
      identity = local.acr_pull_identity_id
    }
  }

  dynamic "registry" {
    for_each = var.use_acr_managed_identity ? [] : [1]
    content {
      server               = azurerm_container_registry.this.login_server
      username             = azurerm_container_registry.this.admin_username
      password_secret_name = "registry-password"
    }
  }

  ingress {
    external_enabled           = true
    target_port                = var.container_port
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "api"
      image  = var.container_image
      cpu    = var.cpu
      memory = var.memory

      dynamic "env" {
        for_each = merge(var.environment_variables, {
          ENVIRONMENT = var.environment
          PORT        = tostring(var.container_port)
        })
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_environment_variables
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      liveness_probe {
        transport               = "HTTP"
        port                    = var.container_port
        path                    = var.health_path
        interval_seconds        = 30
        timeout                 = 5
        failure_count_threshold = 3
      }

      startup_probe {
        transport               = "HTTP"
        port                    = var.container_port
        path                    = var.health_path
        interval_seconds        = 5
        timeout                 = 5
        failure_count_threshold = 24
      }

      readiness_probe {
        transport               = "HTTP"
        port                    = var.container_port
        path                    = var.readiness_path
        interval_seconds        = 10
        timeout                 = 5
        failure_count_threshold = 3
        success_count_threshold = 1
      }
    }
  }

  depends_on = [azurerm_role_assignment.acr_pull]
}

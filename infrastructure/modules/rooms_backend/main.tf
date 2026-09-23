locals {
  resource_group_name = var.resource_group_name
  resource_group_id   = var.create_resource_group ? azurerm_resource_group.this[0].id : data.azurerm_resource_group.this[0].id
  common_tags = var.enable_tags ? merge(var.tags, {
    environment = var.environment
    managed-by  = "terraform"
  }) : {}
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
  admin_enabled       = true
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

  secret {
    name  = "registry-password"
    value = azurerm_container_registry.this.admin_password
  }

  dynamic "secret" {
    for_each = nonsensitive(toset(keys(var.secrets)))
    content {
      name  = secret.value
      value = var.secrets[secret.value]
    }
  }

  registry {
    server               = azurerm_container_registry.this.login_server
    username             = azurerm_container_registry.this.admin_username
    password_secret_name = "registry-password"
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
}

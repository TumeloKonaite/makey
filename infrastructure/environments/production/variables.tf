variable "subscription_id" {
  description = "Target Azure subscription ID."
  type        = string
}

variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "create_resource_group" {
  type    = bool
  default = false
}
variable "container_registry_name" { type = string }
variable "log_analytics_workspace_name" { type = string }
variable "container_app_environment_name" { type = string }
variable "container_app_name" { type = string }
variable "container_image" { type = string }
variable "container_port" {
  type    = number
  default = 8000
}
variable "cpu" {
  type    = number
  default = 0.5
}
variable "memory" {
  type    = string
  default = "1Gi"
}
variable "min_replicas" {
  type    = number
  default = 0
}
variable "max_replicas" {
  type    = number
  default = 1
}
variable "environment_variables" {
  type    = map(string)
  default = {}
}
variable "secrets" {
  type      = map(string)
  sensitive = true
  default   = {}
}
variable "secret_environment_variables" {
  type    = map(string)
  default = {}
}
variable "tags" {
  type    = map(string)
  default = {}
}

variable "frontend_origin" {
  description = "Exact HTTPS origin of the production frontend."
  type        = string

  validation {
    condition     = startswith(var.frontend_origin, "https://") && !strcontains(var.frontend_origin, "*")
    error_message = "frontend_origin must be an exact HTTPS origin."
  }
}

variable "postgresql_resource_group_name" {
  type = string
}

variable "postgresql_server_name" {
  type = string
}

variable "postgresql_database_name" {
  type = string
}

variable "postgresql_username" {
  type = string
}

variable "postgresql_password" {
  type      = string
  sensitive = true
}

variable "postgresql_port" {
  type    = number
  default = 5432

  validation {
    condition     = var.postgresql_port == 5432
    error_message = "The existing PostgreSQL server must use port 5432."
  }
}

variable "postgresql_sslmode" {
  type    = string
  default = "verify-full"

  validation {
    condition     = var.postgresql_sslmode == "verify-full"
    error_message = "The production database connection must verify the server certificate and hostname."
  }
}

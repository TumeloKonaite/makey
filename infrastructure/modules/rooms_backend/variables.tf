variable "environment" {
  description = "Deployment environment name exposed to the application."
  type        = string
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group to create or reuse."
  type        = string
}

variable "create_resource_group" {
  description = "Create the resource group when true; otherwise reuse an existing group."
  type        = bool
  default     = true
}

variable "container_registry_name" {
  description = "Globally unique, alphanumeric Azure Container Registry name."
  type        = string
}

variable "log_analytics_workspace_name" {
  description = "Log Analytics workspace name."
  type        = string
}

variable "enable_log_analytics" {
  description = "Create and attach a Log Analytics workspace. Disable only for emulators that cannot satisfy AzureRM workspace preflight calls."
  type        = bool
  default     = true
}

variable "container_app_environment_name" {
  description = "Azure Container Apps managed environment name."
  type        = string
}

variable "container_app_name" {
  description = "FastAPI Container App name."
  type        = string
}

variable "container_image" {
  description = "Fully qualified image reference, including an immutable tag or digest in production."
  type        = string
}

variable "container_port" {
  description = "Port on which the FastAPI container listens."
  type        = number
  default     = 8000

  validation {
    condition     = var.container_port > 0 && var.container_port < 65536
    error_message = "container_port must be between 1 and 65535."
  }
}

variable "cpu" {
  description = "Container CPU cores."
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Container memory, using the Container Apps format (for example 1Gi)."
  type        = string
  default     = "1Gi"
}

variable "min_replicas" {
  description = "Minimum active replicas."
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum active replicas."
  type        = number
  default     = 3

  validation {
    condition     = var.max_replicas >= var.min_replicas
    error_message = "max_replicas must be greater than or equal to min_replicas."
  }
}

variable "environment_variables" {
  description = "Non-sensitive runtime environment variables."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Container App secrets. Supply values outside version control."
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "secret_environment_variables" {
  description = "Map of application environment-variable name to a key in secrets."
  type        = map(string)
  default     = {}

  validation {
    condition     = alltrue([for secret_name in values(var.secret_environment_variables) : contains(keys(var.secrets), secret_name)])
    error_message = "Every secret_environment_variables value must name a key in secrets."
  }
}

variable "health_path" {
  description = "FastAPI liveness and readiness endpoint."
  type        = string
  default     = "/health"
}

variable "tags" {
  description = "Tags applied to all taggable resources."
  type        = map(string)
  default     = {}
}

variable "enable_tags" {
  description = "Apply standard and supplied tags. Disable only for emulators that do not round-trip ARM tags."
  type        = bool
  default     = true
}

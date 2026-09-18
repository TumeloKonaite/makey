variable "subscription_id" {
  description = "Target Azure subscription ID."
  type        = string
}

variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "create_resource_group" {
  type    = bool
  default = true
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
  default = 1
}
variable "max_replicas" {
  type    = number
  default = 3
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


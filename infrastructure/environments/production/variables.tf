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
variable "migration_job_name" {
  type    = string
  default = "ca-rooms-db-migrate-prod"
}
variable "container_image" {
  description = "Production ACR image reference tagged with the full lowercase Git commit SHA."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9]+\\.azurecr\\.io/[a-z0-9._/-]+:[0-9a-f]{40}$", var.container_image))
    error_message = "container_image must be an ACR image reference tagged with the full 40-character lowercase Git SHA."
  }
}
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

variable "database_url" {
  description = "Production PostgreSQL SQLAlchemy connection URL."
  type        = string
  sensitive   = true
  validation {
    condition     = startswith(var.database_url, "postgresql+psycopg://") && strcontains(lower(var.database_url), "sslmode=verify-full") && (strcontains(lower(var.database_url), "sslrootcert=%2fetc%2fssl%2fcerts%2fazure-postgresql-roots.pem") || strcontains(lower(var.database_url), "sslrootcert=/etc/ssl/certs/azure-postgresql-roots.pem"))
    error_message = "database_url must use psycopg, sslmode=verify-full, and the Azure root bundle path."
  }
}

variable "clerk_secret_key" {
  description = "Production Clerk backend secret key."
  type        = string
  sensitive   = true
}

variable "clerk_webhook_secret" {
  description = "Production Clerk webhook signing secret."
  type        = string
  sensitive   = true
}

variable "object_storage_access_key" {
  description = "HMAC access ID for the production GCS bucket S3-compatible XML API."
  type        = string
  sensitive   = true
}

variable "object_storage_secret_key" {
  description = "HMAC secret for the production GCS bucket S3-compatible XML API."
  type        = string
  sensitive   = true
}

variable "object_storage_endpoint" {
  description = "Production GCS S3-compatible XML API endpoint."
  type        = string
  default     = "https://storage.googleapis.com"
}

variable "object_storage_region" {
  description = "Region of the retained production GCS bucket."
  type        = string
  default     = "us-central1"
}

variable "object_storage_bucket" {
  description = "Name of the retained production listing-image bucket."
  type        = string
  default     = "makey"
}

variable "object_storage_public_url" {
  description = "Public base URL used to construct existing listing-image URLs."
  type        = string
  default     = "https://storage.googleapis.com"
}

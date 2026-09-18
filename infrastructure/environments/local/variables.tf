variable "location" {
  description = "Emulated Azure location."
  type        = string
  default     = "eastus"
}

variable "container_image" {
  description = "Image Floci starts in real Container Apps mode."
  type        = string
  default     = "nginx:1.27-alpine"
}

variable "container_port" {
  description = "Container listener port. The nginx default image uses 80."
  type        = number
  default     = 80
}

variable "environment_variables" {
  description = "Non-sensitive local application settings."
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Fake local-only Container App secret values."
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "secret_environment_variables" {
  description = "Map of environment-variable names to keys in secrets."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Local resource tags."
  type        = map(string)
  default = {
    application = "rooms-marketplace"
    purpose     = "floci-development"
  }
}


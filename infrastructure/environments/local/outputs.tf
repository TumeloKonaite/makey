output "backend_fqdn" {
  description = "Emulated Container App FQDN; send it as the Host header to Floci."
  value       = module.rooms_backend.container_app_fqdn
}

output "backend_url" {
  description = "Floci ingress endpoint. Use backend_fqdn as the Host header."
  value       = "http://localhost:4577"
}

output "container_registry_login_server" {
  value = module.rooms_backend.container_registry_login_server
}


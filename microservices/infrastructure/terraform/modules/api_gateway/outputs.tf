output "kong_namespace" {
  description = "Kubernetes namespace where Kong is deployed"
  value       = kubernetes_namespace.kong.metadata[0].name
}

output "kong_admin_service" {
  description = "Kong Admin Service"
  value       = "${helm_release.kong.name}-kong-admin"
}

output "kong_proxy_service" {
  description = "Kong Proxy Service"
  value       = "${helm_release.kong.name}-kong-proxy"
} 
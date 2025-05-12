terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }
}

provider "helm" {
  kubernetes {
    host                   = var.eks_endpoint
    cluster_ca_certificate = base64decode(var.eks_cluster_ca_data)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      args        = ["eks", "get-token", "--cluster-name", var.cluster_name]
      command     = "aws"
    }
  }
}

provider "kubernetes" {
  host                   = var.eks_endpoint
  cluster_ca_certificate = base64decode(var.eks_cluster_ca_data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    args        = ["eks", "get-token", "--cluster-name", var.cluster_name]
    command     = "aws"
  }
}

# Create a namespace for Kong
resource "kubernetes_namespace" "kong" {
  metadata {
    name = "kong"
    labels = {
      app = "kong"
    }
  }
}

# Install Kong API Gateway using Helm
resource "helm_release" "kong" {
  name       = "kong"
  repository = "https://charts.konghq.com"
  chart      = "kong"
  namespace  = kubernetes_namespace.kong.metadata[0].name
  version    = var.kong_chart_version

  values = [
    templatefile("${path.module}/templates/kong-values.yaml", {
      enable_mtls             = var.enable_mtls
      rate_limiting_enabled   = var.enable_rate_limiting
      ingress_class_name      = "kong"
      replica_count           = var.kong_replica_count
      enable_proxy_service    = true
      enable_admin_service    = true
      enable_manager_service  = true
      enable_portal_service   = true
      enable_database         = var.kong_database_enabled
      pvc_storage_class_name  = var.pvc_storage_class_name
      pvc_storage_size        = var.pvc_storage_size
    })
  ]

  depends_on = [
    kubernetes_namespace.kong
  ]
}

# Create Kong plugin configurations for mTLS
resource "kubernetes_manifest" "kong_mtls_plugin" {
  count = var.enable_mtls ? 1 : 0

  manifest = {
    apiVersion = "configuration.konghq.com/v1"
    kind       = "KongPlugin"
    metadata = {
      name      = "mtls-auth"
      namespace = kubernetes_namespace.kong.metadata[0].name
    }
    config = {
      name       = "mtls-auth"
      cert_depth = 1
      skip_consumer_lookup = false
    }
  }

  depends_on = [
    helm_release.kong
  ]
}

# Create Kong plugin configurations for rate limiting
resource "kubernetes_manifest" "kong_rate_limiting_plugin" {
  count = var.enable_rate_limiting ? 1 : 0

  manifest = {
    apiVersion = "configuration.konghq.com/v1"
    kind       = "KongPlugin"
    metadata = {
      name      = "rate-limiting"
      namespace = kubernetes_namespace.kong.metadata[0].name
    }
    config = {
      name                = "rate-limiting"
      second              = var.rate_limit_per_second
      minute              = var.rate_limit_per_minute
      hour                = var.rate_limit_per_hour
      policy              = "local"
      limit_by            = "ip"
      hide_client_headers = false
    }
  }

  depends_on = [
    helm_release.kong
  ]
} 
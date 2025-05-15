variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where API Gateway will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the API Gateway"
  type        = list(string)
}

variable "eks_endpoint" {
  description = "EKS cluster endpoint"
  type        = string
}

variable "eks_cluster_ca_data" {
  description = "EKS cluster CA certificate data"
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
}

variable "kong_chart_version" {
  description = "Version of the Kong Helm chart to use"
  type        = string
  default     = "2.20.1"
}

variable "enable_mtls" {
  description = "Whether to enable mTLS for the Kong API Gateway"
  type        = bool
  default     = true
}

variable "enable_rate_limiting" {
  description = "Whether to enable rate limiting for the Kong API Gateway"
  type        = bool
  default     = true
}

variable "kong_replica_count" {
  description = "Number of Kong replicas to run"
  type        = number
  default     = 2
}

variable "kong_database_enabled" {
  description = "Whether to enable a database for Kong"
  type        = bool
  default     = true
}

variable "pvc_storage_class_name" {
  description = "Storage class name for Kong PVCs"
  type        = string
  default     = "gp2"
}

variable "pvc_storage_size" {
  description = "Storage size for Kong PVCs"
  type        = string
  default     = "10Gi"
}

variable "rate_limit_per_second" {
  description = "Number of requests allowed per second"
  type        = number
  default     = 10
}

variable "rate_limit_per_minute" {
  description = "Number of requests allowed per minute"
  type        = number
  default     = 100
}

variable "rate_limit_per_hour" {
  description = "Number of requests allowed per hour"
  type        = number
  default     = 1000
} 
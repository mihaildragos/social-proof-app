variable "cluster_name" {
  description = "Name of the ElastiCache Redis cluster"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where ElastiCache Redis will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ElastiCache Redis cluster"
  type        = list(string)
}

variable "client_security_group_id" {
  description = "Security group ID for clients connecting to Redis"
  type        = string
}

variable "node_type" {
  description = "Instance type for Redis nodes"
  type        = string
  default     = "cache.t3.medium"
}

variable "num_cache_nodes" {
  description = "Number of Redis nodes in the cluster"
  type        = number
  default     = 2
}

variable "redis_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.0"
} 
variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "social-proof-app"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "eu-west-2"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["eu-west-2a", "eu-west-2b", "eu-west-2c"]
}

variable "private_subnets" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_subnets" {
  description = "CIDR blocks for database subnets"
  type        = list(string)
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}

variable "eks_nodes_instance_type" {
  description = "Instance type for EKS nodes"
  type        = string
  default     = "t3.medium"
}

variable "eks_node_group_min_size" {
  description = "Minimum size of EKS node group"
  type        = number
  default     = 2
}

variable "eks_node_group_max_size" {
  description = "Maximum size of EKS node group"
  type        = number
  default     = 5
}

variable "kafka_version" {
  description = "Kafka version for MSK cluster"
  type        = string
  default     = "2.8.1"
}

variable "kafka_broker_instance_type" {
  description = "Instance type for Kafka brokers"
  type        = string
  default     = "kafka.m5.large"
}

variable "kafka_broker_count" {
  description = "Number of Kafka brokers"
  type        = number
  default     = 3
}

variable "rds_instance_class" {
  description = "Instance class for RDS"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS (GB)"
  type        = number
  default     = 20
}

variable "rds_multi_az" {
  description = "Enable multi-AZ for RDS"
  type        = bool
  default     = true
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "redis_node_type" {
  description = "Node type for ElastiCache Redis"
  type        = string
  default     = "cache.t3.medium"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes for Redis"
  type        = number
  default     = 2
}

variable "clickhouse_instance_type" {
  description = "Instance type for ClickHouse servers"
  type        = string
  default     = "m5.xlarge"
}

variable "clickhouse_volume_size" {
  description = "Volume size for ClickHouse (GB)"
  type        = number
  default     = 100
}

# API Gateway variables
variable "enable_api_gateway_mtls" {
  description = "Enable mTLS for API Gateway"
  type        = bool
  default     = true
}

variable "enable_api_gateway_rate_limiting" {
  description = "Enable rate limiting for API Gateway"
  type        = bool
  default     = true
}

# Kubernetes configuration variables
variable "clerk_api_key" {
  description = "The API key for Clerk authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "The secret for JWT signing"
  type        = string
  sensitive   = true
  default     = ""
}

variable "cors_allowed_origins" {
  description = "Comma-separated list of allowed origins for CORS"
  type        = string
  default     = "https://app.socialproofapp.com,https://api.socialproofapp.com"
}

variable "log_level" {
  description = "The log level for the service"
  type        = string
  default     = "info"
}

variable "clerk_webhook_url" {
  description = "The webhook URL for Clerk authentication"
  type        = string
  default     = "https://api.socialproofapp.com/auth/clerk-webhook"
}

variable "token_expiry" {
  description = "The token expiry time in seconds"
  type        = string
  default     = "86400" # 24 hours
}

variable "refresh_token_expiry" {
  description = "The refresh token expiry time in seconds"
  type        = string
  default     = "2592000" # 30 days
} 
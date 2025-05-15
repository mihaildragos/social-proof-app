variable "db_name" {
  description = "Name of the database"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where RDS will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the RDS database"
  type        = list(string)
}

variable "client_security_group_id" {
  description = "Security group ID for clients connecting to RDS"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  description = "The allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_username" {
  description = "Username for the database"
  type        = string
  default     = "postgres"
}

variable "db_password" {
  description = "Password for the database (if empty, a random password will be generated)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "multi_az" {
  description = "Whether to enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "create_init_lambda" {
  description = "Whether to create a Lambda function to initialize the database with RLS policies"
  type        = bool
  default     = false
} 
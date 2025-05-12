variable "cluster_name" {
  description = "Name of the ClickHouse cluster"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where ClickHouse will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the ClickHouse instance"
  type        = list(string)
}

variable "client_security_group_id" {
  description = "Security group ID for clients connecting to ClickHouse"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type for ClickHouse"
  type        = string
  default     = "r5.xlarge"
}

variable "volume_size" {
  description = "Size of the EBS volume for ClickHouse data in GB"
  type        = number
  default     = 100
}

variable "ami_id" {
  description = "AMI ID for ClickHouse instance (optional, will use Amazon Linux 2 if not specified)"
  type        = string
  default     = ""
}

variable "key_name" {
  description = "SSH key name for ClickHouse instance (optional)"
  type        = string
  default     = ""
}

variable "aws_region" {
  description = "AWS region for S3 endpoint"
  type        = string
  default     = "us-west-2"
} 
variable "cluster_name" {
  description = "Name of the MSK cluster"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where MSK will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the MSK brokers"
  type        = list(string)
}

variable "client_subnets" {
  description = "List of CIDR blocks for client access"
  type        = list(string)
}

variable "kafka_version" {
  description = "Version of Kafka to use for the MSK cluster"
  type        = string
  default     = "3.5.1"
}

variable "broker_instance_type" {
  description = "Instance type to use for MSK brokers"
  type        = string
  default     = "kafka.m5.large"
}

variable "broker_count" {
  description = "Number of broker nodes in the MSK cluster"
  type        = number
  default     = 3
}

variable "broker_volume_size" {
  description = "Size of the EBS volume for each broker node (in GiB)"
  type        = number
  default     = 100
} 
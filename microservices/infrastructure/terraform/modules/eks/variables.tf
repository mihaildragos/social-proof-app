variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where EKS will be created"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for EKS cluster and nodes"
  type        = list(string)
}

variable "kubernetes_version" {
  description = "Kubernetes version to use for the EKS cluster"
  type        = string
  default     = "1.28"
}

variable "nodes_instance_type" {
  description = "EC2 instance type for EKS worker nodes"
  type        = string
  default     = "t3.medium"
}

variable "node_group_desired_size" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_group_min_size" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

variable "node_group_max_size" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 4
} 
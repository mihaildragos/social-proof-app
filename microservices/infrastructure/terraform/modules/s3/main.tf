variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "enable_lifecycle" {
  description = "Enable lifecycle rules for S3 buckets"
  type        = bool
  default     = false
}

# Create main artifacts bucket
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project_name}-${var.environment}-artifacts"

  tags = {
    Name        = "${var.project_name}-${var.environment}-artifacts"
    Environment = var.environment
  }
}

# Create logs bucket
resource "aws_s3_bucket" "logs" {
  bucket = "${var.project_name}-${var.environment}-logs"

  tags = {
    Name        = "${var.project_name}-${var.environment}-logs"
    Environment = var.environment
  }
}

# Setup lifecycle configuration if enabled
resource "aws_s3_bucket_lifecycle_configuration" "logs_lifecycle" {
  count  = var.enable_lifecycle ? 1 : 0
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "archive-old-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# Outputs
output "artifacts_bucket_name" {
  value = aws_s3_bucket.artifacts.bucket
}

output "artifacts_bucket_arn" {
  value = aws_s3_bucket.artifacts.arn
}

output "logs_bucket_name" {
  value = aws_s3_bucket.logs.bucket
}

output "logs_bucket_arn" {
  value = aws_s3_bucket.logs.arn
} 
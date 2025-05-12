output "db_instance_id" {
  description = "The RDS instance ID"
  value       = aws_db_instance.postgres.id
}

output "db_instance_address" {
  description = "The address of the RDS instance"
  value       = aws_db_instance.postgres.address
}

output "db_instance_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.postgres.endpoint
}

output "db_instance_name" {
  description = "The database name"
  value       = aws_db_instance.postgres.db_name
}

output "db_instance_port" {
  description = "The database port"
  value       = aws_db_instance.postgres.port
}

output "db_instance_username" {
  description = "The master username for the database"
  value       = aws_db_instance.postgres.username
}

output "db_instance_arn" {
  description = "The ARN of the RDS instance"
  value       = aws_db_instance.postgres.arn
}

output "db_subnet_group_id" {
  description = "The db subnet group name"
  value       = aws_db_subnet_group.postgres.id
}

output "db_parameter_group_id" {
  description = "The db parameter group name"
  value       = aws_db_parameter_group.postgres.id
}

output "db_security_group_id" {
  description = "The security group ID"
  value       = aws_security_group.postgres.id
}

output "secrets_manager_secret_arn" {
  description = "The ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.postgres_credentials.arn
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket for database backups"
  value       = aws_s3_bucket.postgres_backups.bucket
} 
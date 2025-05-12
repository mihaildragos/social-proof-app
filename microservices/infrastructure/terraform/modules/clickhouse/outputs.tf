output "clickhouse_instance_id" {
  description = "ID of the ClickHouse EC2 instance"
  value       = aws_instance.clickhouse.id
}

output "clickhouse_private_ip" {
  description = "Private IP address of the ClickHouse instance"
  value       = aws_instance.clickhouse.private_ip
}

output "clickhouse_http_endpoint" {
  description = "HTTP endpoint for the ClickHouse instance"
  value       = "http://${aws_instance.clickhouse.private_ip}:8123"
}

output "clickhouse_native_endpoint" {
  description = "Native protocol endpoint for the ClickHouse instance"
  value       = "${aws_instance.clickhouse.private_ip}:9000"
}

output "clickhouse_security_group_id" {
  description = "Security group ID for the ClickHouse instance"
  value       = aws_security_group.clickhouse.id
}

output "clickhouse_s3_bucket" {
  description = "S3 bucket for ClickHouse data"
  value       = aws_s3_bucket.clickhouse_data.bucket
} 
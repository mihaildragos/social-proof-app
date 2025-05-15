output "bootstrap_brokers" {
  description = "Connection host:port pairs for the MSK brokers (plaintext)"
  value       = aws_msk_cluster.this.bootstrap_brokers
}

output "bootstrap_brokers_tls" {
  description = "Connection host:port pairs for the MSK brokers (TLS)"
  value       = aws_msk_cluster.this.bootstrap_brokers_tls
}

output "zookeeper_connect_string" {
  description = "Connection string for Zookeeper"
  value       = aws_msk_cluster.this.zookeeper_connect_string
}

output "security_group_id" {
  description = "Security group ID for the MSK cluster"
  value       = aws_security_group.msk.id
}

output "cluster_arn" {
  description = "ARN of the MSK cluster"
  value       = aws_msk_cluster.this.arn
}

output "cluster_name" {
  description = "Name of the MSK cluster"
  value       = aws_msk_cluster.this.cluster_name
} 
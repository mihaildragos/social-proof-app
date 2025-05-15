terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Security group for ElastiCache
resource "aws_security_group" "redis" {
  name        = "${var.cluster_name}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.client_security_group_id]
    description     = "Allow Redis traffic from client security group"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.cluster_name}-redis-sg"
    Environment = var.environment
  }
}

# Subnet group for ElastiCache
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.cluster_name}-redis-subnet-group"
  subnet_ids = var.subnet_ids
}

# Parameter group for Redis
resource "aws_elasticache_parameter_group" "redis" {
  name   = "${var.cluster_name}-redis-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "slowlog-log-slower-than"
    value = "1000"
  }
}

# ElastiCache Redis cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.cluster_name}-redis"
  description                   = "Redis cluster for ${var.cluster_name}"
  node_type                     = var.node_type
  num_cache_clusters            = var.num_cache_nodes
  port                          = 6379
  parameter_group_name          = aws_elasticache_parameter_group.redis.name
  subnet_group_name             = aws_elasticache_subnet_group.redis.name
  security_group_ids            = [aws_security_group.redis.id]
  automatic_failover_enabled    = var.num_cache_nodes > 1 ? true : false
  auto_minor_version_upgrade    = true
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true
  multi_az_enabled              = var.num_cache_nodes > 1 ? true : false
  maintenance_window            = "sun:03:00-sun:04:00"
  snapshot_window               = "00:00-01:00"
  snapshot_retention_limit      = 7
  final_snapshot_identifier     = null  # Disable final snapshot to avoid conflicts
  apply_immediately             = true
  engine_version                = var.redis_version
  
  tags = {
    Name        = "${var.cluster_name}-redis"
    Environment = var.environment
  }
} 
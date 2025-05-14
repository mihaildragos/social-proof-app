terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Security group for RDS PostgreSQL
resource "aws_security_group" "postgres" {
  name        = "${var.db_name}-postgres-sg"
  description = "Security group for PostgreSQL RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.client_security_group_id]
    description     = "PostgreSQL access from clients"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.db_name}-postgres-sg"
    Environment = var.environment
  }
}

# Subnet group for RDS
resource "aws_db_subnet_group" "postgres" {
  name       = "${var.db_name}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "${var.db_name}-subnet-group"
    Environment = var.environment
  }
}

# Parameter group for PostgreSQL with TimescaleDB and Supabase/RLS settings
resource "aws_db_parameter_group" "postgres" {
  name   = "${replace(lower(var.db_name), "_", "-")}-params"
  family = "postgres14"

  # TimescaleDB extension parameters
  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements,pgcrypto,pg_cron,pg_net,pgsodium,pg_graphql,pg_stat_monitor,pg_jsonschema,pg_partman,timescaledb"
  }

  parameter {
    name  = "max_connections"
    value = "200"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "2000" # log statements running longer than 2 seconds
  }

  # Security settings
  parameter {
    name  = "row_security"
    value = "on" # Enable Row-Level Security
  }

  tags = {
    Name        = "${var.db_name}-params"
    Environment = var.environment
  }
}

# KMS key for RDS encryption
resource "aws_kms_key" "postgres" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "${var.db_name}-kms"
    Environment = var.environment
  }
}

# Create the PostgreSQL instance
resource "aws_db_instance" "postgres" {
  identifier             = lower(replace(var.db_name, "_", "-"))
  engine                 = "postgres"
  engine_version         = "14.9" # Version compatible with Supabase
  instance_class         = var.instance_class
  allocated_storage      = var.allocated_storage
  max_allocated_storage  = var.allocated_storage * 2
  storage_type           = "gp3"
  storage_encrypted      = true
  kms_key_id             = aws_kms_key.postgres.arn
  db_name                = replace(var.db_name, "-", "_") # Replace hyphens with underscores for PostgreSQL
  username               = var.db_username
  password               = var.db_password != "" ? var.db_password : random_password.postgres_password[0].result
  port                   = 5432
  vpc_security_group_ids = [aws_security_group.postgres.id]
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  parameter_group_name   = aws_db_parameter_group.postgres.name
  publicly_accessible    = false
  skip_final_snapshot    = true
  copy_tags_to_snapshot  = true
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:30-Sun:05:30"
  multi_az               = var.multi_az
  deletion_protection    = var.environment == "prod" ? true : false
  apply_immediately      = true
  
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  performance_insights_enabled    = true
  
  tags = {
    Name        = "${var.db_name}-postgres"
    Environment = var.environment
  }
}

# Generate a random password if one is not provided
resource "random_password" "postgres_password" {
  count   = var.db_password == "" ? 1 : 0
  length  = 16
  special = false
}

# Store the database credentials in AWS Secrets Manager
resource "aws_secretsmanager_secret" "postgres_credentials" {
  name        = "${var.db_name}-credentials"
  description = "Database credentials for ${var.db_name}"
  kms_key_id  = aws_kms_key.postgres.arn
  
  tags = {
    Name        = "${var.db_name}-credentials"
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "postgres_credentials" {
  secret_id = aws_secretsmanager_secret.postgres_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = var.db_password != "" ? var.db_password : random_password.postgres_password[0].result
    engine   = "postgres"
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    dbname   = aws_db_instance.postgres.db_name
  })
}

# Create an S3 bucket for database backups and extensions
resource "aws_s3_bucket" "postgres_backups" {
  bucket = "${var.db_name}-backups-${random_id.this.hex}"

  tags = {
    Name        = "${var.db_name}-backups"
    Environment = var.environment
  }
}

# Server-side encryption for S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "postgres_backups" {
  bucket = aws_s3_bucket.postgres_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Random ID for S3 bucket name
resource "random_id" "this" {
  byte_length = 4
}

# Upload the SQL initialization script to S3
resource "aws_s3_object" "init_sql" {
  bucket = aws_s3_bucket.postgres_backups.id
  key    = "init/init.sql"
  content = file("${path.module}/templates/init.sql")
  etag   = filemd5("${path.module}/templates/init.sql")
}

# Lambda function to initialize the database (optional, only included for completeness)
resource "aws_lambda_function" "db_init" {
  count         = var.create_init_lambda ? 1 : 0
  filename      = "${path.module}/files/db_init_lambda.zip"
  function_name = "${var.db_name}-db-init"
  role          = aws_iam_role.db_init_lambda[0].arn
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 300

  environment {
    variables = {
      DB_SECRET_ARN = aws_secretsmanager_secret.postgres_credentials.arn
      INIT_SQL_BUCKET = aws_s3_bucket.postgres_backups.id
      INIT_SQL_KEY = aws_s3_object.init_sql.key
    }
  }

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.db_init_lambda[0].id]
  }

  tags = {
    Name        = "${var.db_name}-db-init"
    Environment = var.environment
  }
}

# Security group for the Lambda function
resource "aws_security_group" "db_init_lambda" {
  count       = var.create_init_lambda ? 1 : 0
  name        = "${var.db_name}-db-init-lambda-sg"
  description = "Security group for RDS initialization Lambda"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.db_name}-db-init-lambda-sg"
    Environment = var.environment
  }
}

# IAM role for the Lambda function
resource "aws_iam_role" "db_init_lambda" {
  count = var.create_init_lambda ? 1 : 0
  name  = "${var.db_name}-db-init-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.db_name}-db-init-lambda-role"
    Environment = var.environment
  }
}

# IAM policy for the Lambda function
resource "aws_iam_policy" "db_init_lambda" {
  count       = var.create_init_lambda ? 1 : 0
  name        = "${var.db_name}-db-init-lambda-policy"
  description = "Policy for RDS initialization Lambda"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Effect   = "Allow"
        Resource = "*"
      },
      {
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Effect   = "Allow"
        Resource = aws_secretsmanager_secret.postgres_credentials.arn
      },
      {
        Action = [
          "s3:GetObject"
        ]
        Effect   = "Allow"
        Resource = "${aws_s3_bucket.postgres_backups.arn}/*"
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "db_init_lambda" {
  count      = var.create_init_lambda ? 1 : 0
  role       = aws_iam_role.db_init_lambda[0].name
  policy_arn = aws_iam_policy.db_init_lambda[0].arn
} 
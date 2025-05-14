terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Security group for ClickHouse
resource "aws_security_group" "clickhouse" {
  name        = "${var.cluster_name}-clickhouse-sg"
  description = "Security group for ClickHouse cluster"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 8123
    to_port         = 8123
    protocol        = "tcp"
    security_groups = [var.client_security_group_id]
    description     = "HTTP interface"
  }

  ingress {
    from_port       = 9000
    to_port         = 9000
    protocol        = "tcp"
    security_groups = [var.client_security_group_id]
    description     = "Native interface"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "${var.cluster_name}-clickhouse-sg"
    Environment = var.environment
  }
}

# IAM role for EC2 instance
resource "aws_iam_role" "clickhouse" {
  name = "${var.cluster_name}-clickhouse-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM instance profile
resource "aws_iam_instance_profile" "clickhouse" {
  name = "${var.cluster_name}-clickhouse-profile"
  role = aws_iam_role.clickhouse.name
}

# Policy for S3 access
resource "aws_iam_policy" "clickhouse_s3" {
  name        = "${var.cluster_name}-clickhouse-s3-policy"
  description = "Allow ClickHouse to access S3 for backup/restore"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Effect   = "Allow"
        Resource = [
          "${aws_s3_bucket.clickhouse_data.arn}",
          "${aws_s3_bucket.clickhouse_data.arn}/*"
        ]
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "clickhouse_s3" {
  role       = aws_iam_role.clickhouse.name
  policy_arn = aws_iam_policy.clickhouse_s3.arn
}

# S3 bucket for ClickHouse data
resource "aws_s3_bucket" "clickhouse_data" {
  bucket = "${lower(var.cluster_name)}-clickhouse-data-${random_id.this.hex}"

  tags = {
    Name        = "${var.cluster_name}-clickhouse-data"
    Environment = var.environment
  }
}

# Server-side encryption for S3 bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "clickhouse_data" {
  bucket = aws_s3_bucket.clickhouse_data.id

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

# EBS volume for ClickHouse data
resource "aws_ebs_volume" "clickhouse_data" {
  availability_zone = var.subnet_ids[0] != null ? data.aws_subnet.selected[0].availability_zone : "eu-west-2a"
  size              = var.volume_size
  type              = "gp3"
  iops              = 3000
  throughput        = 125

  tags = {
    Name        = "${var.cluster_name}-clickhouse-data"
    Environment = var.environment
  }
}

# Get subnet information
data "aws_subnet" "selected" {
  count = length(var.subnet_ids) > 0 ? 1 : 0
  id    = var.subnet_ids[0]
}

# EC2 instance for ClickHouse
resource "aws_instance" "clickhouse" {
  ami                    = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_ids[0]
  vpc_security_group_ids = [aws_security_group.clickhouse.id]
  iam_instance_profile   = aws_iam_instance_profile.clickhouse.name
  key_name               = var.key_name != "" ? var.key_name : null
  
  user_data = <<-EOF
    #!/bin/bash
    yum update -y
    
    # Install ClickHouse
    yum install -y curl
    curl https://clickhouse.com/ | sh
    
    # Create config directory
    mkdir -p /etc/clickhouse-server/config.d/
    
    # Create users directory
    mkdir -p /etc/clickhouse-server/users.d/
    
    # Configure ClickHouse
    cat > /etc/clickhouse-server/config.d/storage.xml << 'XMLCONFIG'
    <clickhouse>
        <storage_configuration>
            <disks>
                <s3>
                    <type>s3</type>
                    <endpoint>https://s3.${var.aws_region}.amazonaws.com/${aws_s3_bucket.clickhouse_data.id}/</endpoint>
                    <use_environment_credentials>1</use_environment_credentials>
                </s3>
            </disks>
            <policies>
                <tiered>
                    <volumes>
                        <main>
                            <disk>default</disk>
                        </main>
                        <archive>
                            <disk>s3</disk>
                        </archive>
                    </volumes>
                </tiered>
            </policies>
        </storage_configuration>
    </clickhouse>
    XMLCONFIG
    
    # Allow remote connections
    cat > /etc/clickhouse-server/config.d/network.xml << 'XMLCONFIG'
    <clickhouse>
        <listen_host>::</listen_host>
        <http_port>8123</http_port>
        <tcp_port>9000</tcp_port>
        <interserver_http_port>9009</interserver_http_port>
    </clickhouse>
    XMLCONFIG
    
    # Create default database
    cat > /etc/clickhouse-server/config.d/default_database.xml << 'XMLCONFIG'
    <clickhouse>
        <default_database>social_proof</default_database>
    </clickhouse>
    XMLCONFIG
    
    # Start ClickHouse service
    systemctl start clickhouse-server
    systemctl enable clickhouse-server
    
    # Create the database
    clickhouse-client --query "CREATE DATABASE IF NOT EXISTS social_proof"
    
    # Create the time-series tables
    clickhouse-client --database=social_proof --query "
    CREATE TABLE notification_events (
        event_id UUID,
        notification_id UUID,
        site_id UUID,
        event_type String,
        visitor_id String,
        device_type String,
        browser String,
        os String,
        country_code String,
        city String,
        referrer String,
        page_url String,
        event_data String,
        created_at DateTime
    )
    ENGINE = MergeTree
    PARTITION BY toYYYYMM(created_at)
    ORDER BY (site_id, notification_id, created_at)
    SETTINGS index_granularity = 8192
    "
    
    # Create aggregate tables
    clickhouse-client --database=social_proof --query "
    CREATE MATERIALIZED VIEW notification_events_hourly
    ENGINE = SummingMergeTree
    PARTITION BY toYYYYMM(hour)
    ORDER BY (site_id, notification_id, event_type, hour)
    SETTINGS index_granularity = 8192
    AS
    SELECT
        site_id,
        notification_id,
        event_type,
        toStartOfHour(created_at) AS hour,
        count() AS event_count,
        uniq(visitor_id) AS unique_visitors,
        groupArray(10)(country_code) AS top_countries
    FROM notification_events
    GROUP BY site_id, notification_id, event_type, hour
    "
    
    # Wait for EBS volume to be attached
    while [ ! -e /dev/nvme1n1 ]; do
      echo "Waiting for EBS volume to be attached..."
      sleep 5
    done
    
    # Format and mount the EBS volume
    mkfs -t xfs /dev/nvme1n1
    mkdir -p /var/lib/clickhouse
    mount /dev/nvme1n1 /var/lib/clickhouse
    echo "/dev/nvme1n1 /var/lib/clickhouse xfs defaults 0 0" >> /etc/fstab
    chown -R clickhouse:clickhouse /var/lib/clickhouse
    
    # Restart ClickHouse to apply the changes
    systemctl restart clickhouse-server
  EOF

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
  }

  tags = {
    Name        = "${var.cluster_name}-clickhouse"
    Environment = var.environment
  }
}

# Allow inter-server communication (added after the instance is created)
resource "aws_security_group_rule" "inter_server" {
  type              = "ingress"
  from_port         = 9009
  to_port           = 9009
  protocol          = "tcp"
  cidr_blocks       = ["${aws_instance.clickhouse.private_ip}/32"]
  security_group_id = aws_security_group.clickhouse.id
  description       = "Inter-server communication"
}

# Volume attachment
resource "aws_volume_attachment" "clickhouse_data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.clickhouse_data.id
  instance_id = aws_instance.clickhouse.id
}

# Latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
} 
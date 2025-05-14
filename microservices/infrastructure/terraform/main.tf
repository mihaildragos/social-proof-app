terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
  }
  backend "s3" {
    bucket = "social-proof-app-terraform-state"
    key    = "infrastructure/terraform.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "social-proof-app"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source = "./modules/vpc"

  environment         = var.environment
  vpc_cidr            = var.vpc_cidr
  availability_zones  = var.availability_zones
  private_subnets     = var.private_subnets
  public_subnets      = var.public_subnets
  database_subnets    = var.database_subnets
}

module "eks" {
  source = "./modules/eks"

  environment         = var.environment
  cluster_name        = "${var.project_name}-${var.environment}"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  nodes_instance_type = var.eks_nodes_instance_type
  node_group_min_size = var.eks_node_group_min_size
  node_group_max_size = var.eks_node_group_max_size
}

module "msk" {
  source = "./modules/msk"

  environment        = var.environment
  cluster_name       = "${var.project_name}-${var.environment}-msk"
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  kafka_version      = var.kafka_version
  broker_instance_type = var.kafka_broker_instance_type
  broker_count       = var.kafka_broker_count
  client_subnets     = module.vpc.private_subnet_cidr_blocks
}

module "rds" {
  source = "./modules/rds"

  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.database_subnet_ids
  instance_class      = var.rds_instance_class
  allocated_storage   = var.rds_allocated_storage
  db_name             = "${var.project_name}_${var.environment}"
  db_username         = var.db_username
  multi_az            = var.rds_multi_az
  client_security_group_id = module.eks.node_security_group_id
}

module "elasticache" {
  source = "./modules/elasticache"

  environment         = var.environment
  cluster_name        = "${var.project_name}-${var.environment}-redis"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.database_subnet_ids
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  client_security_group_id = module.eks.node_security_group_id
}

module "clickhouse" {
  source = "./modules/clickhouse"

  environment         = var.environment
  cluster_name        = "${var.project_name}-${var.environment}-clickhouse"
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  instance_type       = var.clickhouse_instance_type
  volume_size         = var.clickhouse_volume_size
  client_security_group_id = module.eks.node_security_group_id
  aws_region          = var.aws_region
}

module "s3" {
  source = "./modules/s3"

  environment         = var.environment
  project_name        = var.project_name
  enable_lifecycle    = true
}

module "api_gateway" {
  source = "./modules/api_gateway"

  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  eks_cluster_ca_data = module.eks.cluster_ca_data
  eks_endpoint        = module.eks.cluster_endpoint
  cluster_name        = module.eks.cluster_name
  enable_mtls         = var.enable_api_gateway_mtls
  enable_rate_limiting = var.enable_api_gateway_rate_limiting
} 
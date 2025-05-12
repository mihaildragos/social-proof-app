# PostgreSQL RDS Module with Supabase and Row-Level Security

This Terraform module provisions a PostgreSQL RDS instance with Supabase compatibility and Row-Level Security (RLS) policies.

## Features

- PostgreSQL 14 with TimescaleDB extension
- Supabase-compatible configuration
- Row-Level Security (RLS) enabled by default
- Initialization script with schema and security policies
- Multi-AZ deployment option for high availability
- KMS encryption for data at rest
- Automated backups to S3
- Database credentials stored in AWS Secrets Manager

## Usage

```hcl
module "rds" {
  source = "./modules/rds"

  environment              = "dev"
  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.database_subnet_ids
  client_security_group_id = module.eks.node_security_group_id
  db_name                  = "social-proof-db"
  db_username              = var.db_username
  multi_az                 = true
  instance_class           = "db.t3.medium"
  allocated_storage        = 20
  create_init_lambda       = true
}
```

## Row-Level Security (RLS)

This module configures PostgreSQL with Row-Level Security (RLS) enabled, which is a core feature of Supabase. RLS allows you to define security policies that restrict which rows users can access in database tables.

### Included RLS Policies

The initialization script (`templates/init.sql`) sets up the following:

1. **User-based access control**: Users can only access their own data
2. **Organization-based isolation**: Data is isolated by organization
3. **Role-based permissions**: Different access levels based on user roles (admin, member, viewer)

### How It Works

The RLS policies are defined using PostgreSQL's `CREATE POLICY` statements and are applied automatically to tables. For example:

```sql
-- Users can only see organizations they belong to
CREATE POLICY org_member_select ON auth.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id())
  );

-- Only admins can modify organization data
CREATE POLICY org_admin_all ON auth.organizations
  FOR ALL USING (
    id IN (SELECT organization_id FROM auth.memberships WHERE user_id = current_user_id() AND role = 'admin')
  );
```

## Lambda Initialization (Optional)

If `create_init_lambda` is set to `true`, the module will create a Lambda function that:

1. Connects to the database using credentials from Secrets Manager
2. Executes the SQL initialization script from S3
3. Verifies that RLS is properly enabled on all tables

## Requirements

- AWS provider ~> 5.0
- Random provider ~> 3.0
- VPC with private subnets
- Security group for client access

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| db_name | Name of the database | `string` | - | yes |
| environment | Environment name (e.g., dev, staging, prod) | `string` | - | yes |
| vpc_id | ID of the VPC where RDS will be created | `string` | - | yes |
| subnet_ids | List of subnet IDs for the RDS database | `list(string)` | - | yes |
| client_security_group_id | Security group ID for clients connecting to RDS | `string` | - | yes |
| instance_class | RDS instance class | `string` | `"db.t3.medium"` | no |
| allocated_storage | The allocated storage in GB | `number` | `20` | no |
| db_username | Username for the database | `string` | `"postgres"` | no |
| db_password | Password for the database (if empty, a random password will be generated) | `string` | `""` | no |
| multi_az | Whether to enable Multi-AZ deployment | `bool` | `false` | no |
| create_init_lambda | Whether to create a Lambda function to initialize the database with RLS policies | `bool` | `false` | no |

## Outputs

| Name | Description |
|------|-------------|
| db_instance_id | The RDS instance ID |
| db_instance_address | The address of the RDS instance |
| db_instance_endpoint | The connection endpoint for the RDS instance |
| db_instance_name | The database name |
| db_instance_port | The database port |
| db_instance_username | The master username for the database |
| db_security_group_id | The security group ID |
| secrets_manager_secret_arn | The ARN of the Secrets Manager secret | 
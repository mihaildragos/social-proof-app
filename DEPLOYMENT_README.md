**IMPLEMENTATION CHECKLIST**:

1. Create an AWS account
2. Set up AWS CLI and required tools locally
3. Configure AWS credentials
4. Initialize the S3 backend for Terraform state
5. Configure Terraform variables
6. Apply Terraform to create core infrastructure
7. Configure Kubernetes tools
8. Deploy microservices to Kubernetes cluster
9. Set up CI/CD pipeline
10. Verify the deployment

Let me walk you through each step:

1. **Create an AWS account**
   - Go to aws.amazon.com and sign up for an AWS account
   - Set up MFA (Multi-Factor Authentication) for security
   - Create an IAM user with Administrator access for terraform operations

2. **Set up AWS CLI and required tools locally**
   - Install AWS CLI (Command Line Interface)
   - Install Terraform (version 1.0+)
   - Install kubectl (Kubernetes command-line tool)

3. **Configure AWS credentials**
   - Create access keys for your IAM user
   - Configure AWS CLI with your credentials

4. **Initialize the S3 backend for Terraform state**
   - Create an S3 bucket for storing Terraform state
   - Update the backend configuration in main.tf

5. **Configure Terraform variables**
   - Create a terraform.tfvars file with your desired configuration
   - Adjust instance types, sizes, and other parameters if needed

6. **Apply Terraform to create core infrastructure**
   - Initialize Terraform
   - Create an execution plan
   - Apply the plan to create resources on AWS

7. **Configure Kubernetes tools**
   - Configure kubectl to work with your EKS cluster
   - Install Kubernetes Dashboard (optional)

8. **Deploy microservices to Kubernetes cluster**
   - Deploy Kubernetes manifests for each microservice
   - Configure secrets and environment variables
   - Verify services are running correctly

9. **Set up CI/CD pipeline**
   - Update GitHub Actions workflow to deploy to your AWS environment
   - Configure required secrets in GitHub

10. **Verify the deployment**
    - Test the application
    - Check monitoring and logging systems
    - Ensure everything is working as expected

[MODE: EXECUTE]

# Step-by-Step Guide to Deploy Social Proof App on AWS

Let me guide you through deploying your Social Proof App on AWS from scratch. I'll break this down into manageable steps.

## Step 1: Create an AWS Account

1. Visit [aws.amazon.com](https://aws.amazon.com/) and click "Create an AWS Account"
2. Follow the sign-up process:
   - Provide email and AWS account name
   - Provide personal or company information
   - Add payment method (credit card)
   - Verify your identity
   - Choose a support plan (Free tier is sufficient to start)

## Step 2: Set Up Required Tools

Install the necessary tools on your local machine:

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

For macOS, you can use Homebrew:

```bash
# Install AWS CLI
brew install awscli

# Install Terraform
brew install terraform

# Install kubectl
brew install kubectl
```

## Step 3: Set Up AWS IAM User and Configure Credentials

1. Sign in to the AWS Management Console
2. Navigate to IAM (Identity and Access Management)
3. Create a new user:
   - Go to Users > Add user
   - Name: terraform-deployer
   - Access type: Programmatic access
   - Permissions: Attach AdministratorAccess policy (for initial setup)
   - Download the credentials CSV file

4. Configure AWS CLI with your credentials:

```bash
aws configure
```

Enter your Access Key ID and Secret Access Key when prompted. Also specify your preferred region (e.g., eu-west-2) and output format (json).

## Step 4: Create S3 Bucket for Terraform State

Create an S3 bucket to store the Terraform state:

```bash
aws s3api create-bucket \
  --bucket social-proof-app-terraform-state \
  --region eu-west-2 \
  --create-bucket-configuration LocationConstraint=eu-west-2

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket social-proof-app-terraform-state \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket social-proof-app-terraform-state \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'
```

## Step 5: Configure Terraform Variables

Create a `terraform.tfvars` file in the `microservices/infrastructure/terraform` directory:

```bash
cd microservices/infrastructure/terraform
touch terraform.tfvars
```

Edit the file with your preferred text editor and add:

```hcl
project_name = "social-proof-app"
environment = "dev"
aws_region = "eu-west-2"

# You can adjust these as needed
eks_nodes_instance_type = "t3.medium"
eks_node_group_min_size = 2
eks_node_group_max_size = 5

rds_instance_class = "db.t3.medium"
rds_allocated_storage = 20
db_username = "admin"  # Change this to a secure username

redis_node_type = "cache.t3.medium"
redis_num_cache_nodes = 2

kafka_broker_instance_type = "kafka.m5.large"
kafka_broker_count = 3

clickhouse_instance_type = "m5.xlarge"
clickhouse_volume_size = 100
```

## Step 6: Initialize and Apply Terraform

Initialize Terraform and create resources:

```bash
# Initialize Terraform
terraform init

# Create a plan to review changes
terraform plan -out=tfplan

# Apply the changes to create AWS resources
terraform apply tfplan
```

This will take 20-30 minutes to complete as it creates:

- S3 buckets
- VPC with subnets
- EKS cluster
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- MSK Kafka cluster
- ClickHouse instances
- API Gateway

After the VPC and S3 buckets are successfully deployed, the other resources need to be created one by one in this order:
EKS
RDS
ElastiCache
MSK
ClickHouse
API Gateway (this should be last as it depends on EKS)

## Step 7: Configure kubectl to Connect to EKS

After Terraform creates the EKS cluster, configure kubectl:

```bash
aws eks update-kubeconfig --name social-proof-app-dev --region eu-west-2
```

Verify connection:

```bash
kubectl get nodes
```

## Step 8: Deploy Microservices to Kubernetes

Create namespace for your application:

```bash
kubectl create namespace social-proof-app
```

Deploy your microservices:

```bash
# Apply Kubernetes manifests
kubectl apply -f microservices/infrastructure/kubernetes/users/configmap.yaml -n social-proof-app
kubectl apply -f microservices/infrastructure/kubernetes/users/secrets.yaml -n social-proof-app
kubectl apply -f microservices/infrastructure/kubernetes/users/serviceaccount.yaml -n social-proof-app
kubectl apply -f microservices/infrastructure/kubernetes/users/deployment.yaml -n social-proof-app
kubectl apply -f microservices/infrastructure/kubernetes/users/service.yaml -n social-proof-app
kubectl apply -f microservices/infrastructure/kubernetes/users/hpa.yaml -n social-proof-app
```

You'll need to create Kubernetes manifests for your other services (api-gateway, integrations, notifications, frontend) or adapt the CI/CD pipeline to deploy them.

## Step 9: Update CI/CD Pipeline

Update your `.github/workflows/ci.yml` file to deploy to your AWS EKS cluster:

1. Add AWS credentials as GitHub secrets:
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY

2. Update the deploy job in your workflow to use your EKS cluster:

```yaml
deploy-staging:
  name: Deploy to Staging
  needs: build
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/develop'
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v3
      
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v1
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: eu-west-2
      
    - name: Set up Kubectl
      uses: azure/setup-kubectl@v3
      
    - name: Update Kubeconfig
      run: aws eks update-kubeconfig --name social-proof-app-dev --region eu-west-2
      
    - name: Deploy to Kubernetes
      run: |
        cd ./microservices/infrastructure/kubernetes
        # Update image tags in Kubernetes manifests
        VERSION=$(echo $GITHUB_SHA | cut -c1-7)
        kubectl apply -f namespace.yaml
        # Continue with your deployment steps
```

## Step 10: Verify the Deployment

Check that your services are running:

```bash
kubectl get pods -n social-proof-app
kubectl get services -n social-proof-app
```

Access your application:

```bash
# Get the LoadBalancer endpoint
kubectl get svc api-gateway -n social-proof-app
```

## Cost Optimization Tips

The infrastructure defined in your Terraform files is enterprise-grade and could be expensive for development purposes. Consider these cost-saving measures:

1. For development, reduce instance sizes:
   - Use `t3.small` for EKS nodes
   - Use `db.t3.small` for RDS
   - Use `cache.t3.small` for Redis
   
2. Reduce the number of nodes:
   - Set `eks_node_group_min_size = 1`
   - Set `redis_num_cache_nodes = 1`
   - Set `kafka_broker_count = 1` (for dev only)

3. Use spot instances for EKS nodes in development

4. Turn off resources when not in use

## Next Steps

1. Set up monitoring with the provided configurations in `microservices/infrastructure/config`
2. Implement proper secrets management
3. Configure backups for databases
4. Set up proper domain names and SSL certificates
5. Implement proper security policies

Would you like me to elaborate on any specific step in this process?

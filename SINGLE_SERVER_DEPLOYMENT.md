# Single Server Deployment for Social Proof App MVP

This guide outlines the steps to deploy the Social Proof App on a single EC2 instance, providing a cost-effective solution for MVP testing with fewer than 100 users.

## Prerequisites

- Amazon EC2 instance (t3.small recommended, \~$15-25/month)
- Domain name pointing to your EC2 instance
- Basic Linux server administration knowledge

## Deployment Steps

### 1. Set Up the EC2 Instance

1. Launch a t3.small EC2 instance with Amazon Linux 2
2. Configure security groups to allow inbound traffic on ports 22 (SSH), 80 (HTTP), and 443 (HTTPS)
3. Allocate and associate an Elastic IP address
4. Update your domain's DNS to point to your EC2 instance

### 2. Install Required Software

Connect to your EC2 instance and install dependencies:

```bash
# Update system packages
sudo yum update -y

# Install Docker
sudo amazon-linux-extras install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install git
sudo yum install git -y

# Install Certbot for SSL certificates
sudo yum install certbot -y
```

Log out and log back in for the Docker group membership to take effect.

### 3. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/your-org/social-proof-app.git
cd social-proof-app
```

### 4. Configure SSL Certificates

```bash
# Obtain SSL certificates using Certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Create symbolic links to certificates
sudo ln -s /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/fullchain.pem
sudo ln -s /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/privkey.pem
```

### 5. Update Configuration Files

1. Edit `docker-compose.prod.yml` if needed
2. Update `nginx/conf.d/default.conf` with your domain name
3. Create a `.env.production` file with your environment variables

### 6. Deploy the Application

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

### 7. Set Up Automated Backup and Monitoring

1. Set up a cron job for database backups:

```bash
# Make the backup script executable
chmod +x backup.sh

# Edit crontab
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * /home/ec2-user/social-proof-app/backup.sh > /home/ec2-user/backup.log 2>&1
```

2. Set up a cron job for health checks:

```bash
# Make the health check script executable
chmod +x health_check.sh

# Edit crontab
crontab -e

# Add this line to run every 5 minutes
*/5 * * * * /home/ec2-user/social-proof-app/health_check.sh > /home/ec2-user/health_check.log 2>&1
```

## Monitoring and Maintenance

### Basic Monitoring

For simple monitoring, you can:

1. Check service status: `docker-compose -f docker-compose.prod.yml ps`
2. View logs: `docker-compose -f docker-compose.prod.yml logs -f`
3. Check specific service logs: `docker-compose -f docker-compose.prod.yml logs -f service_name`

### SSL Certificate Renewal

Set up automatic renewal with a cron job:

```bash
# Add to crontab
0 1 * * * sudo certbot renew --quiet
```

### Database Maintenance

Periodically check database performance and disk usage:

```bash
# Check disk usage
df -h

# Connect to PostgreSQL
docker exec -it social-proof-app_postgres_1 psql -U postgres -d social_proof
```

## Cost Optimization

This setup is optimized for low cost while maintaining production-level reliability:

- EC2 t3.small instance: \~$15-25/month
- Data transfer: Minimal for <100 users
- Storage: Under 20GB for database and application (\~$2/month)
- Elastic IP: \~$3/month if not released when not in use

Total estimated cost: $20-30/month

## Scaling Up

When your user base grows beyond 100 users, consider:

1. Increasing EC2 instance size before migrating to a distributed system
2. Separating database to a dedicated RDS instance
3. Adding a CDN for static assets
4. Implementing auto-scaling with multiple application servers
5. Moving to a managed Kubernetes implementation for true microservices architecture

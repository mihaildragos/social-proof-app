#!/bin/bash

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

# Install AWS CLI
sudo yum install -y aws-cli

# Create directories for the application
mkdir -p ~/social-proof-app/nginx/conf.d
mkdir -p ~/social-proof-app/nginx/ssl
mkdir -p ~/social-proof-app/nginx/www
mkdir -p ~/backups

echo "Setup complete!"
echo "Log out and log back in for the Docker group membership to take effect."

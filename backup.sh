#!/bin/bash
DATE=$(date +%Y-%m-%d-%H-%M)
BACKUP_DIR=./backups

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup PostgreSQL database
docker exec social-proof-app-postgres-1 pg_dump -U postgres social_proof > $BACKUP_DIR/social_proof_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/social_proof_$DATE.sql

# If AWS CLI is configured, upload to S3
# Uncomment the following line and replace the bucket name
# aws s3 cp $BACKUP_DIR/social_proof_$DATE.sql.gz s3://your-backup-bucket/

# Remove backups older than 7 days from local storage
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -delete 
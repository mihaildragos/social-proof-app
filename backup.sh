#!/bin/bash

# Database backup script for social proof application
# Creates compressed SQL dumps with timestamp

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
DB_NAME="social_proof_mvp"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create database backup
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME | gzip > $BACKUP_DIR/social_proof_$DATE.sql.gz

echo "Backup created: $BACKUP_DIR/social_proof_$DATE.sql.gz"

# Remove backups older than 7 days from local storage
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -delete 
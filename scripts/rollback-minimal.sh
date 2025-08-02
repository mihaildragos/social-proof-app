#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[ROLLBACK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[ROLLBACK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[ROLLBACK]${NC} $1"
}

print_error() {
    echo -e "${RED}[ROLLBACK]${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# Configuration
BACKUP_DIR="./backups"
COMPOSE_FILE="docker-compose-minimal.yml"

# Parse command line arguments
FORCE_ROLLBACK=false
RESTORE_DATA=false
LIST_BACKUPS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_ROLLBACK=true
            shift
            ;;
        -d|--restore-data)
            RESTORE_DATA=true
            shift
            ;;
        -l|--list)
            LIST_BACKUPS=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -f, --force          Force rollback without confirmation"
            echo "  -d, --restore-data   Also restore database from backup"
            echo "  -l, --list           List available backups"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                   Interactive rollback"
            echo "  $0 -f               Force rollback without prompts"
            echo "  $0 -d               Rollback with data restoration"
            echo "  $0 -l               List available backups"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if docker-compose is available
if ! command -v docker-compose &>/dev/null; then
    print_error "docker-compose is not installed or not in PATH."
    exit 1
fi

# Check if minimal compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    print_error "$COMPOSE_FILE not found in current directory."
    exit 1
fi

# Function to list available backups
list_backups() {
    print_header "📋 AVAILABLE BACKUPS"
    print_header "===================="
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_warning "No backup directory found at $BACKUP_DIR"
        return
    fi
    
    # List Docker image backups
    print_status "Docker Image Backups:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}" | grep -E "(social-proof|integrations|notifications|users|billing)" | head -10 || print_warning "No Docker image backups found"
    
    echo ""
    
    # List database backups
    print_status "Database Backups:"
    if ls "$BACKUP_DIR"/*.sql &>/dev/null; then
        ls -la "$BACKUP_DIR"/*.sql | awk '{print "  " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}'
    else
        print_warning "No database backups found in $BACKUP_DIR"
    fi
    
    echo ""
    
    # List configuration backups
    print_status "Configuration Backups:"
    if ls "$BACKUP_DIR"/.env.* &>/dev/null; then
        ls -la "$BACKUP_DIR"/.env.* | awk '{print "  " $9 " (" $6 " " $7 " " $8 ")"}'
    else
        print_warning "No configuration backups found in $BACKUP_DIR"
    fi
}

# Function to create emergency backup before rollback
create_emergency_backup() {
    print_status "Creating emergency backup before rollback..."
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    
    # Backup current environment file
    if [ -f ".env.minimal" ]; then
        cp .env.minimal "$BACKUP_DIR/.env.minimal.emergency_$timestamp"
        print_success "✅ Environment configuration backed up"
    fi
    
    # Backup database
    if docker exec social-proof-postgres pg_isready -U postgres >/dev/null 2>&1; then
        print_status "Backing up PostgreSQL database..."
        docker exec social-proof-postgres pg_dump -U postgres social_proof_mvp > "$BACKUP_DIR/database_emergency_$timestamp.sql"
        print_success "✅ Database backed up to $BACKUP_DIR/database_emergency_$timestamp.sql"
    else
        print_warning "⚠️  Could not backup database (PostgreSQL not responding)"
    fi
    
    # Backup Docker volumes
    print_status "Backing up Docker volumes..."
    docker run --rm -v social-proof-postgres-data:/data -v "$PWD/$BACKUP_DIR":/backup alpine tar czf "/backup/volumes_emergency_$timestamp.tar.gz" /data 2>/dev/null || print_warning "⚠️  Could not backup volumes"
    
    print_success "✅ Emergency backup completed"
}

# Function to stop current services safely
stop_current_services() {
    print_status "Stopping current services..."
    
    # Graceful shutdown with timeout
    timeout 60 docker-compose -f "$COMPOSE_FILE" down --remove-orphans || {
        print_warning "⚠️  Graceful shutdown timed out, forcing stop..."
        docker-compose -f "$COMPOSE_FILE" kill
        docker-compose -f "$COMPOSE_FILE" down --remove-orphans
    }
    
    print_success "✅ Services stopped"
}

# Function to restore from previous images
restore_previous_images() {
    print_status "Looking for previous Docker images..."
    
    # List available images with their tags
    local available_images=($(docker images --format "{{.Repository}}:{{.Tag}}" | grep -E "social-proof" | grep -v "latest" | head -5))
    
    if [ ${#available_images[@]} -eq 0 ]; then
        print_error "❌ No previous images found for rollback"
        return 1
    fi
    
    print_status "Available previous images:"
    for i in "${!available_images[@]}"; do
        echo "  $((i+1)). ${available_images[$i]}"
    done
    
    if [ "$FORCE_ROLLBACK" = false ]; then
        echo ""
        echo -n "Select image to rollback to (1-${#available_images[@]}), or press Enter to use latest available: "
        read -r selection
        
        if [ -n "$selection" ] && [ "$selection" -ge 1 ] && [ "$selection" -le "${#available_images[@]}" ]; then
            selected_image="${available_images[$((selection-1))]}"
        else
            selected_image="${available_images[0]}"
        fi
    else
        selected_image="${available_images[0]}"
    fi
    
    print_status "Rolling back to: $selected_image"
    
    # Tag the selected image as latest for the rollback
    local repo_name=$(echo "$selected_image" | cut -d':' -f1)
    docker tag "$selected_image" "$repo_name:rollback"
    
    print_success "✅ Previous images prepared for rollback"
    return 0
}

# Function to restore database
restore_database() {
    if [ "$RESTORE_DATA" = false ]; then
        return 0
    fi
    
    print_status "Looking for database backups..."
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_warning "⚠️  No backup directory found, skipping database restore"
        return 0
    fi
    
    # Find most recent database backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        print_warning "⚠️  No database backups found, skipping database restore"
        return 0
    fi
    
    print_status "Found database backup: $latest_backup"
    
    if [ "$FORCE_ROLLBACK" = false ]; then
        echo -n "Restore database from this backup? (y/N): "
        read -r restore_db
        if [[ ! "$restore_db" =~ ^[Yy]$ ]]; then
            print_status "Skipping database restore"
            return 0
        fi
    fi
    
    print_status "Restoring database from backup..."
    
    # Start only PostgreSQL for restore
    docker-compose -f "$COMPOSE_FILE" up -d postgres
    
    # Wait for PostgreSQL to be ready
    timeout=60
    counter=0
    while ! docker exec social-proof-postgres pg_isready -U postgres >/dev/null 2>&1; do
        if [ $counter -eq $timeout ]; then
            print_error "❌ PostgreSQL failed to start for restore"
            return 1
        fi
        sleep 1
        counter=$((counter + 1))
    done
    
    # Drop and recreate database
    docker exec social-proof-postgres psql -U postgres -c "DROP DATABASE IF EXISTS social_proof_mvp;"
    docker exec social-proof-postgres psql -U postgres -c "CREATE DATABASE social_proof_mvp;"
    
    # Restore from backup
    docker exec -i social-proof-postgres psql -U postgres -d social_proof_mvp < "$latest_backup"
    
    print_success "✅ Database restored from backup"
}

# Function to restart services
restart_services() {
    print_status "Starting services with rollback configuration..."
    
    # Start infrastructure services first
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for infrastructure to be ready
    timeout=60
    counter=0
    while ! docker exec social-proof-postgres pg_isready -U postgres >/dev/null 2>&1 || ! docker exec social-proof-redis redis-cli ping >/dev/null 2>&1; do
        if [ $counter -eq $timeout ]; then
            print_error "❌ Infrastructure services failed to start"
            return 1
        fi
        sleep 2
        counter=$((counter + 2))
    done
    
    # Start application services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_success "✅ Services restarted"
}

# Function to verify rollback
verify_rollback() {
    print_status "Verifying rollback..."
    
    # Run health check
    if [ -f "scripts/health-check-minimal.sh" ]; then
        chmod +x scripts/health-check-minimal.sh
        if ./scripts/health-check-minimal.sh; then
            print_success "✅ Rollback verification passed"
            return 0
        else
            print_error "❌ Rollback verification failed"
            return 1
        fi
    else
        # Basic verification
        sleep 10
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
            print_success "✅ Basic rollback verification passed"
            return 0
        else
            print_error "❌ Basic rollback verification failed"
            return 1
        fi
    fi
}

# Function to perform complete rollback
perform_rollback() {
    print_header "🔄 PERFORMING ROLLBACK"
    print_header "======================"
    
    # Confirmation
    if [ "$FORCE_ROLLBACK" = false ]; then
        echo ""
        print_warning "⚠️  This will rollback your deployment to a previous state."
        print_warning "⚠️  Current containers will be stopped and replaced."
        if [ "$RESTORE_DATA" = true ]; then
            print_warning "⚠️  Database will be restored from backup."
        fi
        echo ""
        echo -n "Are you sure you want to proceed? (y/N): "
        read -r confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            print_status "Rollback cancelled"
            exit 0
        fi
    fi
    
    # Create emergency backup
    create_emergency_backup
    
    # Stop current services
    stop_current_services
    
    # Restore previous images
    if ! restore_previous_images; then
        print_error "❌ Could not find previous images for rollback"
        print_status "Attempting to restart current deployment..."
        restart_services
        exit 1
    fi
    
    # Restore database if requested
    restore_database
    
    # Restart services
    restart_services
    
    # Verify rollback
    if verify_rollback; then
        print_success "🎉 Rollback completed successfully!"
        echo ""
        print_status "📊 Current status:"
        docker-compose -f "$COMPOSE_FILE" ps
        echo ""
        print_status "📋 Next steps:"
        echo "  • Monitor application: ./scripts/status-minimal.sh"
        echo "  • Check logs: ./scripts/logs-minimal.sh"
        echo "  • Access application: http://localhost:3000"
    else
        print_error "❌ Rollback completed but verification failed"
        print_status "Manual intervention may be required"
        exit 1
    fi
}

# Main execution
if [ "$LIST_BACKUPS" = true ]; then
    list_backups
    exit 0
fi

perform_rollback
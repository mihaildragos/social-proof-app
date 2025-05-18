#!/bin/bash

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check if containers are running
if ! docker ps | grep -q "nginx"; then
    echo "Containers not running properly. Restarting..."
    docker-compose -f docker-compose.prod.yml up -d
fi

# Check if frontend is accessible
if ! curl -sk https://localhost >/dev/null; then
    echo "Frontend service check failed. Restarting service..."
    docker-compose -f docker-compose.prod.yml restart frontend
fi

# Log the status
echo "Health check completed at $(date)"

#!/bin/bash

# Build and run script for Social Proof microservices

# Set colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Docker compose file to use
COMPOSE_FILE="docker-compose.services-only.yml"

# Ensure script is run from the microservices directory
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Error: $COMPOSE_FILE not found!${NC}"
  echo -e "${YELLOW}Please run this script from the microservices directory${NC}"
  exit 1
fi

# Step 1: Build all services
echo -e "${GREEN}Step 1: Building all services...${NC}"
docker-compose -f $COMPOSE_FILE build

# Check if build was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Docker build failed!${NC}"
  exit 1
fi

echo -e "${GREEN}All services built successfully!${NC}"

# Step 2: Run all services
echo -e "${GREEN}Step 2: Starting all services...${NC}"
docker-compose -f $COMPOSE_FILE up -d

# Check if services started successfully
if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Docker services failed to start!${NC}"
  exit 1
fi

echo -e "${GREEN}All services started successfully!${NC}"

# Step 3: Display running containers
echo -e "${GREEN}Step 3: Listing running containers...${NC}"
docker-compose -f $COMPOSE_FILE ps

echo -e "${YELLOW}To view logs, run: docker-compose -f $COMPOSE_FILE logs -f [service_name]${NC}"
echo -e "${YELLOW}To stop all services, run: docker-compose -f $COMPOSE_FILE down${NC}"
echo -e "${GREEN}Done!${NC}" 
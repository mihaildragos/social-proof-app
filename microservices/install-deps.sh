#!/bin/bash

# Script to install required dependencies for the microservices

echo "Installing dependencies..."

# Install npm dependencies
npm install

# Install specific dependencies that might be missing
npm install --save winston uuid express cors helmet ioredis kafkajs pg zod

# Install dev dependencies
npm install --save-dev @types/express @types/cors @types/node @types/uuid @types/pg @types/jest @types/supertest jest ts-jest supertest

echo "Dependencies installed successfully!"

# Check if .env file exists, create from example if not
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo ".env file created. Please edit with your specific configuration."
  else
    echo "Warning: .env.example file not found. Please create a .env file manually."
  fi
fi

echo "Setup complete!" 
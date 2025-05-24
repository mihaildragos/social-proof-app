#!/bin/bash
set -e

echo "Building db_init_lambda.zip..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Copy source files to temporary directory
cp db_init.js "$TEMP_DIR/index.js"
cp package.json "$TEMP_DIR/package.json"
echo "Copied source files"

# Install dependencies
cd "$TEMP_DIR"
npm install --production
echo "Installed dependencies"

# Create zip file
zip -r db_init_lambda.zip index.js package.json node_modules
echo "Created zip file"

# Move zip file to original directory
mv db_init_lambda.zip ../db_init_lambda.zip
echo "Moved zip file to final location"

# Clean up
cd ..
rm -rf "$TEMP_DIR"
echo "Cleaned up temporary directory"

echo "Build completed successfully" 
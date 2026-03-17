#!/bin/bash

# Deploy Command Missiles AR to production server
# Usage: ./deploy.sh

set -e  # Exit on error

SERVER="scrog@chrisrogers3d.graphics"
REMOTE_PATH="/var/www/html/commandmissiles"

echo "🚀 Starting deployment of Command Missiles AR..."

# Build for production
echo "📦 Building for production..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build successful"

# Deploy to server
echo "🌐 Deploying to $SERVER..."

# Create remote directory if it doesn't exist and clean it
ssh $SERVER "mkdir -p $REMOTE_PATH && rm -rf $REMOTE_PATH/*"

# Create tarball of dist folder
echo "📦 Creating deployment package..."
cd dist
tar -czf ../deploy.tar.gz .
cd ..

# Copy tarball to server
echo "📤 Uploading files..."
scp deploy.tar.gz $SERVER:/tmp/

# Extract on server
echo "📥 Extracting files on server..."
ssh $SERVER "cd $REMOTE_PATH && tar -xzf /tmp/deploy.tar.gz && rm /tmp/deploy.tar.gz"

# Clean up local tarball
rm deploy.tar.gz

echo "✅ Deployment complete!"
echo "🎮 Game available at: https://chrisrogers3d.graphics/commandmissiles"

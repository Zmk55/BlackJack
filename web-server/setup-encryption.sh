#!/bin/bash

echo "🔐 BlackJack Encrypted Credentials Setup"
echo "========================================"
echo

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go first."
    exit 1
fi

# Build the setup utility
echo "🔨 Building encryption setup utility..."
go build -o setup-encryption setup-encrypted-credentials.go

if [ $? -ne 0 ]; then
    echo "❌ Failed to build setup utility"
    exit 1
fi

echo "✅ Setup utility built successfully"
echo

# Run the setup
echo "🚀 Starting encrypted credentials setup..."
echo
./setup-encryption

# Clean up
echo
echo "🧹 Cleaning up..."
rm -f setup-encryption

echo
echo "🎉 Setup complete! Your credentials are now encrypted."
echo "   Restart the BlackJack server to use encrypted credentials."

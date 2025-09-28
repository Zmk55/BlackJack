#!/bin/bash

# Latch SSH Manager Setup Script

echo "🚀 Setting up Latch SSH Manager..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Rust dependencies
echo "🦀 Installing Rust dependencies..."
cd apps/desktop/src-tauri
cargo build
cd ../../..

echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "To build the application:"
echo "  npm run build"
echo ""
echo "To run tests:"
echo "  npm test"

#!/bin/bash

# Latch SSH Manager - Build Installer Script

set -e

echo "🚀 Building Latch SSH Manager installers..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build for all platforms
echo "🔨 Building for all platforms..."

# Windows
echo "Building for Windows..."
cd apps/desktop
npm run tauri build -- --target x86_64-pc-windows-msvc

# macOS  
echo "Building for macOS..."
npm run tauri build -- --target x86_64-apple-darwin

# Linux
echo "Building for Linux..."
npm run tauri build -- --target x86_64-unknown-linux-gnu

cd ../..

echo "✅ Build complete!"
echo ""
echo "Installers created in:"
echo "  - Windows: apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/"
echo "  - macOS: apps/desktop/src-tauri/target/x86_64-apple-darwin/release/bundle/"
echo "  - Linux: apps/desktop/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/"
echo ""
echo "Ready for distribution! 🎉"

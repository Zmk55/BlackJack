#!/bin/bash

echo "🚀 Starting BlackJack Web Server with Real SSH Support"
echo ""

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.22+ first."
    echo "   Download from: https://golang.org/dl/"
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo "✅ Go version: $GO_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
go mod tidy

# Build the server
echo "🔨 Building web server..."
go build -o blackjack-server main.go

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "🌐 Starting BlackJack Web Server..."
echo "   Web Interface: http://localhost:8082"
echo "   WebSocket: ws://localhost:8082/ws/ssh"
echo ""
echo "✨ Features:"
echo "   • Real SSH terminal connections"
echo "   • WebSocket-based communication"
echo "   • xterm.js terminal emulation"
echo "   • Multiple concurrent sessions"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
./blackjack-server

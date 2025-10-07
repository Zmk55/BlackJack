#!/bin/bash

# BlackJack Web Application Launcher

echo "Starting BlackJack Web Application..."

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "Using Python 3 HTTP server..."
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "Using Python HTTP server..."
    python -m SimpleHTTPServer 8080
elif command -v node &> /dev/null; then
    echo "Using Node.js HTTP server..."
    npx http-server -p 8080
else
    echo "No HTTP server found. Please install Python, Node.js, or use any web server."
    echo "You can also open index.html directly in your browser."
    exit 1
fi

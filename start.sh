#!/bin/bash

# BlackJack Unified Startup Script
# This script starts the complete BlackJack application with all required services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DEFAULT_PORT=8082
DEFAULT_MODE="web"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}  🚀 BlackJack Startup Script  ${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo ""
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -m, --mode MODE     Application mode (web|desktop|tui) [default: web]"
    echo "  -p, --port PORT     Port for web server [default: 8082]"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Modes:"
    echo "  web      - Start web application with full SSH support (recommended)"
    echo "  desktop  - Start desktop application (requires Rust)"
    echo "  tui      - Start terminal UI application"
    echo ""
    echo "Examples:"
    echo "  $0                    # Start web application on port 8082"
    echo "  $0 -m web -p 8080     # Start web application on port 8080"
    echo "  $0 -m desktop         # Start desktop application"
    echo "  $0 -m tui             # Start terminal UI"
}

# Function to check prerequisites
check_prerequisites() {
    local mode=$1
    
    print_status "Checking prerequisites for $mode mode..."
    
    case $mode in
        "web")
            if ! command -v go &> /dev/null; then
                print_error "Go is not installed. Please install Go 1.22+ first."
                echo "   Download from: https://golang.org/dl/"
                exit 1
            fi
            
            # Check Go version
            GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
            print_success "Go version: $GO_VERSION"
            ;;
            
        "desktop")
            if ! command -v cargo &> /dev/null; then
                print_error "Rust is not installed. Please install Rust first:"
                echo "   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
                exit 1
            fi
            
            if ! command -v tauri &> /dev/null; then
                print_warning "Tauri CLI not found. Installing..."
                cargo install tauri-cli
            fi
            ;;
            
        "tui")
            if ! command -v go &> /dev/null; then
                print_error "Go is not installed. Please install Go 1.22+ first."
                exit 1
            fi
            ;;
    esac
    
    print_success "Prerequisites check passed"
}

# Function to start web application
start_web() {
    local port=$1
    
    print_status "Starting BlackJack Web Application..."
    print_status "Port: $port"
    print_status "Web Interface: http://localhost:$port"
    print_status "WebSocket: ws://localhost:$port/ws/ssh"
    echo ""
    
    # Check if port is already in use
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $port is already in use. Trying to find an available port..."
        for ((i=port+1; i<=port+10; i++)); do
            if ! lsof -Pi :$i -sTCP:LISTEN -t >/dev/null 2>&1; then
                port=$i
                print_status "Using port $port instead"
                break
            fi
        done
    fi
    
    # Navigate to web-server directory
    cd "$(dirname "$0")/web-server"
    
    # Set port environment variable
    export PORT=$port
    
    # Install dependencies and build
    print_status "Installing dependencies..."
    go mod tidy
    
    print_status "Building web server..."
    go build -o blackjack-server main.go
    
    if [ $? -ne 0 ]; then
        print_error "Build failed"
        exit 1
    fi
    
    print_success "Build completed successfully"
    echo ""
    print_status "✨ Features:"
    echo "   • Real SSH terminal connections"
    echo "   • WebSocket-based communication"
    echo "   • xterm.js terminal emulation"
    echo "   • Multiple concurrent sessions"
    echo ""
    print_status "Press Ctrl+C to stop the server"
    echo ""
    
    # Start the server
    ./blackjack-server
}

# Function to start desktop application
start_desktop() {
    print_status "Starting BlackJack Desktop Application..."
    
    # Navigate to desktop directory
    cd "$(dirname "$0")/desktop"
    
    print_status "Running in development mode..."
    cd src-tauri
    cargo tauri dev
}

# Function to start TUI application
start_tui() {
    print_status "Starting BlackJack Terminal UI..."
    
    # Navigate to project root
    cd "$(dirname "$0")"
    
    # Check if binary exists, if not build it
    if [ ! -f "build/blackjack" ]; then
        print_status "Building TUI application..."
        make build
    fi
    
    # Run the TUI application
    ./build/blackjack tui
}

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down BlackJack..."
    # Kill any background processes if needed
    jobs -p | xargs -r kill
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Parse command line arguments
MODE=$DEFAULT_MODE
PORT=$DEFAULT_PORT

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -p|--port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate mode
case $MODE in
    web|desktop|tui)
        ;;
    *)
        print_error "Invalid mode: $MODE"
        show_usage
        exit 1
        ;;
esac

# Main execution
print_header

# Check prerequisites
check_prerequisites $MODE

# Start the appropriate mode
case $MODE in
    "web")
        start_web $PORT
        ;;
    "desktop")
        start_desktop
        ;;
    "tui")
        start_tui
        ;;
esac

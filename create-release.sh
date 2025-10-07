#!/bin/bash

# BlackJack Release Creation Script
# This script helps create GitHub releases with Windows executables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION=$(cat "$PROJECT_ROOT/VERSION" 2>/dev/null || echo "1.0.0")
REPO_OWNER="Zmk55"
REPO_NAME="BlackJack"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                BlackJack Release Creator                    ║"
    echo "║                    Version: $VERSION                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed"
        exit 1
    fi
    
    # Check if gh CLI is available
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed"
        print_info "Install from: https://cli.github.com/"
        exit 1
    fi
    
    # Check if Go is available
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed"
        print_info "Install from: https://golang.org/dl/"
        exit 1
    fi
    
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi
    
    # Check if we're authenticated with GitHub
    if ! gh auth status &> /dev/null; then
        print_error "Not authenticated with GitHub"
        print_info "Run: gh auth login"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build Windows executable
build_windows_executable() {
    print_info "Building Windows executable..."
    
    # Create build directory
    BUILD_DIR="$PROJECT_ROOT/build"
    WINDOWS_BUILD="$BUILD_DIR/windows"
    mkdir -p "$WINDOWS_BUILD"
    
    # Navigate to web-server directory
    cd "$PROJECT_ROOT/web-server"
    
    # Install dependencies
    go mod tidy
    
    # Build the executable
    go build -ldflags "-X main.Version=$VERSION -s -w" -o "../$WINDOWS_BUILD/blackjack-server.exe" main.go
    
    # Go back to root
    cd "$PROJECT_ROOT"
    
    # Copy web-app files
    cp -r "$PROJECT_ROOT/web-app" "$WINDOWS_BUILD/"
    
    # Copy configuration files
    if [[ -f "$PROJECT_ROOT/web-server/config.json" ]]; then
        cp "$PROJECT_ROOT/web-server/config.json" "$WINDOWS_BUILD/"
    fi
    if [[ -f "$PROJECT_ROOT/web-server/config-encrypted.json.example" ]]; then
        cp "$PROJECT_ROOT/web-server/config-encrypted.json.example" "$WINDOWS_BUILD/"
    fi
    
    # Create startup script
    cat > "$WINDOWS_BUILD/start-blackjack.bat" << 'EOF'
@echo off
echo Starting BlackJack SSH Client...
echo.
echo Web Interface: http://localhost:8082
echo Press Ctrl+C to stop the server
echo.
blackjack-server.exe
EOF
    
    # Create Windows README
    cat > "$WINDOWS_BUILD/README.txt" << EOF
BlackJack SSH Client - Windows Build
====================================

Version: $VERSION
Build Date: $(date)

Quick Start:
1. Double-click 'start-blackjack.bat' to start the server
2. Open your browser and go to http://localhost:8082
3. Use the web interface to manage your SSH connections

Files:
- blackjack-server.exe: Main server executable
- web-app/: Web interface files
- config.json: Server configuration (optional)
- start-blackjack.bat: Startup script

For more information, visit: https://github.com/$REPO_OWNER/$REPO_NAME
EOF
    
    # Create zip file for distribution
    cd "$BUILD_DIR"
    zip -r "blackjack-windows-$VERSION.zip" windows/
    
    print_success "Windows executable built: blackjack-windows-$VERSION.zip"
}

# Create GitHub release
create_github_release() {
    print_info "Creating GitHub release..."
    
    # Check if tag already exists
    if git rev-parse "v$VERSION" >/dev/null 2>&1; then
        print_warning "Tag v$VERSION already exists"
        read -p "Do you want to delete and recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git tag -d "v$VERSION"
            git push origin ":refs/tags/v$VERSION" 2>/dev/null || true
        else
            print_info "Using existing tag"
        fi
    fi
    
    # Create tag if it doesn't exist
    if ! git rev-parse "v$VERSION" >/dev/null 2>&1; then
        git tag -a "v$VERSION" -m "Release v$VERSION"
        git push origin "v$VERSION"
        print_success "Created and pushed tag v$VERSION"
    fi
    
    # Create release notes
    RELEASE_NOTES=$(cat << EOF
## BlackJack SSH Client v$VERSION

### 🚀 Quick Start
1. Download \`blackjack-windows-$VERSION.zip\`
2. Extract the zip file
3. Double-click \`start-blackjack.bat\` to start the server
4. Open your browser and go to http://localhost:8082

### ✨ Features
- **Real SSH Terminal**: Full xterm.js terminal emulation with actual SSH protocol
- **SFTP File Browser**: Dual-pane file browser with drag-and-drop transfers
- **Encrypted Storage**: AES-256-GCM encryption for all sensitive data
- **Advanced Host Management**: Hierarchical groups, smart tags, and search
- **Modern UI**: Responsive design with dark theme and smooth animations
- **Cross-Platform**: Works seamlessly on Windows, Linux, and macOS

### 📋 System Requirements
- **OS**: Windows 10 or later
- **RAM**: 512 MB minimum, 2 GB recommended
- **Storage**: 100 MB
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### 🔧 Installation
This is a portable application - no installation required! Just extract and run.

### 📚 Documentation
- [Installation Guide](https://github.com/$REPO_OWNER/$REPO_NAME/blob/main/INSTALLATION.md)
- [Quick Start Guide](https://github.com/$REPO_OWNER/$REPO_NAME/blob/main/QUICK_START.md)
- [GitHub Repository](https://github.com/$REPO_OWNER/$REPO_NAME)

### 🆘 Support
- [GitHub Issues](https://github.com/$REPO_OWNER/$REPO_NAME/issues)
- [GitHub Discussions](https://github.com/$REPO_OWNER/$REPO_NAME/discussions)
EOF
)
    
    # Create the release
    gh release create "v$VERSION" \
        --title "BlackJack SSH Client v$VERSION" \
        --notes "$RELEASE_NOTES" \
        --latest \
        "build/blackjack-windows-$VERSION.zip"
    
    print_success "GitHub release created: v$VERSION"
}

# Main function
main() {
    print_header
    
    # Check prerequisites
    check_prerequisites
    
    # Build Windows executable
    build_windows_executable
    
    # Ask user if they want to create a GitHub release
    read -p "Do you want to create a GitHub release? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_github_release
    else
        print_info "Skipping GitHub release creation"
        print_info "Windows executable is available at: build/blackjack-windows-$VERSION.zip"
    fi
    
    print_success "Release process completed!"
    echo
    print_info "Files created:"
    ls -la "build/blackjack-windows-$VERSION.zip"
}

# Run main function
main "$@"
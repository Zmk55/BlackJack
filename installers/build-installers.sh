#!/bin/bash

# BlackJack Installer Build Script
# Builds installers for Windows and Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLERS_DIR="$PROJECT_ROOT/installers"
BUILD_DIR="$PROJECT_ROOT/build"
VERSION=$(cat "$PROJECT_ROOT/VERSION" 2>/dev/null || echo "1.0.0")

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                BlackJack Installer Builder                  ║"
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

# Create build directory
create_build_dir() {
    print_info "Creating build directory..."
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    print_success "Build directory created"
}

# Build Windows executable
build_windows_executable() {
    print_info "Building Windows executable..."
    
    # Check if Go is installed
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed. Please install Go 1.22+ to build Windows executable."
        print_info "Download from: https://golang.org/dl/"
        return 1
    fi
    
    # Create Windows build directory
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

For more information, visit: https://github.com/Zmk55/BlackJack
EOF
    
    # Create zip file for distribution
    cd "$BUILD_DIR"
    zip -r "blackjack-windows-$VERSION.zip" windows/
    
    print_success "Windows executable built: blackjack-windows-$VERSION.zip"
}

# Build Windows installer
build_windows_installer() {
    print_info "Building Windows installer..."
    
    # Check if NSIS is installed
    if ! command -v makensis &> /dev/null; then
        print_error "NSIS (makensis) is not installed. Please install NSIS to build Windows installer."
        print_info "Download from: https://nsis.sourceforge.io/Download"
        return 1
    fi
    
    # Create Windows build directory
    WINDOWS_BUILD="$BUILD_DIR/windows"
    mkdir -p "$WINDOWS_BUILD"
    
    # Copy files for Windows installer
    cp -r "$PROJECT_ROOT/web-app" "$WINDOWS_BUILD/"
    cp -r "$PROJECT_ROOT/web-server" "$WINDOWS_BUILD/"
    cp "$PROJECT_ROOT/start.sh" "$WINDOWS_BUILD/"
    cp "$PROJECT_ROOT/VERSION" "$WINDOWS_BUILD/"
    
    # Create a simple icon (if not exists)
    if [[ ! -f "$INSTALLERS_DIR/windows/blackjack.ico" ]]; then
        print_warning "Creating placeholder icon (blackjack.ico not found)"
        # Create a simple text file as placeholder
        echo "BlackJack Icon" > "$INSTALLERS_DIR/windows/blackjack.ico"
    fi
    
    # Build the installer
    cd "$INSTALLERS_DIR/windows"
    makensis blackjack-installer.nsi
    
    # Move to build directory
    mv "BlackJack-Setup.exe" "$BUILD_DIR/BlackJack-Setup-$VERSION.exe"
    
    print_success "Windows installer built: BlackJack-Setup-$VERSION.exe"
}

# Build Linux installer
build_linux_installer() {
    print_info "Building Linux installer..."
    
    LINUX_BUILD="$BUILD_DIR/linux"
    mkdir -p "$LINUX_BUILD"
    
    # Copy the install script
    cp "$INSTALLERS_DIR/linux/install.sh" "$LINUX_BUILD/"
    chmod +x "$LINUX_BUILD/install.sh"
    
    # Create a tar.gz package
    cd "$PROJECT_ROOT"
    tar -czf "$LINUX_BUILD/blackjack-$VERSION-linux.tar.gz" \
        --exclude='.git' \
        --exclude='build' \
        --exclude='installers' \
        --exclude='*.log' \
        .
    
    print_success "Linux installer built: blackjack-$VERSION-linux.tar.gz"
}

# Build Debian package
build_debian_package() {
    print_info "Building Debian package..."
    
    if ! command -v dpkg-deb &> /dev/null; then
        print_warning "dpkg-deb not found. Skipping Debian package build."
        return 0
    fi
    
    DEBIAN_BUILD="$BUILD_DIR/debian"
    mkdir -p "$DEBIAN_BUILD"
    
    # Create package structure
    PACKAGE_DIR="$DEBIAN_BUILD/blackjack-ssh-client-$VERSION"
    mkdir -p "$PACKAGE_DIR/DEBIAN"
    mkdir -p "$PACKAGE_DIR/opt/blackjack"
    mkdir -p "$PACKAGE_DIR/usr/local/bin"
    mkdir -p "$PACKAGE_DIR/usr/share/applications"
    mkdir -p "$PACKAGE_DIR/usr/share/pixmaps"
    mkdir -p "$PACKAGE_DIR/etc/systemd/system"
    
    # Copy control files
    cp "$INSTALLERS_DIR/linux/debian/DEBIAN/"* "$PACKAGE_DIR/DEBIAN/"
    
    # Copy application files
    cp -r "$PROJECT_ROOT/web-app" "$PACKAGE_DIR/opt/blackjack/"
    cp -r "$PROJECT_ROOT/web-server" "$PACKAGE_DIR/opt/blackjack/"
    cp "$PROJECT_ROOT/start.sh" "$PACKAGE_DIR/opt/blackjack/"
    cp "$PROJECT_ROOT/VERSION" "$PACKAGE_DIR/opt/blackjack/"
    
    # Set permissions
    chmod +x "$PACKAGE_DIR/opt/blackjack/start.sh"
    chmod +x "$PACKAGE_DIR/opt/blackjack/web-server/run.sh"
    
    # Create systemd service
    cat > "$PACKAGE_DIR/etc/systemd/system/blackjack.service" << 'EOF'
[Unit]
Description=BlackJack SSH Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/blackjack
ExecStart=/opt/blackjack/web-server/blackjack-server
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Create desktop entry
    cat > "$PACKAGE_DIR/usr/share/applications/blackjack.desktop" << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=BlackJack SSH Client
Comment=Modern SSH Management Made Simple
Exec=/usr/local/bin/blackjack
Icon=blackjack
Terminal=false
Categories=Network;RemoteAccess;
StartupNotify=true
EOF

    # Create command line launcher
    cat > "$PACKAGE_DIR/usr/local/bin/blackjack" << 'EOF'
#!/bin/bash
# BlackJack SSH Client Launcher

case "$1" in
    start)
        sudo systemctl start blackjack
        echo "BlackJack SSH Client started"
        echo "Access at: http://localhost:8082"
        ;;
    stop)
        sudo systemctl stop blackjack
        echo "BlackJack SSH Client stopped"
        ;;
    restart)
        sudo systemctl restart blackjack
        echo "BlackJack SSH Client restarted"
        ;;
    status)
        sudo systemctl status blackjack
        ;;
    logs)
        sudo journalctl -u blackjack -f
        ;;
    *)
        echo "Usage: blackjack {start|stop|restart|status|logs}"
        echo ""
        echo "BlackJack SSH Client - Modern SSH Management Made Simple"
        echo ""
        echo "Commands:"
        echo "  start   - Start the BlackJack service"
        echo "  stop    - Stop the BlackJack service"
        echo "  restart - Restart the BlackJack service"
        echo "  status  - Show service status"
        echo "  logs    - Show service logs"
        echo ""
        echo "Once started, access BlackJack at: http://localhost:8082"
        ;;
esac
EOF

    chmod +x "$PACKAGE_DIR/usr/local/bin/blackjack"
    
    # Build the package
    cd "$DEBIAN_BUILD"
    dpkg-deb --build "blackjack-ssh-client-$VERSION"
    
    # Move to build directory
    mv "blackjack-ssh-client-$VERSION.deb" "$BUILD_DIR/"
    
    print_success "Debian package built: blackjack-ssh-client-$VERSION.deb"
}

# Build RPM package
build_rpm_package() {
    print_info "Building RPM package..."
    
    if ! command -v rpmbuild &> /dev/null; then
        print_warning "rpmbuild not found. Skipping RPM package build."
        return 0
    fi
    
    RPM_BUILD="$BUILD_DIR/rpm"
    mkdir -p "$RPM_BUILD"
    
    # Create source tarball
    cd "$PROJECT_ROOT"
    tar -czf "$RPM_BUILD/blackjack-ssh-client-$VERSION.tar.gz" \
        --exclude='.git' \
        --exclude='build' \
        --exclude='installers' \
        --exclude='*.log' \
        .
    
    # Copy spec file
    cp "$INSTALLERS_DIR/linux/rpm/blackjack.spec" "$RPM_BUILD/"
    
    # Build RPM
    cd "$RPM_BUILD"
    rpmbuild -ba blackjack.spec --define "_topdir $(pwd)" --define "_sourcedir $(pwd)" --define "_builddir $(pwd)" --define "_srcrpmdir $(pwd)" --define "_rpmdir $(pwd)"
    
    # Find and move the built RPM
    RPM_FILE=$(find . -name "*.rpm" -type f | head -1)
    if [[ -n "$RPM_FILE" ]]; then
        mv "$RPM_FILE" "$BUILD_DIR/"
        print_success "RPM package built: $(basename "$RPM_FILE")"
    else
        print_error "RPM build failed"
    fi
}

# Create installation documentation
create_docs() {
    print_info "Creating installation documentation..."
    
    cat > "$BUILD_DIR/INSTALL.md" << EOF
# BlackJack SSH Client Installation Guide

## Windows Installation

### Method 1: Windows Installer (Recommended)
1. Download \`BlackJack-Setup-$VERSION.exe\`
2. Run the installer as Administrator
3. Follow the installation wizard
4. BlackJack will start automatically
5. Access the web interface at: http://localhost:8082

### Method 2: Manual Installation
1. Download and extract the source code
2. Install Go from https://golang.org/dl/
3. Run \`go build -o blackjack-server.exe web-server/main.go\`
4. Run \`blackjack-server.exe\`

## Linux Installation

### Method 1: Package Manager (Recommended)

#### Ubuntu/Debian:
\`\`\`bash
sudo dpkg -i blackjack-ssh-client-$VERSION.deb
sudo systemctl start blackjack
\`\`\`

#### CentOS/RHEL/Fedora:
\`\`\`bash
sudo rpm -i blackjack-ssh-client-$VERSION.rpm
sudo systemctl start blackjack
\`\`\`

### Method 2: Install Script
\`\`\`bash
# Download and extract
tar -xzf blackjack-$VERSION-linux.tar.gz
cd blackjack-$VERSION

# Run installer
sudo ./installers/linux/install.sh
\`\`\`

### Method 3: Manual Installation
\`\`\`bash
# Install Go
wget https://golang.org/dl/go1.22.2.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.2.linux-amd64.tar.gz
export PATH=\$PATH:/usr/local/go/bin

# Build and run
cd web-server
go build -o blackjack-server main.go
sudo ./blackjack-server
\`\`\`

## Usage

After installation, BlackJack SSH Client will be available at:
- **Web Interface**: http://localhost:8082
- **Command Line**: \`blackjack {start|stop|restart|status|logs}\`

## Uninstallation

### Windows:
- Use "Add or Remove Programs" in Windows Settings
- Or run the uninstaller from the Start Menu

### Linux:
- **Package Manager**: \`sudo apt remove blackjack-ssh-client\` or \`sudo rpm -e blackjack-ssh-client\`
- **Manual**: \`sudo /opt/blackjack/uninstall.sh\`

## Support

- **GitHub**: https://github.com/Zmk55/BlackJack
- **Issues**: https://github.com/Zmk55/BlackJack/issues
- **Documentation**: https://github.com/Zmk55/BlackJack/wiki

## Features

- 🌐 Web-based SSH terminal with xterm.js
- 📁 SFTP file browser with drag-and-drop
- 🏷️ Host management with groups and tags
- 🔐 Encrypted credential storage
- 🌍 Cross-platform compatibility
- 🎨 Modern, responsive web interface
- 🔄 Automatic updates
- 📊 Session management
- 🛡️ Security features

EOF

    print_success "Installation documentation created"
}

# Main build function
main() {
    print_header
    
    create_build_dir
    
    # Build Windows executable (always try if Go is available)
    build_windows_executable
    
    # Build Windows installer if NSIS is available
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || command -v makensis &> /dev/null; then
        build_windows_installer
    else
        print_warning "Skipping Windows installer (NSIS not available)"
    fi
    
    build_linux_installer
    build_debian_package
    build_rpm_package
    create_docs
    
    print_success "All installers built successfully!"
    echo
    print_info "Build artifacts are in: $BUILD_DIR"
    ls -la "$BUILD_DIR"
    echo
    print_info "Installation guide: $BUILD_DIR/INSTALL.md"
}

# Run main function
main "$@"

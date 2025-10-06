#!/bin/bash

# BlackJack SSH Client Linux Installer
# Supports Ubuntu/Debian, CentOS/RHEL, Fedora, and other distributions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="BlackJack SSH Client"
APP_DIR="/opt/blackjack"
BIN_DIR="/usr/local/bin"
DESKTOP_DIR="/usr/share/applications"
ICON_DIR="/usr/share/pixmaps"
SERVICE_DIR="/etc/systemd/system"
USER_HOME="$HOME"
VERSION="1.0.0"

# Functions
print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    BlackJack SSH Client                     ║"
    echo "║              Modern SSH Management Made Simple              ║"
    echo "║                        Linux Installer                      ║"
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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root for security reasons."
        print_info "Please run as a regular user. The script will ask for sudo when needed."
        exit 1
    fi
}

# Detect Linux distribution
detect_distro() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION_ID=$VERSION_ID
    elif [[ -f /etc/redhat-release ]]; then
        DISTRO="rhel"
    elif [[ -f /etc/debian_version ]]; then
        DISTRO="debian"
    else
        DISTRO="unknown"
    fi
    
    print_info "Detected distribution: $DISTRO"
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies..."
    
    case $DISTRO in
        ubuntu|debian)
            sudo apt-get update
            sudo apt-get install -y curl wget unzip systemd
            ;;
        centos|rhel|fedora)
            if command -v dnf &> /dev/null; then
                sudo dnf install -y curl wget unzip systemd
            else
                sudo yum install -y curl wget unzip systemd
            fi
            ;;
        arch|manjaro)
            sudo pacman -S --noconfirm curl wget unzip systemd
            ;;
        *)
            print_warning "Unknown distribution. Please install Go manually."
            ;;
    esac
    
    print_success "Dependencies installed"
}

# Install Go if not present
install_go() {
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version | cut -d' ' -f3 | sed 's/go//')
        print_success "Go is already installed: $GO_VERSION"
        return
    fi
    
    print_info "Installing Go..."
    
    # Download and install Go
    GO_VERSION="1.22.2"
    GO_ARCH="linux-amd64"
    
    if [[ $(uname -m) == "aarch64" ]]; then
        GO_ARCH="linux-arm64"
    fi
    
    cd /tmp
    wget "https://golang.org/dl/go${GO_VERSION}.${GO_ARCH}.tar.gz"
    sudo tar -C /usr/local -xzf "go${GO_VERSION}.${GO_ARCH}.tar.gz"
    rm "go${GO_VERSION}.${GO_ARCH}.tar.gz"
    
    # Add Go to PATH
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.profile
    export PATH=$PATH:/usr/local/go/bin
    
    print_success "Go installed successfully"
}

# Create application directory
create_directories() {
    print_info "Creating application directories..."
    
    sudo mkdir -p "$APP_DIR"
    sudo mkdir -p "$APP_DIR/web-app"
    sudo mkdir -p "$APP_DIR/web-server"
    sudo mkdir -p "$APP_DIR/logs"
    
    print_success "Directories created"
}

# Copy application files
copy_files() {
    print_info "Copying application files..."
    
    # Get the directory where this script is located
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
    
    # Copy files
    sudo cp -r "$PROJECT_ROOT/web-app"/* "$APP_DIR/web-app/"
    sudo cp -r "$PROJECT_ROOT/web-server"/* "$APP_DIR/web-server/"
    sudo cp "$PROJECT_ROOT/start.sh" "$APP_DIR/"
    sudo cp "$PROJECT_ROOT/VERSION" "$APP_DIR/"
    
    # Set permissions
    sudo chown -R root:root "$APP_DIR"
    sudo chmod +x "$APP_DIR/start.sh"
    sudo chmod +x "$APP_DIR/web-server/run.sh"
    
    print_success "Files copied"
}

# Build the application
build_application() {
    print_info "Building BlackJack application..."
    
    cd "$APP_DIR/web-server"
    
    # Set Go environment
    export GOPATH="$APP_DIR"
    export PATH=$PATH:/usr/local/go/bin
    
    # Build the application
    sudo -E go build -o blackjack-server main.go
    
    print_success "Application built successfully"
}

# Create systemd service
create_service() {
    print_info "Creating systemd service..."
    
    sudo tee "$SERVICE_DIR/blackjack.service" > /dev/null <<EOF
[Unit]
Description=BlackJack SSH Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/web-server/blackjack-server
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable blackjack.service
    
    print_success "Systemd service created"
}

# Create desktop entry
create_desktop_entry() {
    print_info "Creating desktop entry..."
    
    sudo tee "$DESKTOP_DIR/blackjack.desktop" > /dev/null <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=BlackJack SSH Client
Comment=Modern SSH Management Made Simple
Exec=$BIN_DIR/blackjack
Icon=blackjack
Terminal=false
Categories=Network;RemoteAccess;
StartupNotify=true
EOF

    print_success "Desktop entry created"
}

# Create command line launcher
create_launcher() {
    print_info "Creating command line launcher..."
    
    sudo tee "$BIN_DIR/blackjack" > /dev/null <<EOF
#!/bin/bash
# BlackJack SSH Client Launcher

case "\$1" in
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

    sudo chmod +x "$BIN_DIR/blackjack"
    
    print_success "Command line launcher created"
}

# Create uninstaller
create_uninstaller() {
    print_info "Creating uninstaller..."
    
    sudo tee "$APP_DIR/uninstall.sh" > /dev/null <<EOF
#!/bin/bash
# BlackJack SSH Client Uninstaller

echo "Uninstalling BlackJack SSH Client..."

# Stop and disable service
sudo systemctl stop blackjack
sudo systemctl disable blackjack

# Remove service file
sudo rm -f $SERVICE_DIR/blackjack.service
sudo systemctl daemon-reload

# Remove application files
sudo rm -rf $APP_DIR

# Remove desktop entry
sudo rm -f $DESKTOP_DIR/blackjack.desktop

# Remove launcher
sudo rm -f $BIN_DIR/blackjack

echo "BlackJack SSH Client has been uninstalled."
EOF

    sudo chmod +x "$APP_DIR/uninstall.sh"
    
    print_success "Uninstaller created"
}

# Main installation function
main() {
    print_header
    
    # Check if already installed
    if [[ -d "$APP_DIR" ]]; then
        print_warning "BlackJack appears to be already installed."
        read -p "Do you want to reinstall? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Installation cancelled."
            exit 0
        fi
    fi
    
    check_root
    detect_distro
    install_dependencies
    install_go
    create_directories
    copy_files
    build_application
    create_service
    create_desktop_entry
    create_launcher
    create_uninstaller
    
    print_success "Installation completed successfully!"
    echo
    print_info "BlackJack SSH Client has been installed to: $APP_DIR"
    print_info "To start BlackJack, run: blackjack start"
    print_info "To access the web interface: http://localhost:8082"
    print_info "To uninstall, run: sudo $APP_DIR/uninstall.sh"
    echo
    
    # Ask if user wants to start the service
    read -p "Would you like to start BlackJack now? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        sudo systemctl start blackjack
        print_success "BlackJack SSH Client started!"
        print_info "Access the web interface at: http://localhost:8082"
    fi
}

# Run main function
main "$@"

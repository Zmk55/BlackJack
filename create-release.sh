#!/bin/bash

# BlackJack Release Creation Script
# Creates GitHub releases with all installers and documentation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERSION=$(cat VERSION 2>/dev/null || echo "1.0.0")
REPO_OWNER="Zmk55"
REPO_NAME="BlackJack"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

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
    
    # Check if GitHub CLI is installed
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI (gh) is not installed."
        print_info "Install it from: https://cli.github.com/"
        print_info "Or set GITHUB_TOKEN environment variable for API access"
        return 1
    fi
    
    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        print_error "Not authenticated with GitHub CLI."
        print_info "Run: gh auth login"
        return 1
    fi
    
    # Check if build directory exists
    if [[ ! -d "build" ]]; then
        print_error "Build directory not found. Run ./installers/build-installers.sh first"
        return 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build all installers
build_installers() {
    print_info "Building all installers..."
    
    if [[ -f "installers/build-installers.sh" ]]; then
        ./installers/build-installers.sh
        print_success "Installers built successfully"
    else
        print_error "Build script not found: installers/build-installers.sh"
        return 1
    fi
}

# Create release notes
create_release_notes() {
    print_info "Creating release notes..."
    
    cat > "RELEASE_NOTES.md" << EOF
# BlackJack SSH Client v$VERSION

## 🚀 What's New

### ✨ Core Features
- **Real SSH Terminal**: Full xterm.js terminal emulation with actual SSH protocol
- **SFTP File Browser**: Dual-pane file browser with drag-and-drop transfers
- **Encrypted Storage**: AES-256-GCM encryption for all sensitive data
- **Cross-Platform**: Windows, Linux, and macOS support

### 🔐 Security Features
- **SSH Key Management**: Automatic SSH key detection and authentication
- **Password Fallback**: Automatic fallback to password authentication
- **Encrypted Sessions**: Secure session management with encrypted cookies
- **Access Control**: User authentication and authorization system

### 🏷️ Host Management
- **Hierarchical Groups**: Organize hosts with nested group structures
- **Smart Tags**: Color-coded tags with automatic Tailscale detection
- **Search & Filter**: Real-time search across all host properties
- **Import/Export**: Backup and restore host configurations

### 🔄 Update System
- **Automatic Updates**: Built-in version checking and update notifications
- **One-Click Updates**: Simple update process with automatic restart
- **Version Management**: Comprehensive version tracking and management

## 📦 Installation

### Windows
1. Download \`BlackJack-Setup-$VERSION.exe\`
2. Run as Administrator
3. Follow the installation wizard
4. Access at: http://localhost:8082

### Linux
#### Ubuntu/Debian
\`\`\`bash
sudo dpkg -i blackjack-ssh-client-$VERSION.deb
sudo systemctl start blackjack
\`\`\`

#### CentOS/RHEL/Fedora
\`\`\`bash
sudo rpm -i blackjack-ssh-client-$VERSION.rpm
sudo systemctl start blackjack
\`\`\`

#### Generic Linux
\`\`\`bash
tar -xzf blackjack-$VERSION-linux.tar.gz
cd blackjack-$VERSION
sudo ./installers/linux/install.sh
\`\`\`

## 🎮 Usage

After installation:
1. Open http://localhost:8082 in your browser
2. Create your admin account
3. Add SSH hosts
4. Connect and start managing your servers!

## 🔧 Command Line

\`\`\`bash
blackjack start    # Start the service
blackjack stop     # Stop the service
blackjack status   # Check status
blackjack logs     # View logs
\`\`\`

## 📋 System Requirements

- **OS**: Windows 10+, Ubuntu 18.04+, CentOS 7+, macOS 10.14+
- **RAM**: 512 MB minimum, 2 GB recommended
- **Storage**: 100 MB minimum, 500 MB recommended
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## 🆘 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/$REPO_OWNER/$REPO_NAME/issues)
- **Documentation**: [Installation Guide](https://github.com/$REPO_OWNER/$REPO_NAME/blob/main/INSTALLATION.md)
- **Discussions**: [GitHub Discussions](https://github.com/$REPO_OWNER/$REPO_NAME/discussions)

## 📈 Changelog

### v$VERSION
- 🌐 Real SSH terminal with xterm.js
- 📁 SFTP file browser with drag-and-drop
- 🔐 Encrypted credential storage
- 🚀 Cross-platform installers
- 🏷️ Advanced host management
- 🔄 Automatic update system
- 🎨 Modern web interface
- 🌍 Cross-platform compatibility

---

**BlackJack** - Modern SSH Management Made Simple 🚀

*Ready to revolutionize your SSH workflow? Download now and experience the future of SSH management!*
EOF

    print_success "Release notes created: RELEASE_NOTES.md"
}

# Create GitHub release
create_github_release() {
    print_info "Creating GitHub release..."
    
    # Check if release already exists
    if gh release view "v$VERSION" &> /dev/null; then
        print_warning "Release v$VERSION already exists. Updating..."
        
        # Delete existing release
        gh release delete "v$VERSION" --yes
        
        # Wait a moment
        sleep 2
    fi
    
    # Create the release
    gh release create "v$VERSION" \
        --title "BlackJack SSH Client v$VERSION" \
        --notes-file "RELEASE_NOTES.md" \
        --latest \
        build/blackjack-ssh-client-$VERSION.deb \
        build/linux/blackjack-$VERSION-linux.tar.gz \
        build/linux/install.sh \
        build/INSTALL.md
    
    print_success "GitHub release created: v$VERSION"
}

# Create release summary
create_summary() {
    print_info "Creating release summary..."
    
    echo
    print_success "Release v$VERSION created successfully!"
    echo
    print_info "Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/v$VERSION"
    echo
    print_info "Download links:"
    echo "  • Windows: https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$VERSION/BlackJack-Setup-$VERSION.exe"
    echo "  • Linux DEB: https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$VERSION/blackjack-ssh-client-$VERSION.deb"
    echo "  • Linux RPM: https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$VERSION/blackjack-ssh-client-$VERSION.rpm"
    echo "  • Linux TAR: https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$VERSION/blackjack-$VERSION-linux.tar.gz"
    echo
    print_info "Installation guide: https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v$VERSION/INSTALL.md"
    echo
}

# Main function
main() {
    print_header
    
    # Check if we're in the right directory
    if [[ ! -f "VERSION" ]] || [[ ! -d "web-server" ]]; then
        print_error "Please run this script from the BlackJack project root directory"
        exit 1
    fi
    
    # Check prerequisites
    if ! check_prerequisites; then
        exit 1
    fi
    
    # Build installers
    build_installers
    
    # Create release notes
    create_release_notes
    
    # Create GitHub release
    create_github_release
    
    # Create summary
    create_summary
    
    print_success "Release process completed successfully!"
}

# Run main function
main "$@"

# BlackJack SSH Client

**Modern SSH Management Made Simple** 🚀

A comprehensive, cross-platform SSH client with web-based terminal, SFTP file browser, encrypted credential storage, and advanced host management.

## ✨ Key Features

### 🌐 **Web-Based SSH Terminal**
- **Real SSH Connections**: Full xterm.js terminal emulation with actual SSH protocol
- **Multiple Sessions**: Tabbed interface with concurrent SSH connections
- **WebSocket Communication**: Real-time bidirectional communication
- **Session Management**: Persistent sessions with automatic reconnection

### 📁 **SFTP File Browser**
- **Dual-Pane Interface**: Local and remote file systems side-by-side
- **Drag & Drop**: Intuitive file transfers between local and remote machines
- **File Operations**: Create, edit, delete, upload, and download files
- **Directory Navigation**: Clickable path breadcrumbs and parent directory links
- **Hidden Files**: Toggle visibility of hidden files and directories
- **File Editor**: Built-in code editor with syntax highlighting

### 🔐 **Security & Authentication**
- **Encrypted Storage**: AES-256-GCM encryption for all sensitive data
- **SSH Key Management**: Automatic SSH key detection and authentication
- **Password Fallback**: Automatic fallback to password authentication
- **Session Security**: Secure session management with encrypted cookies
- **Access Control**: User authentication and authorization system

### 🏷️ **Advanced Host Management**
- **Hierarchical Groups**: Organize hosts with nested group structures
- **Smart Tagging**: Color-coded tags with automatic Tailscale detection
- **Search & Filter**: Real-time search across hostnames, groups, and tags
- **Host Services**: Configure and manage multiple services per host
- **Import/Export**: Backup and restore host configurations

### 🌍 **Cross-Platform Support**
- **Windows**: Native installer with system integration
- **Linux**: .deb/.rpm packages with systemd service
- **macOS**: Universal compatibility
- **Web Access**: Works on any device with a modern browser

## 🚀 Quick Start

### 📥 **Download & Install**

#### **🔗 Direct Download Links**
| Platform | Download | Size | Instructions |
|----------|----------|------|--------------|
| **Windows** | [📦 Download Executable](https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-windows-1.0.0.zip) | ~5 MB | Extract and run `start-blackjack.bat` |
| **Windows Installer** | [📦 Download Installer](https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/BlackJack-Setup-1.0.0.exe) | ~5 MB | Run as Administrator |
| **Ubuntu/Debian** | [📦 Download .deb](https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-ssh-client-1.0.0.deb) | ~5 MB | `sudo dpkg -i blackjack-ssh-client-1.0.0.deb` |
| **CentOS/RHEL/Fedora** | [📦 Download .rpm](https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-ssh-client-1.0.0.rpm) | ~5 MB | `sudo rpm -i blackjack-ssh-client-1.0.0.rpm` |
| **Generic Linux** | [📦 Download .tar.gz](https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-1.0.0-linux.tar.gz) | ~200 MB | Extract and run `sudo ./install.sh` |

#### **⚡ One-Click Installation**

**Windows Users:**
```bash
# Method 1: Portable Executable (Recommended)
curl -L -o blackjack-windows.zip https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-windows-1.0.0.zip
# Extract the zip file and double-click start-blackjack.bat
# Access at: http://localhost:8082

# Method 2: Windows Installer
curl -L -o BlackJack-Setup.exe https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/BlackJack-Setup-1.0.0.exe
./BlackJack-Setup.exe
# Follow the GUI wizard - that's it!
# Access at: http://localhost:8082
```

**Linux Users:**
```bash
# Ubuntu/Debian
wget https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-ssh-client-1.0.0.deb
sudo dpkg -i blackjack-ssh-client-1.0.0.deb
sudo systemctl start blackjack

# CentOS/RHEL/Fedora
wget https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-ssh-client-1.0.0.rpm
sudo rpm -i blackjack-ssh-client-1.0.0.rpm
sudo systemctl start blackjack

# Generic Linux
wget https://github.com/Zmk55/BlackJack/releases/download/v1.0.0/blackjack-1.0.0-linux.tar.gz
tar -xzf blackjack-1.0.0-linux.tar.gz
cd blackjack-1.0.0
sudo ./installers/linux/install.sh
```

#### **🎮 Command Line Usage**
```bash
blackjack start    # Start the service
blackjack stop     # Stop the service
blackjack status   # Check status
blackjack logs     # View logs
```

#### **📋 All Downloads**
- **📥 [Download Page](DOWNLOADS.md)** - Complete download guide
- **🏷️ [All Releases](https://github.com/Zmk55/BlackJack/releases)** - Browse all versions
- **📚 [Installation Guide](INSTALLATION.md)** - Detailed setup instructions

### 🔧 **Development Setup**

#### **From Source**
```bash
# Clone the repository
git clone https://github.com/Zmk55/BlackJack.git
cd BlackJack

# Install Go (if not already installed)
# Download from: https://golang.org/dl/

# Build and run
cd web-server
go build -o blackjack-server main.go
./blackjack-server

# Access at: http://localhost:8082
```

#### **Unified Startup Script**
```bash
# Interactive mode
./start.sh

# Specific modes
./start.sh -m web          # Web application (default)
./start.sh -m desktop      # Desktop application
./start.sh -m tui          # Terminal UI
./start.sh -p 8080         # Custom port
```

## 🎮 Usage

### 🌐 **Web Interface**

1. **Access**: Open http://localhost:8082 in your browser
2. **First Setup**: Create your admin account on first visit
3. **Add Hosts**: Click "Add Host" to configure SSH connections
4. **Connect**: Click "Connect" to open SSH terminal or SFTP browser
5. **Organize**: Use groups and tags to organize your hosts
6. **Settings**: Configure security, updates, and data management

### 🔑 **SSH Terminal Features**

- **Real SSH Connections**: Full terminal emulation with actual SSH protocol
- **Multiple Sessions**: Open multiple SSH connections in separate tabs
- **Session Persistence**: Sessions survive browser refreshes
- **Keyboard Shortcuts**: Standard terminal shortcuts (Ctrl+C, Ctrl+D, etc.)
- **Copy/Paste**: Full clipboard support for text operations

### 📁 **SFTP File Browser**

- **Dual-Pane View**: Local and remote file systems side-by-side
- **Drag & Drop**: Drag files between local and remote machines
- **File Operations**: 
  - Create new files and directories
  - Edit files with built-in code editor
  - Delete files and directories
  - Upload/download multiple files
- **Navigation**: Clickable path breadcrumbs and parent directory links
- **Hidden Files**: Toggle visibility with checkbox controls
- **Sorting**: Click column headers to sort by name, size, or date

### 🏷️ **Host Management**

#### **Adding Hosts**
- **Basic Info**: Name, IP address, username, port
- **Authentication**: SSH keys (automatic detection) or passwords
- **Organization**: Assign to groups and add tags
- **Services**: Configure multiple services (HTTP, HTTPS, custom ports)

#### **Advanced Organization**
- **Hierarchical Groups**: Create nested group structures
- **Smart Tags**: Color-coded tags with automatic Tailscale detection
- **Search & Filter**: Real-time search across all host properties
- **Bulk Operations**: Select multiple hosts for batch operations

#### **Security Features**
- **Encrypted Storage**: All credentials encrypted with AES-256-GCM
- **SSH Key Management**: Automatic detection of SSH keys
- **Password Fallback**: Automatic fallback when SSH keys fail
- **Session Security**: Secure session management with encrypted cookies

## ⚙️ Configuration

### 🔐 **Security & Authentication**

#### **Encrypted Data Storage**
- **AES-256-GCM Encryption**: All sensitive data encrypted at rest
- **PBKDF2 Key Derivation**: Secure key generation from master password
- **Secure Sessions**: Encrypted session cookies with configurable duration
- **Access Control**: User authentication and authorization system

#### **SSH Authentication**
- **Automatic SSH Key Detection**: Supports id_rsa, id_ed25519, id_ecdsa, id_dsa
- **SSH Agent Integration**: Uses SSH agent when available
- **Password Fallback**: Automatic fallback to password authentication
- **Cross-Platform**: Works on Windows, Linux, and macOS

### 📊 **Data Management**

#### **Backup & Restore**
- **Full Database Export**: Encrypted backup of all data
- **Individual Host Export**: Export specific hosts to JSON
- **Import System**: Smart import with duplicate detection
- **Data Validation**: Comprehensive validation and error handling

#### **Configuration Files**
- **Linux**: `/opt/blackjack/web-server/config.json`
- **Windows**: `C:\Program Files\BlackJack SSH Client\web-server\config.json`

### 🌐 **Network Configuration**

#### **Port Configuration**
```bash
# Default port: 8082
# Custom port via environment variable
export BLACKJACK_PORT=8080

# Or via command line
./blackjack-server -port 8080
```

#### **Firewall Rules**
- **Windows**: Automatically configured during installation
- **Linux**: Manual configuration may be required
```bash
# Ubuntu/Debian
sudo ufw allow 8082

# CentOS/RHEL/Fedora
sudo firewall-cmd --permanent --add-port=8082/tcp
sudo firewall-cmd --reload
```

### 🔄 **Update System**

#### **Automatic Updates**
- **Version Checking**: Automatic detection of new versions
- **Update Notifications**: In-app notifications for available updates
- **One-Click Updates**: Simple update process with automatic restart
- **Rollback Support**: Ability to revert to previous versions

#### **Manual Updates**
```bash
# Check for updates
blackjack update-check

# Download and install update
blackjack update

# View version information
blackjack version
```

## 🛠️ Development

### 📁 **Project Structure**

```
BlackJack/
├── web-app/                    # Web frontend
│   ├── index.html             # Main interface
│   ├── styles.css             # Modern styling
│   ├── app.js                 # Application logic
│   ├── version.js             # Version information
│   └── update.js              # Update system
├── web-server/                 # Go backend
│   ├── main.go                # Main server
│   ├── config.json            # Configuration
│   └── run.sh                 # Startup script
├── installers/                 # Installation packages
│   ├── windows/               # Windows installer (NSIS)
│   ├── linux/                 # Linux installers
│   └── build-installers.sh    # Build script
├── desktop/                    # Tauri desktop app
│   ├── src-tauri/            # Rust backend
│   └── web/                  # Web frontend
├── build/                     # Build artifacts
├── VERSION                    # Version file
└── INSTALLATION.md           # Installation guide
```

### 🔧 **Development Setup**

#### **Prerequisites**
- **Go**: 1.22+ (for backend development)
- **Node.js**: 16+ (for frontend development)
- **Git**: For version control

#### **Local Development**
```bash
# Clone repository
git clone https://github.com/Zmk55/BlackJack.git
cd BlackJack

# Backend development
cd web-server
go mod tidy
go run main.go

# Frontend development (in another terminal)
cd web-app
python3 -m http.server 8083

# Access at: http://localhost:8082
```

#### **Building from Source**
```bash
# Build backend
cd web-server
go build -o blackjack-server main.go

# Build Windows executable
make build-windows-go
# Or use the build script directly:
./dev/build-windows.bat  # Windows
./dev/build-windows-final.ps1  # PowerShell (recommended)

# Build installers
./installers/build-installers.sh

# Build desktop app
cd desktop
npm install
npm run tauri build

# Create GitHub release with Windows executable
./create-release.sh
```

### 🏗️ **Architecture**

#### **Backend (Go)**
- **HTTP Server**: RESTful API and static file serving
- **WebSocket Handler**: Real-time SSH and SFTP communication
- **SSH Client**: Go SSH library for terminal connections
- **SFTP Client**: File transfer protocol implementation
- **Encryption**: AES-256-GCM for data security
- **Authentication**: Session-based user authentication

#### **Frontend (JavaScript)**
- **WebSocket Client**: Real-time communication with backend
- **Terminal Emulation**: xterm.js for SSH terminal
- **File Browser**: Custom SFTP file management interface
- **Host Management**: CRUD operations for SSH hosts
- **State Management**: LocalStorage for client-side persistence

#### **Key Technologies**
- **Backend**: Go, WebSocket, SSH, SFTP, AES encryption
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), xterm.js
- **Desktop**: Tauri (Rust + Web)
- **Installation**: NSIS (Windows), dpkg/rpm (Linux)
- **Security**: AES-256-GCM, PBKDF2, secure sessions

## 📋 System Requirements

### **Minimum Requirements**
- **OS**: Windows 10, Ubuntu 18.04+, CentOS 7+, macOS 10.14+
- **RAM**: 512 MB
- **Storage**: 100 MB
- **Network**: Internet connection for updates

### **Recommended Requirements**
- **OS**: Windows 11, Ubuntu 20.04+, CentOS 8+, macOS 11+
- **RAM**: 2 GB
- **Storage**: 500 MB
- **Network**: Stable internet connection

### **Dependencies**
- **Go**: 1.22+ (for building from source)
- **Systemd**: For Linux service management
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## 🌐 Browser Compatibility

- **Chrome**: 90+ (Recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### **Getting Started**
1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/BlackJack.git`
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes
5. **Test** thoroughly
6. **Commit** your changes: `git commit -m 'Add amazing feature'`
7. **Push** to your branch: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

### **Development Guidelines**
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure cross-platform compatibility
- Test on multiple browsers

### **Areas for Contribution**
- 🐛 **Bug Fixes**: Report and fix issues
- ✨ **New Features**: Add functionality
- 📚 **Documentation**: Improve guides and docs
- 🎨 **UI/UX**: Enhance user interface
- 🔒 **Security**: Improve security features
- 🌍 **Localization**: Add language support

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🗺️ Roadmap

### **v1.0.0 (Current) ✅**
- ✅ Real SSH terminal with xterm.js
- ✅ SFTP file browser with drag-and-drop
- ✅ Encrypted credential storage
- ✅ Cross-platform installers
- ✅ Host management with groups and tags
- ✅ Automatic update system
- ✅ Modern web interface
- ✅ Session persistence

### **v1.1.0 (Planned) 🚧**
- [ ] SSH key management interface
- [ ] Session recording and playback
- [ ] Team collaboration features
- [ ] Cloud synchronization
- [ ] Mobile responsive improvements
- [ ] Plugin system architecture

### **v1.2.0 (Future) 🔮**
- [ ] Multi-user support
- [ ] Role-based access control
- [ ] API for third-party integrations
- [ ] Advanced terminal features
- [ ] Container deployment support
- [ ] Enterprise features

## 🆘 Support

### **Getting Help**
- **GitHub Issues**: [Report bugs and request features](https://github.com/Zmk55/BlackJack/issues)
- **Documentation**: [Installation Guide](INSTALLATION.md) and inline code comments
- **Discussions**: [GitHub Discussions](https://github.com/Zmk55/BlackJack/discussions)

### **Reporting Issues**
When reporting issues, please include:
- Operating system and version
- Browser and version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or error messages

### **Feature Requests**
For feature requests, please:
- Check existing issues first
- Describe the use case
- Explain the expected behavior
- Consider contributing code

## 📈 Changelog

### **v1.0.0 (Current)**
- 🌐 **Real SSH Terminal**: Full xterm.js terminal emulation with actual SSH protocol
- 📁 **SFTP File Browser**: Dual-pane file browser with drag-and-drop transfers
- 🔐 **Encrypted Storage**: AES-256-GCM encryption for all sensitive data
- 🚀 **Cross-Platform Installers**: Windows (.exe) and Linux (.deb/.rpm) packages
- 🏷️ **Advanced Host Management**: Hierarchical groups, smart tags, and search
- 🔄 **Update System**: Automatic version checking and one-click updates
- 🎨 **Modern UI**: Responsive design with dark theme and smooth animations
- 🌍 **Cross-Platform**: Windows, Linux, and macOS support
- 🔒 **Security**: SSH key management, password fallback, and secure sessions
- 📊 **Data Management**: Backup, restore, and import/export functionality

---

## 🎯 **Why BlackJack?**

BlackJack combines the power of traditional SSH clients with modern web technologies to provide:

- **🚀 Easy Installation**: One-click installers for all platforms
- **🔒 Enterprise Security**: Military-grade encryption and secure authentication
- **🌐 Web-Based Access**: Use from any device with a modern browser
- **📁 File Management**: Integrated SFTP browser with drag-and-drop
- **🏷️ Smart Organization**: Advanced host management with groups and tags
- **🔄 Always Updated**: Automatic update system keeps you current
- **🌍 Cross-Platform**: Works seamlessly on Windows, Linux, and macOS

**BlackJack** - Modern SSH Management Made Simple 🚀

*Ready to revolutionize your SSH workflow? [Download now](https://github.com/Zmk55/BlackJack/releases) and experience the future of SSH management!*
# BlackJack SSH Client - Installation Guide

## 🚀 Quick Start

### Windows Users
1. **Download**: `BlackJack-Setup-1.0.0.exe`
2. **Run as Administrator**: Double-click the installer
3. **Follow the wizard**: Click "Next" through the installation
4. **Access**: Open http://localhost:8082 in your browser

### Linux Users
1. **Download**: Choose your distribution package
   - Ubuntu/Debian: `blackjack-ssh-client-1.0.0.deb`
   - CentOS/RHEL/Fedora: `blackjack-ssh-client-1.0.0.rpm`
   - Generic Linux: `blackjack-1.0.0-linux.tar.gz`
2. **Install**: Use your package manager or install script
3. **Start**: Run `blackjack start`
4. **Access**: Open http://localhost:8082 in your browser

---

## 📦 Installation Methods

### Windows Installation

#### Method 1: Windows Installer (Recommended)
```bash
# Download the installer
wget https://github.com/Zmk55/BlackJack/releases/latest/download/BlackJack-Setup-1.0.0.exe

# Run as Administrator
# The installer will:
# - Install BlackJack to Program Files
# - Create desktop and start menu shortcuts
# - Set up Windows Firewall rules
# - Create system service (optional)
# - Start the application automatically
```

#### Method 2: Manual Installation
```bash
# 1. Install Go (if not already installed)
# Download from: https://golang.org/dl/

# 2. Download and extract BlackJack
git clone https://github.com/Zmk55/BlackJack.git
cd BlackJack

# 3. Build the application
cd web-server
go build -o blackjack-server.exe main.go

# 4. Run BlackJack
./blackjack-server.exe
```

### Linux Installation

#### Method 1: Package Manager (Recommended)

**Ubuntu/Debian:**
```bash
# Install the .deb package
sudo dpkg -i blackjack-ssh-client-1.0.0.deb

# Start the service
sudo systemctl start blackjack

# Enable auto-start on boot
sudo systemctl enable blackjack

# Check status
sudo systemctl status blackjack
```

**CentOS/RHEL/Fedora:**
```bash
# Install the .rpm package
sudo rpm -i blackjack-ssh-client-1.0.0.rpm

# Start the service
sudo systemctl start blackjack

# Enable auto-start on boot
sudo systemctl enable blackjack

# Check status
sudo systemctl status blackjack
```

#### Method 2: Install Script
```bash
# Download and extract
wget https://github.com/Zmk55/BlackJack/releases/latest/download/blackjack-1.0.0-linux.tar.gz
tar -xzf blackjack-1.0.0-linux.tar.gz
cd blackjack-1.0.0

# Run the installer
sudo ./installers/linux/install.sh

# The installer will:
# - Install dependencies (Go, systemd, etc.)
# - Build the application
# - Create systemd service
# - Set up desktop shortcuts
# - Create command-line launcher
```

#### Method 3: Manual Installation
```bash
# 1. Install Go
wget https://golang.org/dl/go1.22.2.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.22.2.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# 2. Download BlackJack
git clone https://github.com/Zmk55/BlackJack.git
cd BlackJack

# 3. Build the application
cd web-server
go build -o blackjack-server main.go

# 4. Run BlackJack
sudo ./blackjack-server
```

---

## 🎮 Usage

### Command Line Interface
```bash
# Start BlackJack
blackjack start

# Stop BlackJack
blackjack stop

# Restart BlackJack
blackjack restart

# Check status
blackjack status

# View logs
blackjack logs

# Show help
blackjack
```

### Web Interface
- **URL**: http://localhost:8082
- **Default Login**: Create account on first visit
- **Features**:
  - SSH terminal connections
  - SFTP file browser
  - Host management
  - Encrypted credential storage

---

## 🔧 Configuration

### First-Time Setup
1. **Access Web Interface**: http://localhost:8082
2. **Create Account**: Set up your admin credentials
3. **Add Hosts**: Configure your SSH servers
4. **Test Connections**: Verify SSH connectivity

### Configuration Files
- **Linux**: `/opt/blackjack/web-server/config.json`
- **Windows**: `C:\Program Files\BlackJack SSH Client\web-server\config.json`

### Environment Variables
```bash
# Custom port (default: 8082)
export BLACKJACK_PORT=8082

# Custom data directory
export BLACKJACK_DATA_DIR=/custom/path

# Debug mode
export BLACKJACK_DEBUG=true
```

---

## 🛠️ Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 8082
sudo netstat -tlnp | grep 8082

# Kill the process
sudo kill -9 <PID>

# Or use a different port
export BLACKJACK_PORT=8083
```

#### Permission Denied
```bash
# Linux: Ensure proper permissions
sudo chown -R root:root /opt/blackjack
sudo chmod +x /opt/blackjack/web-server/blackjack-server

# Windows: Run as Administrator
```

#### Service Won't Start
```bash
# Check service status
sudo systemctl status blackjack

# View detailed logs
sudo journalctl -u blackjack -f

# Restart service
sudo systemctl restart blackjack
```

#### SSH Connection Issues
- Verify SSH server is running
- Check firewall settings
- Ensure SSH keys are properly configured
- Test SSH connection manually: `ssh user@host`

### Log Files
- **Linux**: `sudo journalctl -u blackjack -f`
- **Windows**: Check Windows Event Viewer
- **Application**: `/opt/blackjack/logs/` (Linux) or `%PROGRAMFILES%\BlackJack SSH Client\logs\` (Windows)

---

## 🗑️ Uninstallation

### Windows
1. **Control Panel**: Add or Remove Programs → BlackJack SSH Client → Uninstall
2. **Start Menu**: BlackJack → Uninstall
3. **Manual**: Run `uninstall.exe` from installation directory

### Linux

#### Package Manager
```bash
# Ubuntu/Debian
sudo apt remove blackjack-ssh-client

# CentOS/RHEL/Fedora
sudo rpm -e blackjack-ssh-client
```

#### Manual Uninstall
```bash
# Run the uninstaller
sudo /opt/blackjack/uninstall.sh

# Or manual cleanup
sudo systemctl stop blackjack
sudo systemctl disable blackjack
sudo rm -rf /opt/blackjack
sudo rm -f /usr/local/bin/blackjack
sudo rm -f /usr/share/applications/blackjack.desktop
sudo rm -f /etc/systemd/system/blackjack.service
sudo systemctl daemon-reload
```

---

## 🔄 Updates

### Automatic Updates
BlackJack includes an automatic update system:
1. **Check for Updates**: Settings → Updates → Check for Updates
2. **Download Updates**: Click "Update Now" when available
3. **Restart Application**: Updates are applied automatically

### Manual Updates
```bash
# Download latest release
wget https://github.com/Zmk55/BlackJack/releases/latest/download/blackjack-ssh-client-1.0.1.deb

# Install update
sudo dpkg -i blackjack-ssh-client-1.0.1.deb

# Restart service
sudo systemctl restart blackjack
```

---

## 📞 Support

### Getting Help
- **GitHub Issues**: https://github.com/Zmk55/BlackJack/issues
- **Documentation**: https://github.com/Zmk55/BlackJack/wiki
- **Discussions**: https://github.com/Zmk55/BlackJack/discussions

### Reporting Bugs
1. Check existing issues first
2. Provide system information
3. Include error logs
4. Describe steps to reproduce

### Feature Requests
1. Check existing feature requests
2. Describe the use case
3. Explain the expected behavior
4. Consider contributing code

---

## 🎯 Features

### Core Features
- 🌐 **Web-based SSH Terminal**: Full xterm.js terminal emulation
- 📁 **SFTP File Browser**: Drag-and-drop file transfers
- 🏷️ **Host Management**: Organize servers with groups and tags
- 🔐 **Encrypted Storage**: Secure credential management
- 🌍 **Cross-platform**: Windows, Linux, macOS support
- 🎨 **Modern UI**: Responsive web interface
- 🔄 **Auto-updates**: Built-in update system
- 📊 **Session Management**: Multiple concurrent connections
- 🛡️ **Security**: Encrypted data storage and secure authentication

### Advanced Features
- **SSH Key Management**: Automatic SSH key detection
- **Password Fallback**: Automatic password authentication
- **File Editing**: Built-in code editor
- **Service Management**: Systemd service integration
- **Backup/Restore**: Data export and import
- **Multi-user Support**: User authentication and sessions
- **API Access**: RESTful API for automation
- **Plugin System**: Extensible architecture

---

## 📋 System Requirements

### Minimum Requirements
- **OS**: Windows 10, Ubuntu 18.04+, CentOS 7+, macOS 10.14+
- **RAM**: 512 MB
- **Storage**: 100 MB
- **Network**: Internet connection for updates

### Recommended Requirements
- **OS**: Windows 11, Ubuntu 20.04+, CentOS 8+, macOS 11+
- **RAM**: 2 GB
- **Storage**: 500 MB
- **Network**: Stable internet connection

### Dependencies
- **Go**: 1.22+ (for building from source)
- **Systemd**: For Linux service management
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

*BlackJack SSH Client - Modern SSH Management Made Simple* 🚀

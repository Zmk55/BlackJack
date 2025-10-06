# 🚀 BlackJack Release Guide

This guide explains how to create and manage GitHub releases for BlackJack SSH Client.

## 📋 Prerequisites

### **Required Tools**
1. **GitHub CLI** (`gh`) - [Install Guide](https://cli.github.com/)
2. **Git** - For version control
3. **Go** - For building the backend
4. **Build Tools** - For creating installers

### **Authentication**
```bash
# Authenticate with GitHub CLI
gh auth login

# Verify authentication
gh auth status
```

## 🏷️ Creating a Release

### **Method 1: Automated Script (Recommended)**

```bash
# Run the automated release script
./create-release.sh
```

This script will:
- ✅ Check prerequisites
- 🔨 Build all installers
- 📝 Create release notes
- 🏷️ Create GitHub release
- 📤 Upload all files

### **Method 2: Manual Process**

#### **Step 1: Build Installers**
```bash
# Build all installers
./installers/build-installers.sh
```

#### **Step 2: Create Release Notes**
```bash
# Create release notes (or edit manually)
./create-release.sh  # This will create RELEASE_NOTES.md
```

#### **Step 3: Create GitHub Release**
```bash
# Create the release
gh release create "v1.0.0" \
    --title "BlackJack SSH Client v1.0.0" \
    --notes-file "RELEASE_NOTES.md" \
    --latest \
    build/blackjack-ssh-client-1.0.0.deb \
    build/linux/blackjack-1.0.0-linux.tar.gz \
    build/linux/install.sh \
    build/INSTALL.md
```

## 📦 Release Files

### **What Gets Uploaded**
- **Windows**: `BlackJack-Setup-1.0.0.exe` (NSIS installer)
- **Linux DEB**: `blackjack-ssh-client-1.0.0.deb` (Ubuntu/Debian)
- **Linux RPM**: `blackjack-ssh-client-1.0.0.rpm` (CentOS/RHEL/Fedora)
- **Linux TAR**: `blackjack-1.0.0-linux.tar.gz` (Generic Linux)
- **Install Script**: `install.sh` (Universal Linux installer)
- **Documentation**: `INSTALL.md` (Installation guide)

### **File Locations**
```
build/
├── blackjack-ssh-client-1.0.0.deb
├── linux/
│   ├── blackjack-1.0.0-linux.tar.gz
│   └── install.sh
└── INSTALL.md
```

## 🔄 Version Management

### **Updating Version**
```bash
# Update version in VERSION file
echo "1.0.1" > VERSION

# Update version in web-app/version.js
echo "window.BLACKJACK_VERSION = '1.0.1';" > web-app/version.js
```

### **Version Files**
- `VERSION` - Main version file
- `web-app/version.js` - Frontend version
- `installers/windows/blackjack-installer.nsi` - Windows installer version
- `installers/linux/debian/DEBIAN/control` - Debian package version
- `installers/linux/rpm/blackjack.spec` - RPM package version

## 📝 Release Notes Template

```markdown
# BlackJack SSH Client v{VERSION}

## 🚀 What's New

### ✨ Core Features
- **Real SSH Terminal**: Full xterm.js terminal emulation
- **SFTP File Browser**: Dual-pane file browser with drag-and-drop
- **Encrypted Storage**: AES-256-GCM encryption for all sensitive data
- **Cross-Platform**: Windows, Linux, and macOS support

### 🔐 Security Features
- **SSH Key Management**: Automatic SSH key detection
- **Password Fallback**: Automatic fallback to password authentication
- **Encrypted Sessions**: Secure session management
- **Access Control**: User authentication and authorization

## 📦 Installation

### Windows
1. Download `BlackJack-Setup-{VERSION}.exe`
2. Run as Administrator
3. Follow the installation wizard
4. Access at: http://localhost:8082

### Linux
#### Ubuntu/Debian
```bash
sudo dpkg -i blackjack-ssh-client-{VERSION}.deb
sudo systemctl start blackjack
```

#### CentOS/RHEL/Fedora
```bash
sudo rpm -i blackjack-ssh-client-{VERSION}.rpm
sudo systemctl start blackjack
```

#### Generic Linux
```bash
tar -xzf blackjack-{VERSION}-linux.tar.gz
cd blackjack-{VERSION}
sudo ./installers/linux/install.sh
```

## 🎮 Usage

After installation:
1. Open http://localhost:8082 in your browser
2. Create your admin account
3. Add SSH hosts
4. Connect and start managing your servers!

## 🔧 Command Line

```bash
blackjack start    # Start the service
blackjack stop     # Stop the service
blackjack status   # Check status
blackjack logs     # View logs
```

## 📋 System Requirements

- **OS**: Windows 10+, Ubuntu 18.04+, CentOS 7+, macOS 10.14+
- **RAM**: 512 MB minimum, 2 GB recommended
- **Storage**: 100 MB minimum, 500 MB recommended
- **Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## 🆘 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/Zmk55/BlackJack/issues)
- **Documentation**: [Installation Guide](https://github.com/Zmk55/BlackJack/blob/main/INSTALLATION.md)
- **Discussions**: [GitHub Discussions](https://github.com/Zmk55/BlackJack/discussions)

## 📈 Changelog

### v{VERSION}
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
```

## 🔧 Troubleshooting

### **Common Issues**

#### **GitHub CLI Not Authenticated**
```bash
gh auth login
gh auth status
```

#### **Build Failures**
```bash
# Check if all dependencies are installed
go version
dpkg --version
rpm --version

# Rebuild from scratch
rm -rf build/
./installers/build-installers.sh
```

#### **Release Already Exists**
```bash
# Delete existing release
gh release delete "v1.0.0" --yes

# Create new release
gh release create "v1.0.0" ...
```

#### **File Upload Failures**
```bash
# Check file sizes and permissions
ls -la build/
ls -la build/linux/

# Ensure files exist before creating release
```

## 📊 Release Statistics

### **File Sizes (Approximate)**
- **Windows Installer**: ~5 MB
- **Linux DEB**: ~5 MB
- **Linux RPM**: ~5 MB
- **Linux TAR**: ~200 MB (includes all dependencies)
- **Install Script**: ~10 KB
- **Documentation**: ~5 KB

### **Total Release Size**: ~220 MB

## 🎯 Best Practices

1. **Test Before Release**: Always test installers on target platforms
2. **Version Consistency**: Ensure all version files are updated
3. **Release Notes**: Write comprehensive release notes
4. **File Verification**: Verify all files are uploaded correctly
5. **Documentation**: Update documentation with new features
6. **Announcement**: Announce releases on social media/forums

## 🔗 Useful Links

- **GitHub Releases**: https://github.com/Zmk55/BlackJack/releases
- **GitHub CLI Docs**: https://cli.github.com/manual/
- **NSIS Documentation**: https://nsis.sourceforge.io/Docs/
- **Debian Packaging**: https://www.debian.org/doc/manuals/debian-faq/ch-pkg_basics.en.html
- **RPM Packaging**: https://rpm-packaging-guide.github.io/

---

**Happy Releasing!** 🚀
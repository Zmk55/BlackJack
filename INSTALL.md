# Installing Latch SSH Manager

## 🚀 Quick Start (Recommended for Users)

### Download Pre-built Binaries

**For most users, download the pre-built installer:**

1. Go to [GitHub Releases](https://github.com/your-org/latch/releases)
2. Download the installer for your platform:
   - **Windows**: `Latch-Setup.exe`
   - **macOS**: `Latch.dmg`
   - **Linux**: `latch_*.deb` or `latch_*.AppImage`

3. **Install and run** - no additional setup required!

---

## 🛠️ For Developers (Building from Source)

### Prerequisites

You'll need these tools installed:

#### All Platforms
- **Node.js 18+** and npm/yarn/pnpm
- **Rust 1.70+** ([rustup.rs](https://rustup.rs/))

#### Platform-Specific Dependencies

**macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

**Windows:**
- Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Or install [Visual Studio Community](https://visualstudio.microsoft.com/vs/community/)

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev
```

### Installation Steps

1. **Clone the repository:**
```bash
git clone https://github.com/your-org/latch.git
cd latch
```

2. **Run the setup script:**
```bash
./setup.sh
```

3. **Start development:**
```bash
npm run dev
```

### Building for Distribution

```bash
# Build for current platform
npm run build

# Build for all platforms
npm run build:all

# Build for specific platform
npm run build:windows
npm run build:macos
npm run build:linux
```

---

## 📦 Distribution Packages

The build process creates these installer packages:

### Windows
- **NSIS Installer**: `Latch-Setup.exe`
- **Portable**: `latch.exe` (no installation required)

### macOS
- **Disk Image**: `Latch.dmg`
- **App Bundle**: `Latch.app` (drag to Applications)

### Linux
- **Debian Package**: `latch_*.deb`
- **AppImage**: `latch_*.AppImage` (portable)
- **RPM**: `latch_*.rpm` (for Red Hat-based distros)

---

## 🔧 Troubleshooting

### Common Issues

**"Command not found" errors:**
- Make sure Node.js and Rust are installed
- Check that they're in your PATH
- Restart your terminal

**Build failures:**
- Update Rust: `rustup update`
- Clear build cache: `cargo clean`
- Check system dependencies are installed

**SSH connection issues:**
- Ensure SSH is installed on your system
- Check SSH agent is running (for agent auth)
- Verify key file paths are correct

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/your-org/latch/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/latch/discussions)
- **Documentation**: [Wiki](https://github.com/your-org/latch/wiki)

---

## 🎯 For End Users

**If you just want to use Latch:**

1. **Download** the installer from GitHub Releases
2. **Install** like any other application
3. **Launch** and start managing your SSH connections!

No technical setup required - it just works! 🎉

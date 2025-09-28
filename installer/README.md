# Latch Installer

This directory contains platform-specific installers for end users.

## Distribution Strategy

### For End Users (Recommended)
Users should download pre-built binaries from GitHub Releases:

1. **Download** the appropriate installer for your platform
2. **Install** like any other application
3. **Run** - no additional setup required

### Available Installers

- **Windows**: `Latch-Setup.exe` (NSIS installer)
- **macOS**: `Latch.dmg` (Disk image)
- **Linux**: `latch_*.deb` (Debian package) or `latch_*.AppImage`

## Building Installers

```bash
# Build all platforms
npm run build:all

# Build specific platform
npm run build:windows
npm run build:macos
npm run build:linux
```

## Auto-Update

The application includes auto-update functionality:
- Checks for updates on startup
- Downloads and installs updates automatically
- Notifies users of new versions

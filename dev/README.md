# Development Files

This directory contains development and testing files for BlackJack.

## Build Scripts

### Windows Build Scripts
- `build-windows-final.ps1` - Final working PowerShell build script for Windows executable
- `build-windows-fixed.ps1` - Fixed version of the PowerShell build script
- `build-windows-simple.ps1` - Simplified PowerShell build script (had syntax issues)
- `build-windows.bat` - Batch script for Windows builds
- `build-windows.ps1` - Initial PowerShell build script (had syntax issues)

### Build Artifacts
- `blackjack-windows-1.0.0.zip` - Windows executable distribution package
- `blackjack-windows-1.0.0-fixed.zip` - Updated Windows executable distribution package

## Usage

The main build script to use is `build-windows-final.ps1`. This script:
1. Builds the Go web server executable
2. Copies web application files
3. Creates startup scripts and documentation
4. Packages everything into a distribution zip file

### Running the Build Script

```powershell
PowerShell -ExecutionPolicy Bypass -File ".\dev\build-windows-final.ps1"
```

## Notes

- These files were created during development and testing of the Windows build process
- The final working script is `build-windows-final.ps1`
- Older versions are kept for reference and troubleshooting
- Build artifacts are included for testing and distribution purposes

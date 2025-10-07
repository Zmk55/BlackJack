# BlackJack Windows Build Script (PowerShell)
# This script builds the Windows executable for BlackJack

param(
    [string]$Version = "1.0.0"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    Write-ColorOutput "================================" $Blue
    Write-ColorOutput "  BlackJack Windows Build Script" $Blue
    Write-ColorOutput "================================" $Blue
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "✓ $Message" $Green
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "✗ $Message" $Red
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "⚠ $Message" $Yellow
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "ℹ $Message" $Blue
}

# Main execution
Write-Header

# Check if Go is installed
try {
    $goVersion = go version
    Write-Success "Go found: $goVersion"
} catch {
    Write-Error "Go is not installed or not in PATH"
    Write-Info "Please install Go 1.22+ from https://golang.org/dl/"
    exit 1
}

# Create build directory
$buildDir = "build\windows"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
Write-Success "Build directory created: $buildDir"

# Navigate to web-server directory
Set-Location "web-server"

# Install dependencies
Write-Info "Installing dependencies..."
go mod tidy
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install dependencies"
    exit 1
}

# Build the executable
Write-Info "Building Windows executable..."
$ldflags = "-X main.Version=$Version -s -w"
go build -ldflags $ldflags -o "..\$buildDir\blackjack-server.exe" main.go
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed"
    exit 1
}

# Go back to root directory
Set-Location ".."

# Copy web-app files
Write-Info "Copying web application files..."
Copy-Item -Recurse -Force "web-app" "$buildDir\"

# Copy configuration files
if (Test-Path "web-server\config.json") {
    Copy-Item "web-server\config.json" "$buildDir\"
}
if (Test-Path "web-server\config-encrypted.json.example") {
    Copy-Item "web-server\config-encrypted.json.example" "$buildDir\"
}

# Create startup script
Write-Info "Creating startup script..."
$startupScript = @"
@echo off
echo Starting BlackJack SSH Client...
echo.
echo Web Interface: http://localhost:8082
echo Press Ctrl+C to stop the server
echo.
blackjack-server.exe
"@
$startupScript | Out-File -FilePath "$buildDir\start-blackjack.bat" -Encoding ASCII

# Create Windows README
Write-Info "Creating Windows README..."
$readme = @"
BlackJack SSH Client - Windows Build
====================================

Version: $Version
Build Date: $(Get-Date)

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
"@
$readme | Out-File -FilePath "$buildDir\README.txt" -Encoding ASCII

# Get file size
$exeFile = Get-Item "$buildDir\blackjack-server.exe"
$fileSizeMB = [math]::Round($exeFile.Length / 1MB, 1)

Write-Host ""
Write-ColorOutput "================================" $Blue
Write-ColorOutput "  Build Completed Successfully!" $Blue
Write-ColorOutput "================================" $Blue
Write-Host ""
Write-Info "Executable: $buildDir\blackjack-server.exe"
Write-Info "Size: $fileSizeMB MB"
Write-Info "Version: $Version"
Write-Host ""
Write-Info "To test the build:"
Write-Info "1. Navigate to: $buildDir"
Write-Info "2. Run: start-blackjack.bat"
Write-Info "3. Open: http://localhost:8082"
Write-Host ""

# Create a zip file for distribution
Write-Info "Creating distribution package..."
$zipFile = "blackjack-windows-$Version.zip"
if (Test-Path $zipFile) {
    Remove-Item $zipFile
}

try {
    Compress-Archive -Path "$buildDir\*" -DestinationPath $zipFile
    Write-Success "Distribution package created: $zipFile"
} catch {
    Write-Warning "Failed to create zip file. You may need to install PowerShell 5.0+ or use a different compression tool."
}

Write-Host ""
Write-Success "Build process completed!"
Write-Host ""
Write-Info "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")


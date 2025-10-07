# BlackJack Windows Build Script (Simple)
param([string]$Version = "1.0.0")

Write-Host "================================" -ForegroundColor Blue
Write-Host "  BlackJack Windows Build Script" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host ""

# Check if Go is installed
try {
    $goVersion = go version
    Write-Host "✓ Go found: $goVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Go is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Go 1.22+ from https://golang.org/dl/" -ForegroundColor Yellow
    exit 1
}

# Create build directory
$buildDir = "build\windows"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
Write-Host "✓ Build directory created: $buildDir" -ForegroundColor Green

# Navigate to web-server directory
Set-Location "web-server"

# Install dependencies
Write-Host "ℹ Installing dependencies..." -ForegroundColor Blue
go mod tidy
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Build the executable
Write-Host "ℹ Building Windows executable..." -ForegroundColor Blue
$ldflags = "-X main.Version=$Version -s -w"
go build -ldflags $ldflags -o "..\$buildDir\blackjack-server.exe" main.go
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

# Go back to root directory
Set-Location ".."

# Copy web-app files
Write-Host "ℹ Copying web application files..." -ForegroundColor Blue
Copy-Item -Recurse -Force "web-app" "$buildDir\"

# Copy configuration files
if (Test-Path "web-server\config.json") {
    Copy-Item "web-server\config.json" "$buildDir\"
}
if (Test-Path "web-server\config-encrypted.json.example") {
    Copy-Item "web-server\config-encrypted.json.example" "$buildDir\"
}

# Create startup script
Write-Host "ℹ Creating startup script..." -ForegroundColor Blue
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
Write-Host "ℹ Creating Windows README..." -ForegroundColor Blue
$readme = @'
BlackJack SSH Client - Windows Build
====================================

Version: 1.0.0
Build Date: ' + (Get-Date) + '

Quick Start:
1. Double-click start-blackjack.bat to start the server
2. Open your browser and go to http://localhost:8082
3. Use the web interface to manage your SSH connections

Files:
- blackjack-server.exe: Main server executable
- web-app/: Web interface files
- config.json: Server configuration (optional)
- start-blackjack.bat: Startup script

For more information, visit: https://github.com/Zmk55/BlackJack
'@
$readme | Out-File -FilePath "$buildDir\README.txt" -Encoding ASCII

# Get file size
$exeFile = Get-Item "$buildDir\blackjack-server.exe"
$fileSizeMB = [math]::Round($exeFile.Length / 1MB, 1)

Write-Host ""
Write-Host "================================" -ForegroundColor Blue
Write-Host "  Build Completed Successfully!" -ForegroundColor Blue
Write-Host "================================" -ForegroundColor Blue
Write-Host ""
Write-Host "ℹ Executable: $buildDir\blackjack-server.exe" -ForegroundColor Blue
Write-Host "ℹ Size: $fileSizeMB MB" -ForegroundColor Blue
Write-Host "ℹ Version: $Version" -ForegroundColor Blue
Write-Host ""
Write-Host "ℹ To test the build:" -ForegroundColor Blue
Write-Host "ℹ 1. Navigate to: $buildDir" -ForegroundColor Blue
Write-Host "ℹ 2. Run: start-blackjack.bat" -ForegroundColor Blue
Write-Host "ℹ 3. Open: http://localhost:8082" -ForegroundColor Blue
Write-Host ""

# Create a zip file for distribution
Write-Host "ℹ Creating distribution package..." -ForegroundColor Blue
$zipFile = "blackjack-windows-$Version.zip"
if (Test-Path $zipFile) {
    Remove-Item $zipFile
}

try {
    Compress-Archive -Path "$buildDir\*" -DestinationPath $zipFile
    Write-Host "✓ Distribution package created: $zipFile" -ForegroundColor Green
} catch {
    Write-Host "⚠ Failed to create zip file. You may need to install PowerShell 5.0+ or use a different compression tool." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✓ Build process completed!" -ForegroundColor Green

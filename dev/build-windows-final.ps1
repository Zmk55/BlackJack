# BlackJack Windows Build Script
param([string]$Version = "1.0.0")

Write-Host "Building BlackJack Windows Executable..." -ForegroundColor Green

# Check if Go is installed
try {
    $goVersion = go version
    Write-Host "Go found: $goVersion" -ForegroundColor Green
} catch {
    Write-Host "Go is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Create build directory
$buildDir = "build\windows"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
Write-Host "Build directory created: $buildDir" -ForegroundColor Green

# Navigate to web-server directory
Set-Location "web-server"

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Blue
go mod tidy

# Build the executable
Write-Host "Building Windows executable..." -ForegroundColor Blue
$ldflags = "-X main.Version=$Version -s -w"
go build -ldflags $ldflags -o "..\$buildDir\blackjack-server.exe" main.go

# Go back to root directory
Set-Location ".."

# Copy web-app files
Write-Host "Copying web application files..." -ForegroundColor Blue
Copy-Item -Recurse -Force "web-app" "$buildDir\"

# Create startup script
Write-Host "Creating startup script..." -ForegroundColor Blue
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

# Get file size
$exeFile = Get-Item "$buildDir\blackjack-server.exe"
$fileSizeMB = [math]::Round($exeFile.Length / 1MB, 1)

Write-Host ""
Write-Host "Build Completed Successfully!" -ForegroundColor Green
Write-Host "Executable: $buildDir\blackjack-server.exe" -ForegroundColor Blue
Write-Host "Size: $fileSizeMB MB" -ForegroundColor Blue
Write-Host "Version: $Version" -ForegroundColor Blue
Write-Host ""
Write-Host "To test: Navigate to $buildDir and run start-blackjack.bat" -ForegroundColor Yellow

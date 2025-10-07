# BlackJack Windows Build Script (Fixed Paths)
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

# Copy web-app files to the correct location (parent directory of executable)
Write-Host "Copying web application files..." -ForegroundColor Blue
Copy-Item -Recurse -Force "web-app" "$buildDir\..\"

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

# Create Windows README
Write-Host "Creating Windows README..." -ForegroundColor Blue
$readme = "BlackJack SSH Client - Windows Build`n====================================`n`nVersion: $Version`nBuild Date: $(Get-Date)`n`nQuick Start:`n1. Double-click start-blackjack.bat to start the server`n2. Open your browser and go to http://localhost:8082`n3. Use the web interface to manage your SSH connections`n`nFiles:`n- blackjack-server.exe: Main server executable`n- web-app/: Web interface files`n- start-blackjack.bat: Startup script`n`nFor more information, visit: https://github.com/Zmk55/BlackJack"
$readme | Out-File -FilePath "$buildDir\README.txt" -Encoding ASCII

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
Write-Host "Web interface will be available at: http://localhost:8082" -ForegroundColor Yellow

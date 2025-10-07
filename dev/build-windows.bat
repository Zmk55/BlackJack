@echo off
REM BlackJack Windows Build Script
REM This script builds the Windows executable for BlackJack

setlocal enabledelayedexpansion

echo ================================
echo   BlackJack Windows Build Script
echo ================================
echo.

REM Check if Go is installed
go version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Go is not installed or not in PATH
    echo Please install Go 1.22+ from https://golang.org/dl/
    pause
    exit /b 1
)

REM Get Go version
for /f "tokens=3" %%i in ('go version') do set GO_VERSION=%%i
echo Go version: %GO_VERSION%

REM Create build directory
if not exist "build" mkdir build
if not exist "build\windows" mkdir build\windows

REM Set build variables
set BINARY_NAME=blackjack-server.exe
set BUILD_DIR=build\windows
set VERSION=1.0.0

REM Get version from VERSION file if it exists
if exist "VERSION" (
    set /p VERSION=<VERSION
)

echo Building BlackJack v%VERSION% for Windows...
echo.

REM Navigate to web-server directory
cd web-server

REM Install dependencies
echo Installing dependencies...
go mod tidy
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

REM Build the executable
echo Building Windows executable...
go build -ldflags "-X main.Version=%VERSION% -s -w" -o ..\%BUILD_DIR%\%BINARY_NAME% main.go
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)

REM Go back to root directory
cd ..

REM Copy web-app files to build directory
echo Copying web application files...
if not exist "%BUILD_DIR%\web-app" mkdir %BUILD_DIR%\web-app
xcopy /E /I /Y web-app\* %BUILD_DIR%\web-app\

REM Copy configuration files
echo Copying configuration files...
if exist "web-server\config.json" copy /Y web-server\config.json %BUILD_DIR%\
if exist "web-server\config-encrypted.json.example" copy /Y web-server\config-encrypted.json.example %BUILD_DIR%\

REM Create a simple batch file to run the server
echo Creating startup script...
(
echo @echo off
echo echo Starting BlackJack SSH Client...
echo echo.
echo echo Web Interface: http://localhost:8082
echo echo Press Ctrl+C to stop the server
echo echo.
echo %BINARY_NAME%
) > %BUILD_DIR%\start-blackjack.bat

REM Create README for Windows build
echo Creating Windows README...
(
echo BlackJack SSH Client - Windows Build
echo ====================================
echo.
echo Version: %VERSION%
echo Build Date: %date% %time%
echo.
echo Quick Start:
echo 1. Double-click 'start-blackjack.bat' to start the server
echo 2. Open your browser and go to http://localhost:8082
echo 3. Use the web interface to manage your SSH connections
echo.
echo Files:
echo - blackjack-server.exe: Main server executable
echo - web-app/: Web interface files
echo - config.json: Server configuration (optional)
echo - start-blackjack.bat: Startup script
echo.
echo For more information, visit: https://github.com/Zmk55/BlackJack
) > %BUILD_DIR%\README.txt

REM Get file size
for %%A in (%BUILD_DIR%\%BINARY_NAME%) do set FILE_SIZE=%%~zA
set /a FILE_SIZE_MB=%FILE_SIZE%/1024/1024

echo.
echo ================================
echo   Build Completed Successfully!
echo ================================
echo.
echo Executable: %BUILD_DIR%\%BINARY_NAME%
echo Size: %FILE_SIZE_MB% MB
echo Version: %VERSION%
echo.
echo To test the build:
echo 1. Navigate to: %BUILD_DIR%
echo 2. Run: start-blackjack.bat
echo 3. Open: http://localhost:8082
echo.

REM Create a zip file for distribution
echo Creating distribution package...
if exist "%BUILD_DIR%-windows.zip" del "%BUILD_DIR%-windows.zip"
powershell -command "Compress-Archive -Path '%BUILD_DIR%\*' -DestinationPath 'blackjack-windows-%VERSION%.zip'"
if %errorlevel% neq 0 (
    echo WARNING: Failed to create zip file. You may need to install PowerShell or use a different compression tool.
) else (
    echo Distribution package created: blackjack-windows-%VERSION%.zip
)

echo.
echo Build process completed!
pause


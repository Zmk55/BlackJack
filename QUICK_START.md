# BlackJack Quick Start Guide

## 🚀 One-Command Startup

The easiest way to start BlackJack:

```bash
./start.sh
```

This will start the web application with full SSH support on port 8082.

## 📋 All Startup Options

### Web Application (Recommended)
```bash
# Unified script (recommended)
./start.sh -m web

# Using Makefile
make start-web

# Manual start
cd web-server && ./run.sh
```

### Desktop Application
```bash
# Unified script
./start.sh -m desktop

# Using Makefile
make start-desktop

# Manual start
cd desktop && ./run.sh
```

### Terminal UI
```bash
# Unified script
./start.sh -m tui

# Using Makefile
make start-tui

# Manual start
make run
```

## 🔧 Advanced Options

### Custom Port
```bash
./start.sh -m web -p 8080
```

### Help
```bash
./start.sh --help
```

## 🐛 Troubleshooting

### Port Already in Use
The startup script automatically detects port conflicts and finds an available port.

### Missing Dependencies
The script checks for required dependencies:
- **Web mode**: Go 1.22+
- **Desktop mode**: Rust + Tauri CLI
- **TUI mode**: Go 1.22+

### SSH Key Issues
Make sure your SSH keys are properly configured:
```bash
# Test SSH agent
ssh-add -l

# Test SSH connection
ssh user@hostname
```

## 📁 Project Structure

```
BlackJack/
├── start.sh              # 🚀 Unified startup script
├── Makefile              # Build and run targets
├── web-server/           # Go backend with WebSocket support
├── web-app/              # Frontend web application
├── desktop/              # Tauri desktop application
└── cmd/blackjack/        # Terminal UI application
```

## 🎯 What Each Mode Does

| Mode | Description | Best For |
|------|-------------|----------|
| **web** | Modern web interface with SSH terminals | Daily use, multiple users |
| **desktop** | Native desktop application | Offline use, system integration |
| **tui** | Terminal-based interface | Servers, minimal environments |

## 🔗 URLs

- **Web Interface**: http://localhost:8082
- **WebSocket**: ws://localhost:8082/ws/ssh
- **Health Check**: http://localhost:8082/health

## ⚡ Quick Commands

```bash
# Start web app
./start.sh

# Start on different port
./start.sh -p 8080

# Start desktop app
./start.sh -m desktop

# Start terminal UI
./start.sh -m tui

# Get help
./start.sh --help
```

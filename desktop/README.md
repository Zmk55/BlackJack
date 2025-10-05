# BlackJack Desktop Application

A native desktop SSH client built with Tauri (Rust + Web frontend).

## Features

- **Native Desktop App** - No browser required
- **Tab-based Interface** - Multiple SSH sessions in tabs
- **Host Management** - Add, edit, and organize SSH hosts
- **Modern UI** - Dark theme with professional appearance
- **Cross-platform** - Works on Windows, macOS, and Linux

## Quick Start

### Development Mode
```bash
./run.sh
```

### Build for Production
```bash
./build.sh
```

## Requirements

- Rust (for building the desktop app)
- Node.js (for web frontend development)

## Installation

1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Install Tauri CLI:
   ```bash
   cargo install tauri-cli
   ```

3. Run the application:
   ```bash
   ./run.sh
   ```

## Project Structure

```
desktop/
├── src-tauri/          # Rust backend
│   ├── src/main.rs     # Main application logic
│   ├── Cargo.toml      # Rust dependencies
│   └── tauri.conf.json # Tauri configuration
├── web/                # Web frontend
│   ├── index.html     # Main HTML
│   ├── styles.css     # Styling
│   └── app.js         # JavaScript logic
├── run.sh             # Development launcher
└── build.sh           # Production build script
```

## Usage

1. **Add Hosts** - Click "Add Host" to add SSH servers
2. **Connect** - Click "Connect" on any host to start SSH session
3. **Tabs** - Each SSH session opens in a new tab
4. **Switch** - Click between tabs to switch sessions

This is a native desktop application that works like Termius but with a modern tabbed interface!

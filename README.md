# Latch - SSH Manager

A modern, local-only SSH manager with encrypted import/export. Built with Tauri, React, and TypeScript.

## Features

- **Local-only**: No cloud sync, no telemetry, completely offline
- **Encrypted vault**: Password-protected import/export with Argon2id + AES-GCM
- **Modern UI**: Dark theme with TailwindCSS and shadcn/ui components
- **Cross-platform**: Works on macOS, Windows, and Linux
- **Keyboard shortcuts**: Command palette (Cmd/Ctrl+K) and quick actions
- **Groups & Tags**: Organize hosts with groups and tags
- **SSH Agent support**: Works with SSH agent or key files

## Tech Stack

- **Backend**: Tauri (Rust)
- **Frontend**: React + TypeScript + Vite
- **UI**: TailwindCSS + shadcn/ui (Radix)
- **Crypto**: Argon2id + AES-GCM
- **State**: Zustand
- **Icons**: Lucide React

## 🚀 Quick Start

### For End Users (Recommended)

**Download and install Latch like any other app:**

1. Go to [GitHub Releases](https://github.com/your-org/latch/releases)
2. Download the installer for your platform:
   - **Windows**: `Latch-Setup.exe`
   - **macOS**: `Latch.dmg` 
   - **Linux**: `latch_*.deb` or `latch_*.AppImage`
3. **Install and run** - no additional setup required!

### For Developers

See [INSTALL.md](./INSTALL.md) for detailed development setup instructions.

**Quick setup:**
```bash
git clone <repository-url>
cd latch
./setup.sh
npm run dev
```

## Usage

### Adding Hosts

1. Click "New Host" or press `N`
2. Fill in the host details:
   - **Name**: Display name for the host
   - **Hostname**: Server hostname or IP
   - **Port**: SSH port (default: 22)
   - **Username**: SSH username (optional)
   - **Authentication**: SSH Agent or Key File
   - **Group**: Organize hosts into groups
   - **Tags**: Add tags for filtering

### Connecting

1. Select a host from the list
2. Click the "Connect" button or press `Enter`
3. SSH will open in your system's default terminal

### Import/Export

**Export:**
1. Click "Export" in the sidebar
2. Enter a password
3. Choose save location

**Import:**
1. Click "Import" in the sidebar
2. Select a `.sshvault` file
3. Enter the password
4. Choose to merge or replace existing data

### Keyboard Shortcuts

- `Cmd/Ctrl + K`: Open command palette
- `N`: Focus search (quick host creation)
- `Enter`: Connect to selected host
- `Delete/Backspace`: Delete selected host
- `E`: Export vault
- `I`: Import vault

### Command Palette

Press `Cmd/Ctrl + K` to open the command palette. You can:
- Search for hosts, groups, and tags
- Create new hosts and groups
- Navigate with arrow keys
- Execute with Enter

## Data Storage

Latch stores your vault at `~/.latch/vault.json`. This file contains:
- All your hosts and groups
- Unencrypted (local-only)
- Automatically backed up on changes

## Security

- **Local-only**: No data leaves your machine
- **Encrypted exports**: Uses Argon2id (m=65536, t=3, p=1) + AES-GCM-256
- **No telemetry**: Completely anonymous
- **Open source**: All code is auditable

## Development

### Project Structure

```
latch/
├── apps/desktop/           # Main application
│   ├── src/               # React frontend
│   │   ├── components/    # UI components
│   │   ├── lib/          # Utilities and API
│   │   └── styles/       # CSS and themes
│   └── src-tauri/        # Rust backend
│       ├── src/          # Rust source
│       └── Cargo.toml    # Rust dependencies
└── README.md
```

### Key Components

- **Sidebar**: Navigation, groups, import/export
- **HostList**: Searchable host list with actions
- **HostDetails**: Host editor with tabs
- **CommandPalette**: Global search and actions
- **VaultAPI**: Tauri command wrappers

### Testing

```bash
# Run tests
npm test

# Run Rust tests
cd apps/desktop/src-tauri
cargo test
```

### Adding Features

1. **New Tauri commands**: Add to `src-tauri/src/commands.rs`
2. **UI components**: Add to `src/components/`
3. **State management**: Update `src/lib/store.ts`
4. **API layer**: Update `src/lib/api.ts`

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Roadmap

- [ ] SSH config import
- [ ] Port forwarding presets
- [ ] Host templates
- [ ] Better error handling
- [ ] Plugin system
- [ ] CLI companion

## Troubleshooting

### Build Issues

**Rust compilation errors:**
```bash
# Update Rust
rustup update

# Clean build
cd apps/desktop/src-tauri
cargo clean
```

**Node.js issues:**
```bash
# Clear node modules
rm -rf node_modules package-lock.json
npm install
```

### Runtime Issues

**SSH connection fails:**
- Check if SSH agent is running
- Verify key file paths
- Test SSH manually in terminal

**Import/export fails:**
- Check file permissions
- Verify password is correct
- Ensure sufficient disk space

## Support

- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Security**: security@example.com

---

Built with ❤️ using Tauri, React, and Rust.

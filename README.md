# BlackJack

A modern desktop SSH/SFTP client with tabbed interface, host management, and native desktop experience.

## Features

- **Native Desktop App**: Built with Tauri (Rust + Web frontend)
- **Tabbed Interface**: Multiple SSH sessions in separate tabs
- **Host Management**: Add, edit, and organize SSH hosts
- **Modern UI**: Dark theme with professional appearance
- **Cross-platform**: Works on Windows, macOS, and Linux
- **No Browser Required**: Standalone desktop application

## Installation

### Prerequisites

- Rust (for building the desktop app)
- Node.js (for web frontend development)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/blackjack/blackjack.git
cd blackjack

# Run the desktop application
cd desktop
./run.sh
```

### Build for Production

```bash
cd desktop
./build.sh
```

### Development Setup

```bash
# Setup development environment
make dev-setup

# Run tests
make test

# Run with coverage
make test-coverage

# Format code
make fmt

# Lint code
make lint
```

## Usage

### Basic Commands

```bash
# Launch the TUI interface (default)
blackjack

# Launch TUI explicitly
blackjack tui

# Add a new host (non-TUI)
blackjack add host --name "Web Server" --addr "10.0.1.15" --user "ubuntu"

# Import configuration
blackjack import backup.tar.gz

# Export configuration
blackjack export

# Check system configuration
blackjack doctor

# Show version
blackjack version
```

### TUI Navigation

#### Keybindings

| Key | Action |
|-----|--------|
| `c` | Connect to selected host |
| `s` | Open SFTP browser |
| `n` | New host/group |
| `e` | Edit selected item |
| `d` | Delete selected item |
| `/` | Search/filter |
| `?` | Help |
| `F10` | Settings |
| `F2` | Key manager |
| `F8` | Import/Export |
| `Ctrl+C` | Exit |

#### Navigation

- **Arrow Keys**: Move through lists
- **Tab/Shift+Tab**: Switch between panes
- **Enter**: Select item
- **g**: Focus groups tree
- **h/l**: Collapse/expand groups
- **Page Up/Down**: Scroll through lists

## Configuration

BlackJack stores its configuration in `~/.blackjack/` (or `$XDG_CONFIG_HOME/blackjack` and `$XDG_STATE_HOME/blackjack` if set).

### Directory Structure

```
~/.blackjack/
├── config/
│   ├── app.yaml          # Global settings
│   └── profiles.yaml     # User profiles
├── inventory/
│   ├── groups.yaml       # Host groups
│   ├── hosts.yaml        # Host definitions
│   ├── secrets.yaml      # Secret metadata (no raw keys)
│   └── tags.yaml         # Host tags
├── keys/                 # SSH private keys (0700)
├── sessions/             # Connection history
├── logs/                 # Application logs
├── exports/              # Backup files
└── plugins/              # Future: executable plugins
```

### Configuration Files

#### `config/app.yaml`

```yaml
theme: "matrix"   # matrix | mono | solarized_dark | dracula
keybinds:
  connect: "c"
  sftp: "s"
  search: "/"
terminal:
  external: true
  command: "$TERMINAL -e"
ssh:
  forward_agent: true
  strict_hostkey: true
  connect_timeout: 30
sftp:
  transfer_concurrency: 4
  buffer_size: 32768
telemetry: false
```

#### `inventory/hosts.yaml`

```yaml
version: 1
hosts:
  - id: "web-01"
    name: "Web 01"
    address: "10.0.1.15"
    port: 22
    user: "ubuntu"
    auth:
      type: "key"            # key | agent | password
      key_id: "ed25519_main" # matches keys/<key_id>
    groups: ["prod", "web"]
    tags: ["ubuntu", "nginx"]
    notes: "Primary frontend"
```

#### `inventory/groups.yaml`

```yaml
version: 1
groups:
  - id: "prod"
    name: "Production"
    parent: null
  - id: "web"
    name: "Web"
    parent: "prod"
```

## Security

### Key Management

- Private keys are stored in `~/.blackjack/keys/` with strict permissions (0700)
- Support for OpenSSH, ed25519, and RSA keys
- Passphrase protection for encrypted keys
- SSH agent integration

### Security Features

- Never store plaintext passwords
- Redact secrets in logs
- Respect system `~/.ssh/known_hosts`
- Optional telemetry (disabled by default)

## Themes

BlackJack supports multiple themes:

- **matrix**: Classic green-on-black matrix theme
- **mono**: Monochrome theme
- **solarized_dark**: Solarized dark theme
- **dracula**: Dracula color scheme

## Import/Export

### Export

```bash
# Export all data
blackjack export

# Export with redacted keys
blackjack export --redact
```

### Import

```bash
# Import from backup
blackjack import backup.tar.gz
```

## Development

### Project Structure

```
/cmd/blackjack/main.go          # CLI entry point
/internal/app/                  # TUI app wiring
/internal/ui/                   # tview views, modals, keybinds
/internal/data/                 # YAML repositories
/internal/ssh/                  # SSH client, auth resolution
/internal/sftp/               # SFTP operations
/internal/config/              # Configuration management
/internal/export/              # Import/export functionality
/internal/security/            # Key management, redaction
/pkg/models/                   # Data models
/assets/themes/                # Theme definitions
/examples/                     # Example configurations
```

### Adding New Features

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

### Testing

```bash
# Run all tests
make test

# Run tests with coverage
make test-coverage

# Run specific test
go test ./internal/data/...
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

### v0.1 (MVP)
- [x] Basic TUI with host management
- [x] Group hierarchy
- [x] SSH connection (external terminal)
- [x] SFTP browser
- [x] Import/export
- [x] Configuration management

### v0.2 (Planned)
- [ ] Integrated terminal widget
- [ ] Port forwarding presets
- [ ] Session notes and snippets
- [ ] Bulk operations
- [ ] Plugin system

### v0.3 (Planned)
- [ ] Windows/macOS support
- [ ] Advanced themes
- [ ] Cloud sync
- [ ] Team collaboration features

## Screenshots

*Screenshots will be added once the TUI is fully functional*

## Support

- GitHub Issues: [Report bugs and request features](https://github.com/blackjack/blackjack/issues)
- Documentation: [Wiki](https://github.com/blackjack/blackjack/wiki)
- Discussions: [Community discussions](https://github.com/blackjack/blackjack/discussions)

## Changelog

### v0.1.0 (Planned)
- Initial release with core TUI functionality
- Host and group management
- SSH/SFTP support
- Import/export capabilities

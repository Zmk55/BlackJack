# BlackJack

A modern web-based SSH management application with tabbed interface, host management, and advanced organization features.

## Features

- **Modern Web GUI**: Beautiful dark-themed interface with responsive design
- **Tabbed Interface**: Multiple SSH sessions in separate tabs with drag-and-drop support
- **Host Management**: Add, edit, clone, and organize SSH hosts with hierarchical groups
- **Advanced Organization**: Hierarchical groups with host counts and collapsible sidebar
- **Smart Tagging**: Color-coded tags with automatic Tailscale detection
- **Search & Filter**: Real-time search across hostnames, groups, and tags
- **Tailscale Integration**: Automatic tagging and connection options for Tailscale hosts
- **Settings Management**: Comprehensive settings with integrations and data management
- **Cross-platform**: Works on any platform with a modern web browser

## Quick Start

### 🚀 Unified Startup (Recommended)

The easiest way to start BlackJack is using the unified startup script:

```bash
# Clone the repository
git clone https://github.com/Zmk55/BlackJack.git
cd BlackJack

# Start with unified script (interactive)
./start.sh

# Or start specific modes:
./start.sh -m web          # Web application (default)
./start.sh -m desktop      # Desktop application
./start.sh -m tui          # Terminal UI
./start.sh -p 8080         # Custom port
```

### 🌐 Web Application

```bash
# Option 1: Using unified script (recommended)
./start.sh -m web

# Option 2: Using Makefile
make start-web

# Option 3: Manual start
cd web-server
./run.sh
```

### 🖥️ Desktop Application

```bash
# Option 1: Using unified script
./start.sh -m desktop

# Option 2: Using Makefile
make start-desktop

# Option 3: Manual start
cd desktop
./run.sh
```

### 💻 Terminal UI

```bash
# Option 1: Using unified script
./start.sh -m tui

# Option 2: Using Makefile
make start-tui

# Option 3: Manual start
make run
```

## Usage

### Web Interface

1. **Add Hosts**: Click "Add Host" to create new SSH connections
2. **Organize with Groups**: Create hierarchical groups for better organization
3. **Tag Management**: Add color-coded tags for easy identification
4. **Search**: Use the search bar to quickly find hosts
5. **Connect**: Click "Connect" to open SSH sessions in new tabs
6. **Settings**: Configure integrations and manage data

### Key Features

#### Host Management
- **Add/Edit/Delete**: Full CRUD operations for hosts
- **Clone Hosts**: Duplicate hosts with "-copy" suffix
- **Group Assignment**: Organize hosts into hierarchical groups
- **Tag System**: Color-coded tags with automatic Tailscale detection

#### Advanced Organization
- **Hierarchical Groups**: Create nested group structures
- **Host Counts**: See host counts in parentheses next to group names
- **Collapsible Sidebar**: Hide/show the organization panel
- **Search & Filter**: Real-time filtering by hostname, group, or tag

#### Tailscale Integration
- **Automatic Detection**: Tailscale IPs automatically get 🔗 Tailscale tags
- **Connection Options**: Choose between local and Tailscale connections
- **Visual Indicators**: Clear identification of Tailscale-enabled hosts

#### Settings & Data Management
- **Integrations**: Enable/disable Tailscale integration
- **Data Management**: Clear tag history and manage application data
- **Modern UI**: Card-based settings with toggle switches

## Configuration

### Data Storage

BlackJack stores data in browser localStorage:
- **Hosts**: SSH connection details and metadata
- **Groups**: Hierarchical organization structure
- **Tags**: Color-coded categorization system
- **Settings**: Application preferences and integrations

### Host Configuration

```javascript
// Example host structure
{
  "id": "web-server-01",
  "name": "Web Server 01",
  "address": "192.168.1.100",
  "user": "ubuntu",
  "port": 22,
  "groupId": "production",
  "tags": [
    {"name": "Web", "color": "blue"},
    {"name": "Production", "color": "red"}
  ],
  "tailscaleIp": "100.64.1.5" // Optional Tailscale IP
}
```

## Development

### Project Structure

```
BlackJack/
├── web-app/                 # Web application (HTML, CSS, JS)
│   ├── index.html          # Main interface
│   ├── styles.css          # Modern styling
│   └── app.js              # Application logic
├── desktop/                # Tauri desktop application
│   ├── src-tauri/         # Rust backend
│   └── web/               # Web frontend
├── internal/              # Go backend (legacy)
├── pkg/                   # Go packages
├── examples/              # Sample configurations
└── build/                # Build artifacts
```

### Development Setup

```bash
# Web development
cd web-app
python3 -m http.server 8082

# Desktop development
cd desktop
./run.sh

# Go backend (if needed)
go run cmd/blackjack/main.go
```

### Key Technologies

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Desktop**: Tauri (Rust + Web)
- **Backend**: Go (optional)
- **Styling**: Modern CSS with dark theme
- **Storage**: Browser localStorage

## Features Overview

### 🎯 Host Management
- Add, edit, delete, and clone hosts
- Hierarchical group organization
- Color-coded tagging system
- Search and filtering capabilities

### 🔗 Tailscale Integration
- Automatic Tailscale IP detection
- Visual indicators with 🔗 icon
- Connection options for local vs Tailscale
- Protected auto-tags that can't be manually removed

### 🎨 Modern UI
- Dark theme with professional appearance
- Responsive design for all screen sizes
- Smooth animations and transitions
- Intuitive navigation and controls

### ⚙️ Advanced Settings
- Integration management
- Data export/import capabilities
- Tag history management
- Application preferences

## Browser Compatibility

- **Chrome**: 90+ (Recommended)
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Roadmap

### Current Version
- ✅ Modern web-based GUI
- ✅ Tabbed interface with drag-and-drop
- ✅ Hierarchical group management
- ✅ Advanced tagging system
- ✅ Tailscale integration
- ✅ Search and filtering
- ✅ Settings and data management

### Future Enhancements
- [ ] SSH key management
- [ ] Session recording and playback
- [ ] Team collaboration features
- [ ] Cloud synchronization
- [ ] Mobile responsive improvements
- [ ] Plugin system

## Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/Zmk55/BlackJack/issues)
- **Documentation**: This README and inline code comments
- **Discussions**: [GitHub Discussions](https://github.com/Zmk55/BlackJack/discussions)

## Changelog

### v1.0.0 (Current)
- Modern web-based GUI replacing TUI
- Tabbed interface with drag-and-drop support
- Hierarchical group management with host counts
- Advanced tagging system with automatic Tailscale detection
- Search and filtering capabilities
- Settings management with integrations
- Responsive design with dark theme
- Cross-platform compatibility

---

**BlackJack** - Modern SSH Management Made Simple 🚀
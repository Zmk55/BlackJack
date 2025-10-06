Name:           blackjack-ssh-client
Version:        1.0.0
Release:        1%{?dist}
Summary:        Modern SSH Management Made Simple

License:        MIT
URL:            https://github.com/Zmk55/BlackJack
Source0:        %{name}-%{version}.tar.gz

BuildArch:      noarch
Requires:       systemd, curl, wget, unzip

%description
BlackJack is a modern, cross-platform SSH client that provides:
* Web-based SSH terminal with xterm.js
* SFTP file browser with drag-and-drop
* Host management with groups and tags
* Encrypted credential storage
* Cross-platform compatibility
* Modern, responsive web interface

%prep
%setup -q

%build
# No build step needed for this package

%install
rm -rf $RPM_BUILD_ROOT

# Create directories
mkdir -p $RPM_BUILD_ROOT/opt/blackjack
mkdir -p $RPM_BUILD_ROOT/usr/local/bin
mkdir -p $RPM_BUILD_ROOT/usr/share/applications
mkdir -p $RPM_BUILD_ROOT/usr/share/pixmaps
mkdir -p $RPM_BUILD_ROOT/etc/systemd/system

# Copy application files
cp -r web-app $RPM_BUILD_ROOT/opt/blackjack/
cp -r web-server $RPM_BUILD_ROOT/opt/blackjack/
cp start.sh $RPM_BUILD_ROOT/opt/blackjack/
cp VERSION $RPM_BUILD_ROOT/opt/blackjack/

# Set permissions
chmod +x $RPM_BUILD_ROOT/opt/blackjack/start.sh
chmod +x $RPM_BUILD_ROOT/opt/blackjack/web-server/run.sh

# Create systemd service
cat > $RPM_BUILD_ROOT/etc/systemd/system/blackjack.service << 'EOF'
[Unit]
Description=BlackJack SSH Client
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/blackjack
ExecStart=/opt/blackjack/web-server/blackjack-server
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create desktop entry
cat > $RPM_BUILD_ROOT/usr/share/applications/blackjack.desktop << 'EOF'
[Desktop Entry]
Version=1.0
Type=Application
Name=BlackJack SSH Client
Comment=Modern SSH Management Made Simple
Exec=/usr/local/bin/blackjack
Icon=blackjack
Terminal=false
Categories=Network;RemoteAccess;
StartupNotify=true
EOF

# Create command line launcher
cat > $RPM_BUILD_ROOT/usr/local/bin/blackjack << 'EOF'
#!/bin/bash
# BlackJack SSH Client Launcher

case "$1" in
    start)
        sudo systemctl start blackjack
        echo "BlackJack SSH Client started"
        echo "Access at: http://localhost:8082"
        ;;
    stop)
        sudo systemctl stop blackjack
        echo "BlackJack SSH Client stopped"
        ;;
    restart)
        sudo systemctl restart blackjack
        echo "BlackJack SSH Client restarted"
        ;;
    status)
        sudo systemctl status blackjack
        ;;
    logs)
        sudo journalctl -u blackjack -f
        ;;
    *)
        echo "Usage: blackjack {start|stop|restart|status|logs}"
        echo ""
        echo "BlackJack SSH Client - Modern SSH Management Made Simple"
        echo ""
        echo "Commands:"
        echo "  start   - Start the BlackJack service"
        echo "  stop    - Stop the BlackJack service"
        echo "  restart - Restart the BlackJack service"
        echo "  status  - Show service status"
        echo "  logs    - Show service logs"
        echo ""
        echo "Once started, access BlackJack at: http://localhost:8082"
        ;;
esac
EOF

chmod +x $RPM_BUILD_ROOT/usr/local/bin/blackjack

%post
systemctl daemon-reload
systemctl enable blackjack.service

%preun
systemctl stop blackjack.service || true
systemctl disable blackjack.service || true

%files
/opt/blackjack
/usr/local/bin/blackjack
/usr/share/applications/blackjack.desktop
/etc/systemd/system/blackjack.service

%changelog
* $(date '+%a %b %d %Y') BlackJack Team <support@blackjack-ssh.com> - 1.0.0-1
- Initial release of BlackJack SSH Client

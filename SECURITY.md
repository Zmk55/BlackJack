# BlackJack Security Guide

## 🔐 Authentication System

BlackJack now includes a comprehensive authentication system to protect your SSH management interface from unauthorized access.

### Default Credentials

**⚠️ IMPORTANT: Change these immediately!**

- **Username:** `admin`
- **Password:** `admin123`

### Quick Setup

1. **Start the server:**
   ```bash
   cd web-server
   go build -o blackjack-server main.go
   ./run.sh
   ```

2. **Access the login page:**
   - Open your browser to `http://your-server-ip:8082`
   - You'll be redirected to the login page
   - Use the default credentials above

3. **Change the default password:**
   - Edit `web-server/config.json`
   - Update the `auth.password` field
   - Restart the server

## 🛡️ Security Features

### Authentication
- **Session-based authentication** with secure cookies
- **SHA-256 password hashing** (not plain text storage)
- **HttpOnly cookies** to prevent XSS attacks
- **Configurable session timeout** (default: 24 hours)
- **Automatic session cleanup** for expired sessions

### Access Control
- **All endpoints protected** by authentication middleware
- **WebSocket connections** require valid sessions
- **File operations** require authentication
- **API endpoints** are secured

### Configuration

Edit `web-server/config.json` to customize security settings:

```json
{
  "auth": {
    "username": "your-username",
    "password": "your-secure-password",
    "session_duration_hours": 24
  },
  "security": {
    "require_https": false,
    "allowed_ips": [],
    "max_login_attempts": 5,
    "lockout_duration_minutes": 15
  },
  "server": {
    "port": "8082",
    "host": "0.0.0.0"
  }
}
```

### Security Settings Explained

#### Authentication (`auth`)
- `username`: Your login username
- `password`: Your login password (will be hashed automatically)
- `session_duration_hours`: How long sessions stay active

#### Security (`security`)
- `require_https`: Force HTTPS connections (set to `true` in production)
- `allowed_ips`: Restrict access to specific IP addresses (empty = allow all)
- `max_login_attempts`: Maximum failed login attempts before lockout
- `lockout_duration_minutes`: How long to lock out after failed attempts

#### Server (`server`)
- `port`: Port to run the server on
- `host`: Host to bind to (`0.0.0.0` = all interfaces, `127.0.0.1` = localhost only)

## 🔒 Production Security Recommendations

### 1. Change Default Credentials
```bash
# Edit config.json
{
  "auth": {
    "username": "your-secure-username",
    "password": "your-very-secure-password-123!@#"
  }
}
```

### 2. Use HTTPS in Production
```json
{
  "security": {
    "require_https": true
  }
}
```

### 3. Restrict Access by IP
```json
{
  "security": {
    "allowed_ips": ["192.168.1.100", "10.0.0.50"]
  }
}
```

### 4. Use a Reverse Proxy
Set up nginx or Apache as a reverse proxy with SSL termination:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Firewall Configuration
```bash
# Allow only specific IPs to access port 8082
sudo ufw allow from 192.168.1.0/24 to any port 8082
sudo ufw deny 8082
```

### 6. Regular Security Updates
- Keep your system updated
- Monitor access logs
- Change passwords regularly
- Review session activity

## 🚨 Security Warnings

### ⚠️ Default Configuration
The default configuration is **NOT SECURE** for production use:
- Default password is easily guessable
- No HTTPS enforcement
- No IP restrictions
- Accessible from any network interface

### 🔧 Immediate Actions Required
1. **Change the default password** before deploying
2. **Configure IP restrictions** if needed
3. **Set up HTTPS** for production use
4. **Review firewall rules**
5. **Monitor access logs**

## 📝 Logging

The server logs all authentication events:
- Successful logins
- Failed login attempts
- Logout events
- Session creation/expiration

Monitor these logs for suspicious activity:
```bash
# View server logs
tail -f /path/to/blackjack-server.log

# Or if running in terminal
./run.sh
```

## 🆘 Troubleshooting

### Can't Access After Enabling Security
1. Check if you're using the correct credentials
2. Verify the config.json file is valid JSON
3. Check server logs for errors
4. Ensure cookies are enabled in your browser

### Session Expires Too Quickly
1. Increase `session_duration_hours` in config.json
2. Restart the server after changes

### Forgot Password
1. Stop the server
2. Edit `config.json` to set a new password
3. Restart the server

## 📞 Support

If you encounter security issues:
1. Check the server logs
2. Verify your configuration
3. Test with default settings first
4. Review this documentation

Remember: **Security is your responsibility!** Always use strong passwords and follow security best practices.

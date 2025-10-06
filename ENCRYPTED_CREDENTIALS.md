# 🔐 Encrypted Credentials Guide

## Overview

BlackJack now supports **encrypted credential storage** using industry-standard encryption. This eliminates the security risk of storing passwords in plain text configuration files.

## 🛡️ Security Features

### **Encryption Standards:**
- **AES-256-GCM** encryption (military-grade)
- **PBKDF2** key derivation with 100,000 iterations
- **Random salt** and **nonce** for each encryption
- **Authenticated encryption** (prevents tampering)

### **File Security:**
- **600 permissions** (owner read/write only)
- **Separate master password** file
- **No plain text passwords** in config files

## 🚀 Quick Setup

### **Option 1: Automated Setup (Recommended)**
```bash
cd web-server
./setup-encryption.sh
```

### **Option 2: Manual Setup**
```bash
cd web-server
go build -o setup-encryption setup-encrypted-credentials.go
./setup-encryption
rm setup-encryption
```

## 📋 Setup Process

1. **Enter your BlackJack credentials:**
   - Username (e.g., `twashum`)
   - Password (e.g., `Washum1+`)

2. **Create a master password:**
   - Must be at least 8 characters
   - Used to encrypt/decrypt your credentials
   - Keep this secure!

3. **Files created:**
   - `credentials.enc` - Encrypted credentials
   - `master.key` - Master password
   - `config.json` - Updated configuration

## 🔧 Configuration

### **Enable Encrypted Credentials:**
```json
{
  "auth": {
    "use_encrypted_credentials": true,
    "encrypted_credentials_file": "credentials.enc",
    "master_password_file": "master.key"
  }
}
```

### **File Structure:**
```
web-server/
├── config.json              # Main configuration
├── credentials.enc          # Encrypted credentials (600 permissions)
├── master.key              # Master password (600 permissions)
└── blackjack-server        # Server binary
```

## 🔒 Security Best Practices

### **1. Master Password:**
- Use a **strong, unique password**
- Store it **securely** (password manager)
- **Never share** the master password
- **Backup** the master.key file safely

### **2. File Permissions:**
```bash
# Verify secure permissions
ls -la credentials.enc master.key
# Should show: -rw------- (600)
```

### **3. Backup Strategy:**
```bash
# Backup encrypted files
cp credentials.enc credentials.enc.backup
cp master.key master.key.backup
```

### **4. Version Control:**
```bash
# Add to .gitignore
echo "credentials.enc" >> .gitignore
echo "master.key" >> .gitignore
echo "*.backup" >> .gitignore
```

## 🔄 Migration from Plain Text

### **Current Setup (Plain Text):**
```json
{
  "auth": {
    "username": "twashum",
    "password": "Washum1+"
  }
}
```

### **After Migration (Encrypted):**
```json
{
  "auth": {
    "username": "",
    "password": "",
    "use_encrypted_credentials": true,
    "encrypted_credentials_file": "credentials.enc",
    "master_password_file": "master.key"
  }
}
```

## 🚨 Troubleshooting

### **"Failed to decrypt credentials"**
- Check master password is correct
- Verify master.key file exists and is readable
- Ensure credentials.enc file is not corrupted

### **"Permission denied"**
```bash
# Fix file permissions
chmod 600 credentials.enc master.key
```

### **"Config file not found"**
- Ensure config.json exists
- Check file permissions
- Verify JSON syntax

### **Fallback to Plain Text:**
If encrypted credentials fail, the server will:
1. Log the error
2. Fall back to plain text credentials in config.json
3. Continue running (with a warning)

## 🔍 Verification

### **Check Encryption Status:**
```bash
# Server logs will show:
# "🔐 Encrypted credentials loaded successfully"
```

### **Verify File Security:**
```bash
# Check permissions
ls -la credentials.enc master.key

# Check file contents (should be encrypted)
head -c 100 credentials.enc
```

## 📊 Security Comparison

| Method | Security Level | Risk |
|--------|---------------|------|
| **Plain Text** | ❌ None | High - passwords visible |
| **Encrypted** | ✅ Military-grade | Low - AES-256-GCM |

## 🎯 Production Recommendations

### **1. Use Encrypted Credentials:**
```json
{
  "auth": {
    "use_encrypted_credentials": true
  }
}
```

### **2. Secure File Storage:**
- Store `master.key` in a secure location
- Use a dedicated secrets management system
- Consider using environment variables for master password

### **3. Regular Rotation:**
- Change master password periodically
- Re-encrypt credentials with new master password
- Update backup files

### **4. Monitoring:**
- Monitor server logs for encryption errors
- Set up alerts for failed decryption attempts
- Regular security audits

## 🆘 Recovery

### **Lost Master Password:**
1. You cannot recover encrypted credentials
2. Re-run the setup process with new credentials
3. Update your backup strategy

### **Corrupted Files:**
1. Restore from backup
2. Or re-run setup process
3. Update config.json if needed

## 📞 Support

If you encounter issues:
1. Check server logs for error messages
2. Verify file permissions (600)
3. Ensure master password is correct
4. Try the fallback to plain text mode

## 🔐 Summary

**Encrypted credentials provide:**
- ✅ **Military-grade security** (AES-256-GCM)
- ✅ **No plain text passwords** in config files
- ✅ **Secure file permissions** (600)
- ✅ **Easy setup** with automated tools
- ✅ **Fallback support** for troubleshooting

**Your credentials are now protected with industry-standard encryption!** 🛡️

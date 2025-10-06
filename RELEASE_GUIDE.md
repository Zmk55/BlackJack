# 🚀 BlackJack Release Guide

This guide explains how to push updates to BlackJack and ensure users get notified of new versions.

## 📋 Pre-Release Checklist

Before releasing a new version, ensure you have:

- [ ] All features tested and working
- [ ] No sensitive data in git (credentials, keys, etc.)
- [ ] Documentation updated if needed
- [ ] All changes committed to git
- [ ] Server builds successfully

## 🔄 Release Process

### Step 1: Update Version Numbers

**1.1 Update the VERSION file:**
```bash
# Edit the VERSION file at repo root
echo "1.0.1" > VERSION
```

**1.2 Update web-app/version.js:**
```bash
# Edit web-app/version.js to match
echo 'window.BLACKJACK_VERSION = "1.0.1";' > web-app/version.js
```

**1.3 Update cache-busting parameters:**
```bash
# Update the version parameter in web-app/index.html
# Change: ?v=44&t=1736100000
# To:     ?v=45&t=1736100000 (increment the number)
```

### Step 2: Commit and Push Changes

```bash
# Add all changes
git add VERSION web-app/version.js web-app/index.html

# Commit with descriptive message
git commit -m "🚀 Release v1.0.1

✨ New Features:
- [List new features here]

🐛 Bug Fixes:
- [List bug fixes here]

🔧 Improvements:
- [List improvements here]"

# Push to GitHub
git push origin main
```

### Step 3: Verify Release

**3.1 Check GitHub VERSION file:**
```bash
# Verify the VERSION file is accessible
curl -s "https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION"
# Should return: 1.0.1
```

**3.2 Test Update Detection:**
1. Open BlackJack in browser: `http://localhost:8082`
2. Go to Settings > Application > Updates
3. Click "Check for Updates"
4. Should show: "BlackJack v1.0.1 is available (you have v1.0.0). Reload now?"

**3.3 Test Passive Banner:**
1. Refresh the page
2. Should see update banner at top: "🔄 New version v1.0.1 available"
3. Test "Reload" and "Dismiss" buttons

## 🎯 How Users Get Updates

### Automatic Detection
- **On Page Load**: Users automatically see update banner if newer version available
- **Banner Actions**: 
  - "Reload" → Updates to new version with cache-busting
  - "Dismiss" → Hides banner for current session

### Manual Check
- **Location**: Settings > Application > Updates
- **Button**: "Check for Updates"
- **Feedback**: Shows current status or prompts to update

### Update Process
1. User clicks "Reload" or confirms update
2. Page reloads with cache-busting parameters: `?v=1.0.1&t=<timestamp>`
3. Browser fetches new version files
4. User sees updated application

## 🔧 Technical Details

### Version Source of Truth
- **Primary**: `VERSION` file at repo root
- **GitHub URL**: `https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION`
- **App Version**: `web-app/version.js` (must match VERSION file)

### Cache Busting Strategy
- **GitHub Requests**: `?_=${Date.now()}` parameter
- **App Reload**: `?v=<VERSION>&t=<timestamp>` parameters
- **File Loading**: Version numbers in script/link tags

### Update Detection Logic
```javascript
// Semantic version comparison
cmpSemver(latest, current) > 0  // Returns true if newer version

// Example comparisons:
// 1.0.0 vs 1.0.1 → true (newer available)
// 1.0.1 vs 1.0.0 → false (current is newer)
// 1.0.0 vs 1.0.0 → false (same version)
```

## 📝 Version Numbering

### Semantic Versioning (SemVer)
- **Format**: `MAJOR.MINOR.PATCH`
- **Examples**: `1.0.0`, `1.0.1`, `1.1.0`, `2.0.0`

### When to Increment
- **PATCH (1.0.0 → 1.0.1)**: Bug fixes, small improvements
- **MINOR (1.0.0 → 1.1.0)**: New features, enhancements
- **MAJOR (1.0.0 → 2.0.0)**: Breaking changes, major rewrites

## 🚨 Common Issues & Solutions

### Issue: Update Banner Not Showing
**Solution**: Check that both VERSION and version.js are updated and pushed to GitHub

### Issue: "You're up to date" When New Version Exists
**Solution**: Clear browser cache or check GitHub VERSION file accessibility

### Issue: Cache-Busting Not Working
**Solution**: Increment the version number in index.html script tags

### Issue: Service Worker Conflicts
**Solution**: The update system handles service workers automatically with `registration.update()`

## 🔍 Testing Checklist

Before each release, test:

- [ ] VERSION file updated and pushed
- [ ] version.js matches VERSION file
- [ ] GitHub raw URL returns correct version
- [ ] Manual update check works
- [ ] Passive update banner appears
- [ ] Reload button updates the app
- [ ] Dismiss button hides banner
- [ ] Cache-busting parameters work
- [ ] No console errors

## 📚 Quick Commands

### Check Current Version
```bash
# Local VERSION file
cat VERSION

# GitHub VERSION file
curl -s "https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION"

# App version in browser
# Open DevTools Console and type: window.BLACKJACK_VERSION
```

### Force Update Check
```bash
# In browser console
window.manualCheckForUpdates()
```

### Clear Browser Cache
```bash
# Hard refresh in browser
Ctrl+Shift+R (Linux/Windows)
Cmd+Shift+R (Mac)
```

## 🎉 Release Template

Use this template for release commits:

```bash
git commit -m "🚀 Release v1.0.1

✨ New Features:
- Added check for updates functionality
- Implemented passive update banner
- Added manual update check in settings

🐛 Bug Fixes:
- Fixed cache-busting for new files
- Resolved service worker update conflicts

🔧 Improvements:
- Enhanced error handling for network issues
- Improved update banner styling
- Added semantic version comparison

📋 Testing:
- Manual update check: ✅
- Passive update banner: ✅
- Cache-busting reload: ✅
- Service worker support: ✅"
```

## 🔐 Security Notes

- Never commit sensitive files (credentials.enc, master.key, etc.)
- Always test updates in a safe environment first
- Verify .gitignore is working correctly
- Check that no personal data is exposed in commits

---

**Remember**: The update system is designed to be user-friendly and automatic. Users will see update notifications without any manual intervention, making it easy to keep BlackJack up-to-date! 🎯

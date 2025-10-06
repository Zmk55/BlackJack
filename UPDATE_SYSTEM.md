# 🔄 BlackJack Update System

## Overview

BlackJack now includes a comprehensive update system that automatically notifies users when new versions are available and provides easy ways to update the application.

## 🎯 How It Works

### Version Management
- **Source of Truth**: `VERSION` file at repository root
- **App Version**: `web-app/version.js` exposes `window.BLACKJACK_VERSION`
- **GitHub Integration**: Fetches latest version from `https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION`

### Update Detection
1. **Passive Check**: Automatically runs on page load
2. **Manual Check**: Available in Settings > Application > Updates
3. **Version Comparison**: Uses semantic versioning (SemVer) comparison
4. **User Notification**: Shows update banner or confirmation dialog

### Update Process
1. User sees update notification (banner or manual check)
2. User clicks "Reload" or confirms update
3. Page reloads with cache-busting parameters: `?v=<VERSION>&t=<timestamp>`
4. Browser fetches new version files
5. User sees updated application

## 🛠️ Release Management Tools

### Quick Commands
```bash
# Check current versions
./check-version.sh

# Create new release
./release.sh 1.0.1 "Added new features"

# Manual version check
curl -s "https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION"
```

### Release Process
1. **Update Version**: `./release.sh <version> [message]`
2. **Verify Release**: Check GitHub VERSION file
3. **Test Updates**: Manual and passive update checks
4. **User Experience**: Automatic notifications and easy updates

## 📁 Files Involved

### Core Files
- `VERSION` - Version source of truth
- `web-app/version.js` - App version exposure
- `web-app/update.js` - Update checking logic
- `web-app/index.html` - Update banner and script loading
- `web-app/styles.css` - Update banner styling

### Management Tools
- `RELEASE_GUIDE.md` - Comprehensive release documentation
- `release.sh` - Automated release script
- `check-version.sh` - Version checker and validator

## 🎨 User Experience

### Update Banner
- **Location**: Fixed at top of page
- **Trigger**: Automatic on page load when newer version available
- **Actions**: "Reload" (updates) and "Dismiss" (hides for session)
- **Styling**: Modern blue gradient with smooth animations

### Manual Check
- **Location**: Settings > Application > Updates
- **Button**: "Check for Updates" with refresh icon
- **Feedback**: Shows current status or prompts to update
- **Error Handling**: User-friendly error messages

## 🔧 Technical Details

### Cache Busting
- **GitHub Requests**: `?_=${Date.now()}` parameter
- **App Reload**: `?v=<VERSION>&t=<timestamp>` parameters
- **File Loading**: Version numbers in script/link tags

### Service Worker Support
- **Detection**: Checks for service worker registration
- **Update Process**: Calls `registration.update()`
- **Skip Waiting**: Sends `{type: "SKIP_WAITING"}` message
- **Graceful Fallback**: Works without service worker

### Error Handling
- **Network Issues**: Graceful handling of offline/404 scenarios
- **Manual Check**: Shows user-friendly error messages
- **Passive Check**: Fails silently with console logging

## 🚀 Benefits

### For Users
- **Automatic Notifications**: See updates without manual checking
- **Easy Updates**: One-click update process
- **No Data Loss**: Updates preserve all settings and data
- **Transparent Process**: Clear feedback on update status

### For Developers
- **Automated Process**: Scripts handle version updates
- **Consistent Releases**: Prevents version mismatches
- **Easy Testing**: Built-in verification tools
- **Clear Documentation**: Comprehensive guides and examples

## 📋 Testing Checklist

Before each release:
- [ ] VERSION file updated and pushed
- [ ] version.js matches VERSION file
- [ ] GitHub raw URL returns correct version
- [ ] Manual update check works
- [ ] Passive update banner appears
- [ ] Reload button updates the app
- [ ] Dismiss button hides banner
- [ ] Cache-busting parameters work
- [ ] No console errors

## 🔍 Troubleshooting

### Common Issues
- **Update Banner Not Showing**: Check VERSION and version.js are updated
- **"You're up to date" When New Version Exists**: Clear browser cache
- **Cache-Busting Not Working**: Increment version in index.html script tags
- **Service Worker Conflicts**: System handles automatically

### Quick Fixes
```bash
# Check versions
./check-version.sh

# Force update check in browser console
window.manualCheckForUpdates()

# Clear browser cache
Ctrl+Shift+R (Linux/Windows)
Cmd+Shift+R (Mac)
```

## 🎉 Success Metrics

The update system provides:
- ✅ **Zero-Config Updates**: Users get notified automatically
- ✅ **One-Click Updates**: Simple reload process
- ✅ **Version Consistency**: All files stay in sync
- ✅ **Error Resilience**: Graceful handling of network issues
- ✅ **Developer Friendly**: Automated release process

---

**The update system ensures BlackJack users always have the latest features and fixes with minimal effort!** 🚀

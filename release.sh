#!/bin/bash

# BlackJack Release Script
# Usage: ./release.sh <version> [commit_message]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if version is provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Version number required${NC}"
    echo "Usage: ./release.sh <version> [commit_message]"
    echo "Example: ./release.sh 1.0.1 'Added new features'"
    exit 1
fi

VERSION=$1
COMMIT_MSG=${2:-"🚀 Release v$VERSION"}

echo -e "${BLUE}🚀 Starting BlackJack Release Process${NC}"
echo -e "${YELLOW}Version: $VERSION${NC}"
echo -e "${YELLOW}Commit Message: $COMMIT_MSG${NC}"
echo

# Step 1: Update VERSION file
echo -e "${BLUE}📝 Step 1: Updating VERSION file${NC}"
echo "$VERSION" > VERSION
echo -e "${GREEN}✅ VERSION file updated to $VERSION${NC}"

# Step 2: Update version.js
echo -e "${BLUE}📝 Step 2: Updating version.js${NC}"
echo "// Exposed app version; updated on release" > web-app/version.js
echo "window.BLACKJACK_VERSION = \"$VERSION\";" >> web-app/version.js
echo -e "${GREEN}✅ version.js updated to $VERSION${NC}"

# Step 3: Update cache-busting parameters
echo -e "${BLUE}📝 Step 3: Updating cache-busting parameters${NC}"
# Extract current version number from index.html
CURRENT_V=$(grep -o 'v=[0-9]*' web-app/index.html | head -1 | cut -d'=' -f2)
NEW_V=$((CURRENT_V + 1))

# Update all version parameters in index.html
sed -i "s/v=$CURRENT_V/v=$NEW_V/g" web-app/index.html
echo -e "${GREEN}✅ Cache-busting parameters updated from v$CURRENT_V to v$NEW_V${NC}"

# Step 4: Show changes
echo -e "${BLUE}📋 Step 4: Reviewing changes${NC}"
echo -e "${YELLOW}Files to be committed:${NC}"
git status --porcelain | grep -E "(VERSION|version\.js|index\.html)" || echo "No changes detected"

echo
echo -e "${YELLOW}Changes preview:${NC}"
echo -e "${BLUE}VERSION file:${NC}"
cat VERSION
echo
echo -e "${BLUE}version.js:${NC}"
cat web-app/version.js
echo

# Step 5: Confirm before committing
echo -e "${YELLOW}⚠️  Ready to commit and push changes?${NC}"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Release cancelled${NC}"
    exit 1
fi

# Step 6: Commit and push
echo -e "${BLUE}📝 Step 5: Committing and pushing changes${NC}"
git add VERSION web-app/version.js web-app/index.html
git commit -m "$COMMIT_MSG"
git push origin main

echo -e "${GREEN}✅ Changes committed and pushed to GitHub${NC}"

# Step 7: Verify release
echo -e "${BLUE}🔍 Step 6: Verifying release${NC}"
echo -e "${YELLOW}Waiting 5 seconds for GitHub to update...${NC}"
sleep 5

# Check GitHub VERSION file
echo -e "${BLUE}Checking GitHub VERSION file...${NC}"
GITHUB_VERSION=$(curl -s "https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION" || echo "ERROR")
if [ "$GITHUB_VERSION" = "$VERSION" ]; then
    echo -e "${GREEN}✅ GitHub VERSION file updated successfully${NC}"
else
    echo -e "${RED}❌ GitHub VERSION file verification failed${NC}"
    echo -e "${YELLOW}Expected: $VERSION${NC}"
    echo -e "${YELLOW}Got: $GITHUB_VERSION${NC}"
fi

# Final instructions
echo
echo -e "${GREEN}🎉 Release $VERSION completed!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the update functionality:"
echo "   - Open http://localhost:8082"
echo "   - Go to Settings > Application > Updates"
echo "   - Click 'Check for Updates'"
echo
echo "2. Verify passive update banner:"
echo "   - Refresh the page"
echo "   - Should see update banner if version changed"
echo
echo -e "${BLUE}📚 For more details, see RELEASE_GUIDE.md${NC}"

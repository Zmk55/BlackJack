#!/bin/bash

# BlackJack Version Checker
# Quick script to check current versions

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔍 BlackJack Version Checker${NC}"
echo "================================"

# Check local VERSION file
if [ -f "VERSION" ]; then
    LOCAL_VERSION=$(cat VERSION)
    echo -e "${GREEN}📁 Local VERSION file: $LOCAL_VERSION${NC}"
else
    echo -e "${RED}❌ VERSION file not found${NC}"
fi

# Check version.js
if [ -f "web-app/version.js" ]; then
    JS_VERSION=$(grep -o '"[0-9]\+\.[0-9]\+\.[0-9]\+"' web-app/version.js | tr -d '"')
    echo -e "${GREEN}📄 version.js: $JS_VERSION${NC}"
else
    echo -e "${RED}❌ version.js not found${NC}"
fi

# Check GitHub VERSION file
echo -e "${YELLOW}🌐 Checking GitHub VERSION file...${NC}"
GITHUB_VERSION=$(curl -s "https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION" 2>/dev/null || echo "ERROR")
if [ "$GITHUB_VERSION" != "ERROR" ]; then
    echo -e "${GREEN}🌐 GitHub VERSION: $GITHUB_VERSION${NC}"
else
    echo -e "${RED}❌ Could not fetch GitHub VERSION${NC}"
fi

# Check cache-busting version
CACHE_V=$(grep -o 'v=[0-9]*' web-app/index.html | head -1 | cut -d'=' -f2 || echo "N/A")
echo -e "${GREEN}🔄 Cache-busting version: $CACHE_V${NC}"

echo
echo -e "${BLUE}📊 Version Summary:${NC}"
echo "Local VERSION:    $LOCAL_VERSION"
echo "version.js:       $JS_VERSION"
echo "GitHub VERSION:   $GITHUB_VERSION"
echo "Cache version:    $CACHE_V"

# Check for mismatches
echo
if [ "$LOCAL_VERSION" = "$JS_VERSION" ] && [ "$LOCAL_VERSION" = "$GITHUB_VERSION" ]; then
    echo -e "${GREEN}✅ All versions match!${NC}"
else
    echo -e "${YELLOW}⚠️  Version mismatch detected:${NC}"
    [ "$LOCAL_VERSION" != "$JS_VERSION" ] && echo -e "${RED}   - Local VERSION ≠ version.js${NC}"
    [ "$LOCAL_VERSION" != "$GITHUB_VERSION" ] && echo -e "${RED}   - Local VERSION ≠ GitHub VERSION${NC}"
    [ "$JS_VERSION" != "$GITHUB_VERSION" ] && echo -e "${RED}   - version.js ≠ GitHub VERSION${NC}"
fi

echo
echo -e "${BLUE}💡 To update versions, run: ./release.sh <new_version>${NC}"

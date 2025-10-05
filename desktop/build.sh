#!/bin/bash

# BlackJack Desktop Application Build Script

echo "Building BlackJack Desktop Application..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Error: Rust is not installed. Please install Rust first:"
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if Tauri CLI is installed
if ! command -v tauri &> /dev/null; then
    echo "Installing Tauri CLI..."
    cargo install tauri-cli
fi

# Build the application
echo "Building Tauri desktop application..."
cd src-tauri
cargo tauri build

echo "Build complete! The desktop application should be in src-tauri/target/release/"
echo "You can run it with: ./src-tauri/target/release/blackjack-desktop"
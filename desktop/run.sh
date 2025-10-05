#!/bin/bash

# BlackJack Desktop Application Launcher

echo "Starting BlackJack Desktop Application..."

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

# Run in development mode
echo "Running BlackJack Desktop App in development mode..."
cd src-tauri
cargo tauri dev
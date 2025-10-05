.PHONY: build clean test lint install

# Build variables
BINARY_NAME=blackjack
BUILD_DIR=build
VERSION=$(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS=-ldflags "-X main.Version=$(VERSION)"

# Default target
all: build

# Build the binary
build:
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/blackjack

# Build for multiple platforms
build-all:
	@echo "Building for multiple platforms..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 ./cmd/blackjack
	GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-darwin-amd64 ./cmd/blackjack
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-windows-amd64.exe ./cmd/blackjack

# Install to system
install: build
	@echo "Installing $(BINARY_NAME)..."
	sudo cp $(BUILD_DIR)/$(BINARY_NAME) /usr/local/bin/

# Run tests
test:
	@echo "Running tests..."
	go test -v ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Lint code
lint:
	@echo "Running linter..."
	golangci-lint run

# Format code
fmt:
	@echo "Formatting code..."
	go fmt ./...

# Clean build artifacts
clean:
	@echo "Cleaning..."
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html

# Development setup
dev-setup:
	@echo "Setting up development environment..."
	go mod download
	go mod tidy
	@if ! command -v golangci-lint >/dev/null 2>&1; then \
		echo "Installing golangci-lint..."; \
		curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $$(go env GOPATH)/bin v1.55.2; \
	fi

# Run the application
run:
	@echo "Running $(BINARY_NAME)..."
	go run ./cmd/blackjack

# Web server targets
web-server:
	@echo "Starting BlackJack Web Server..."
	cd web-server && go run main.go

web-server-build:
	@echo "Building BlackJack Web Server..."
	cd web-server && go build -o blackjack-server main.go

web-server-clean:
	@echo "Cleaning web server build artifacts..."
	cd web-server && rm -f blackjack-server

# Unified startup script
start:
	@echo "Starting BlackJack with unified script..."
	./start.sh

start-web:
	@echo "Starting BlackJack Web Application..."
	./start.sh -m web

start-desktop:
	@echo "Starting BlackJack Desktop Application..."
	./start.sh -m desktop

start-tui:
	@echo "Starting BlackJack Terminal UI..."
	./start.sh -m tui

# Help
help:
	@echo "Available targets:"
	@echo "  build        - Build the binary"
	@echo "  build-all    - Build for multiple platforms"
	@echo "  install      - Install to system"
	@echo "  test         - Run tests"
	@echo "  test-coverage- Run tests with coverage"
	@echo "  lint         - Run linter"
	@echo "  fmt          - Format code"
	@echo "  clean        - Clean build artifacts"
	@echo "  dev-setup    - Setup development environment"
	@echo "  run          - Run the application"
	@echo ""
	@echo "Web Server targets:"
	@echo "  web-server   - Start web server (development)"
	@echo "  web-server-build - Build web server binary"
	@echo "  web-server-clean - Clean web server artifacts"
	@echo ""
	@echo "Unified startup:"
	@echo "  start        - Start with unified script (interactive)"
	@echo "  start-web    - Start web application"
	@echo "  start-desktop- Start desktop application"
	@echo "  start-tui    - Start terminal UI"
	@echo "  help         - Show this help"

package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pkg/sftp"
	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Authentication system
type User struct {
	Username     string    `json:"username"`
	Password     string    `json:"password"`
	CreatedAt    time.Time `json:"created_at"`
	RecoveryCode string    `json:"recovery_code"`
	DataPath     string    `json:"data_path"`
}

type AccountCreationRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type AccountRecoveryRequest struct {
	Username     string `json:"username"`
	RecoveryCode string `json:"recovery_code"`
	NewPassword  string `json:"new_password"`
}

type Session struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}

var (
	// User accounts storage
	userAccounts = make(map[string]*User)
	userAccountsMutex sync.RWMutex

	// Active authentication sessions
	authSessions      = make(map[string]*Session)
	authSessionsMutex sync.RWMutex

	// Session duration (loaded from config)
	sessionDuration = 24 * time.Hour
)

// Config structure
type Config struct {
	Auth struct {
		Username             string `json:"username"`
		Password             string `json:"password"`
		SessionDurationHours int    `json:"session_duration_hours"`
		// New encrypted credential fields
		UseEncryptedCredentials  bool   `json:"use_encrypted_credentials"`
		EncryptedCredentialsFile string `json:"encrypted_credentials_file"`
		MasterPasswordFile       string `json:"master_password_file"`
	} `json:"auth"`
	Security struct {
		RequireHTTPS           bool     `json:"require_https"`
		AllowedIPs             []string `json:"allowed_ips"`
		MaxLoginAttempts       int      `json:"max_login_attempts"`
		LockoutDurationMinutes int      `json:"lockout_duration_minutes"`
	} `json:"security"`
	Server struct {
		Port string `json:"port"`
		Host string `json:"host"`
	} `json:"server"`
}

// Load configuration
func loadConfig() *Config {
	config := &Config{}

	// Try to read config file
	data, err := os.ReadFile("config.json")
	if err != nil {
		log.Printf("⚠️  Config file not found, using defaults. Create config.json to customize settings.")
		return config
	}

	if err := json.Unmarshal(data, config); err != nil {
		log.Printf("❌ Error parsing config.json: %v", err)
		return config
	}

	// Handle encrypted credentials if enabled
	if config.Auth.UseEncryptedCredentials {
		if err := loadEncryptedCredentialsFromConfig(config); err != nil {
			log.Printf("❌ Error loading encrypted credentials: %v", err)
			log.Printf("⚠️  Falling back to plain text credentials in config.json")
		} else {
			log.Printf("🔐 Encrypted credentials loaded successfully")
		}
	}

	log.Printf("✅ Configuration loaded from config.json")
	return config
}

func loadEncryptedCredentialsFromConfig(config *Config) error {
	// Set default file paths if not specified
	credentialsFile := config.Auth.EncryptedCredentialsFile
	if credentialsFile == "" {
		credentialsFile = "credentials.enc"
	}

	masterPasswordFile := config.Auth.MasterPasswordFile
	if masterPasswordFile == "" {
		masterPasswordFile = "master.key"
	}

	// Read master password
	masterPassword, err := os.ReadFile(masterPasswordFile)
	if err != nil {
		return fmt.Errorf("failed to read master password file: %v", err)
	}

	// Load encrypted credentials
	enc, err := loadEncryptedCredentials(credentialsFile)
	if err != nil {
		return fmt.Errorf("failed to load encrypted credentials: %v", err)
	}

	// Decrypt credentials
	username, password, err := decryptCredentials(enc, strings.TrimSpace(string(masterPassword)))
	if err != nil {
		return fmt.Errorf("failed to decrypt credentials: %v", err)
	}

	// Update config with decrypted credentials
	config.Auth.Username = username
	config.Auth.Password = password

	return nil
}

func saveConfig() error {
	// Create config structure with current settings
	config := &Config{}
	config.Auth.SessionDurationHours = 24
	config.Server.Port = "8082"
	config.Server.Host = "0.0.0.0"
	config.Auth.UseEncryptedCredentials = true
	config.Auth.EncryptedCredentialsFile = "credentials.enc"
	config.Auth.MasterPasswordFile = "master.key"

	// Write config to file
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	if err := os.WriteFile("config.json", data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}

	log.Printf("✅ Configuration saved to config.json")
	return nil
}

// Authentication helper functions
func hashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return base64.StdEncoding.EncodeToString(hash[:])
}

func checkPassword(password, hashedPassword string) bool {
	// For hashed passwords
	hashedInput := hashPassword(password)
	return hashedInput == hashedPassword
}

func generateRecoveryCode() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}

func createUser(username, password string) (*User, error) {
	userAccountsMutex.Lock()
	defer userAccountsMutex.Unlock()

	// Check if user already exists
	if _, exists := userAccounts[username]; exists {
		return nil, fmt.Errorf("username already exists")
	}

	// Validate username and password
	if len(username) < 3 {
		return nil, fmt.Errorf("username must be at least 3 characters")
	}
	if len(password) < 6 {
		return nil, fmt.Errorf("password must be at least 6 characters")
	}

	// Create user
	user := &User{
		Username:     username,
		Password:     hashPassword(password),
		CreatedAt:    time.Now(),
		RecoveryCode: generateRecoveryCode(),
		DataPath:     fmt.Sprintf("data_%s", username),
	}

	userAccounts[username] = user
	return user, nil
}

func getUser(username string) (*User, bool) {
	userAccountsMutex.RLock()
	defer userAccountsMutex.RUnlock()
	user, exists := userAccounts[username]
	return user, exists
}

func saveUserAccounts() error {
	userAccountsMutex.RLock()
	defer userAccountsMutex.RUnlock()

	data, err := json.MarshalIndent(userAccounts, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile("accounts.json", data, 0600)
}

func loadUserAccounts() error {
	data, err := os.ReadFile("accounts.json")
	if err != nil {
		if os.IsNotExist(err) {
			// No accounts file exists yet, start with empty accounts
			return nil
		}
		return err
	}

	userAccountsMutex.Lock()
	defer userAccountsMutex.Unlock()

	return json.Unmarshal(data, &userAccounts)
}

func generateSessionID() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func createSession(username string) *Session {
	sessionID := generateSessionID()
	now := time.Now()

	session := &Session{
		ID:        sessionID,
		Username:  username,
		CreatedAt: now,
		ExpiresAt: now.Add(sessionDuration),
	}

	authSessionsMutex.Lock()
	authSessions[sessionID] = session
	authSessionsMutex.Unlock()

	return session
}

func validateSession(sessionID string) (*Session, bool) {
	authSessionsMutex.RLock()
	session, exists := authSessions[sessionID]
	authSessionsMutex.RUnlock()

	if !exists {
		return nil, false
	}

	if time.Now().After(session.ExpiresAt) {
		// Session expired, remove it
		authSessionsMutex.Lock()
		delete(authSessions, sessionID)
		authSessionsMutex.Unlock()
		return nil, false
	}

	return session, true
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Check for session cookie
		cookie, err := r.Cookie("session_id")
		if err != nil {
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		session, valid := validateSession(cookie.Value)
		if !valid {
			http.Error(w, "Invalid or expired session", http.StatusUnauthorized)
			return
		}

		// Add session info to request context
		ctx := context.WithValue(r.Context(), "session", session)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// Encryption functions for secure credential storage
type EncryptedCredentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Salt     string `json:"salt"`
	Nonce    string `json:"nonce"`
	Data     string `json:"data"`
}

// Encrypted data storage structures
type EncryptedData struct {
	Type    string `json:"type"` // "hosts", "groups", "tags", "state"
	Salt    string `json:"salt"`
	Nonce   string `json:"nonce"`
	Data    string `json:"data"`
	Version int    `json:"version"`
	Created string `json:"created"`
}

type DataRequest struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type DataResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func generateKeyFromPassword(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, 100000, 32, sha256.New)
}

func encryptCredentials(username, password, masterPassword string) (*EncryptedCredentials, error) {
	// Generate random salt and nonce
	salt := make([]byte, 32)
	nonce := make([]byte, 12)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	// Derive key from master password
	key := generateKeyFromPassword(masterPassword, salt)

	// Prepare data to encrypt
	credentials := map[string]string{
		"username": username,
		"password": password,
	}
	data, err := json.Marshal(credentials)
	if err != nil {
		return nil, err
	}

	// Encrypt data
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	encryptedData := aesGCM.Seal(nil, nonce, data, nil)

	return &EncryptedCredentials{
		Username: username, // Store username in plain text for easy access
		Password: "",       // Never store password in plain text
		Salt:     base64.StdEncoding.EncodeToString(salt),
		Nonce:    base64.StdEncoding.EncodeToString(nonce),
		Data:     base64.StdEncoding.EncodeToString(encryptedData),
	}, nil
}

func decryptCredentials(enc *EncryptedCredentials, masterPassword string) (string, string, error) {
	// Decode salt and nonce
	salt, err := base64.StdEncoding.DecodeString(enc.Salt)
	if err != nil {
		return "", "", err
	}

	nonce, err := base64.StdEncoding.DecodeString(enc.Nonce)
	if err != nil {
		return "", "", err
	}

	encryptedData, err := base64.StdEncoding.DecodeString(enc.Data)
	if err != nil {
		return "", "", err
	}

	// Derive key from master password
	key := generateKeyFromPassword(masterPassword, salt)

	// Decrypt data
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", "", err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return "", "", err
	}

	decryptedData, err := aesGCM.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return "", "", err
	}

	// Parse decrypted JSON
	var credentials map[string]string
	if err := json.Unmarshal(decryptedData, &credentials); err != nil {
		return "", "", err
	}

	return credentials["username"], credentials["password"], nil
}

func saveEncryptedCredentials(enc *EncryptedCredentials, filename string) error {
	data, err := json.MarshalIndent(enc, "", "  ")
	if err != nil {
		return err
	}

	// Write with restricted permissions (600 = owner read/write only)
	return os.WriteFile(filename, data, 0600)
}

func loadEncryptedCredentials(filename string) (*EncryptedCredentials, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var enc EncryptedCredentials
	if err := json.Unmarshal(data, &enc); err != nil {
		return nil, err
	}

	return &enc, nil
}

// Data encryption functions
func encryptData(data interface{}, masterPassword string) (*EncryptedData, error) {
	// Generate random salt and nonce
	salt := make([]byte, 32)
	nonce := make([]byte, 12)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}

	// Derive key from master password
	key := generateKeyFromPassword(masterPassword, salt)

	// Prepare data to encrypt
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	// Encrypt data
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	encryptedData := aesGCM.Seal(nil, nonce, jsonData, nil)

	return &EncryptedData{
		Type:    "application_data",
		Salt:    base64.StdEncoding.EncodeToString(salt),
		Nonce:   base64.StdEncoding.EncodeToString(nonce),
		Data:    base64.StdEncoding.EncodeToString(encryptedData),
		Version: 1,
		Created: time.Now().Format(time.RFC3339),
	}, nil
}

func decryptData(enc *EncryptedData, masterPassword string) (interface{}, error) {
	// Decode salt and nonce
	salt, err := base64.StdEncoding.DecodeString(enc.Salt)
	if err != nil {
		return nil, err
	}

	nonce, err := base64.StdEncoding.DecodeString(enc.Nonce)
	if err != nil {
		return nil, err
	}

	// Derive key from master password
	key := generateKeyFromPassword(masterPassword, salt)

	// Decode encrypted data
	encryptedData, err := base64.StdEncoding.DecodeString(enc.Data)
	if err != nil {
		return nil, err
	}

	// Decrypt data
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aesGCM, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	decryptedData, err := aesGCM.Open(nil, nonce, encryptedData, nil)
	if err != nil {
		return nil, err
	}

	// Parse JSON data
	var result interface{}
	if err := json.Unmarshal(decryptedData, &result); err != nil {
		return nil, err
	}

	return result, nil
}

func saveEncryptedData(enc *EncryptedData, filename string) error {
	data, err := json.MarshalIndent(enc, "", "  ")
	if err != nil {
		return err
	}

	// Write with restricted permissions (600 = owner read/write only)
	return os.WriteFile(filename, data, 0600)
}

func loadEncryptedData(filename string) (*EncryptedData, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	var enc EncryptedData
	if err := json.Unmarshal(data, &enc); err != nil {
		return nil, err
	}

	return &enc, nil
}

// SSH connection request
type SSHRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	KeyPath  string `json:"keyPath"`
}

// WebSocket message types
type WSMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

// SSH session manager
type SSHSession struct {
	ID      string
	Client  *ssh.Client
	Session *ssh.Session
	Conn    *websocket.Conn
	Context context.Context
	Cancel  context.CancelFunc
	stdin   io.WriteCloser
	mu      sync.Mutex
}

var sshSessions = make(map[string]*SSHSession)
var sshSessionsMutex sync.RWMutex

func main() {
	// Load configuration
	config := loadConfig()

	// Load user accounts
	if err := loadUserAccounts(); err != nil {
		log.Printf("❌ Error loading user accounts: %v", err)
	}

	if config.Auth.SessionDurationHours > 0 {
		sessionDuration = time.Duration(config.Auth.SessionDurationHours) * time.Hour
	}

	log.Printf("🔐 Account-based authentication enabled")
	log.Printf("⏰ Session duration: %v", sessionDuration)

	// Authentication endpoints
	http.HandleFunc("/api/login", handleLogin)
	http.HandleFunc("/api/logout", handleLogout)
	http.HandleFunc("/api/auth-status", handleAuthStatus)
	http.HandleFunc("/api/create-account", handleCreateAccount)
	http.HandleFunc("/api/recover-account", handleRecoverAccount)

	// Account management endpoints (protected)
	http.HandleFunc("/api/account-info", requireAuth(handleAccountInfo))
	http.HandleFunc("/api/change-password", requireAuth(handleChangePassword))

	// Serve login page without authentication
	http.HandleFunc("/login.html", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./web-app/login.html")
	})

	// Serve favicon to prevent 404 errors
	http.HandleFunc("/favicon.ico", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	// Serve index.html without authentication (client-side auth check)
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// If requesting root, serve index.html
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./web-app/index.html")
			return
		}

		// For all other static files, require authentication
		requireAuth(http.FileServer(http.Dir("./web-app/")).ServeHTTP)(w, r)
	})

	// WebSocket endpoint for SSH connections (protected)
	http.HandleFunc("/ws/ssh", requireAuth(handleSSHWebSocket))

	// WebSocket endpoint for SFTP connections (protected)
	http.HandleFunc("/ws/sftp", requireAuth(handleSFTPWebSocket))

	// API endpoint for local file listing (protected)
	http.HandleFunc("/api/local-files", requireAuth(handleLocalFiles))
	http.HandleFunc("/api/user-home", requireAuth(handleUserHome))

	// API endpoints for file operations (protected)
	http.HandleFunc("/api/create-file", requireAuth(handleCreateFile))
	http.HandleFunc("/api/delete-files", requireAuth(handleDeleteFiles))
	http.HandleFunc("/api/read-file", requireAuth(handleReadFile))
	http.HandleFunc("/api/write-file", requireAuth(handleWriteFile))

	// API endpoints for encrypted data storage (protected)
	http.HandleFunc("/api/data/save", requireAuth(handleSaveData))
	http.HandleFunc("/api/data/load", requireAuth(handleLoadData))
	http.HandleFunc("/api/data/export", requireAuth(handleExportData))
	http.HandleFunc("/api/data/import", requireAuth(handleImportData))

	// API endpoints for backup and restore (protected)
	http.HandleFunc("/api/backup/export-full", requireAuth(handleExportFullBackup))
	http.HandleFunc("/api/backup/import-full", requireAuth(handleImportFullBackup))
	http.HandleFunc("/api/backup/import-hosts", requireAuth(handleImportHosts))

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := config.Server.Port
	if port == "" {
		port = "8082"
	}
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	host := config.Server.Host
	if host == "" {
		host = "0.0.0.0"
	}

	log.Printf("🚀 BlackJack Web Server starting on %s:%s", host, port)
	log.Printf("🌐 Web interface: http://%s:%s", host, port)
	log.Printf("🔌 WebSocket endpoint: ws://%s:%s/ws/ssh", host, port)

	if err := http.ListenAndServe(host+":"+port, nil); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func handleSSHWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Generate session ID
	sessionID := fmt.Sprintf("ssh_%d", time.Now().UnixNano())

	// Create session context
	ctx, cancel := context.WithCancel(context.Background())

	session := &SSHSession{
		ID:      sessionID,
		Conn:    conn,
		Context: ctx,
		Cancel:  cancel,
	}

	// Store session
	sshSessionsMutex.Lock()
	sshSessions[sessionID] = session
	sshSessionsMutex.Unlock()

	// Clean up session when done
	defer func() {
		sshSessionsMutex.Lock()
		delete(sshSessions, sessionID)
		sshSessionsMutex.Unlock()
		session.cleanup()
	}()

	log.Printf("🔌 New WebSocket connection: %s", sessionID)

	// Handle messages
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		switch msg.Type {
		case "connect":
			var req SSHRequest
			if err := json.Unmarshal([]byte(msg.Data), &req); err != nil {
				sendError(conn, "Invalid connection request")
				continue
			}
			handleSSHConnect(session, req)
		case "input":
			handleTerminalInput(session, msg.Data)
		case "resize":
			handleTerminalResize(session, msg.Data)
		case "disconnect":
			session.cleanup()
			return
		}
	}
}

func handleSSHConnect(session *SSHSession, req SSHRequest) {
	log.Printf("🔗 Connecting to %s@%s:%d", req.Username, req.Host, req.Port)

	// Create SSH client
	client, err := createSSHClient(req)
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("SSH connection failed: %v", err))
		return
	}

	session.Client = client

	// Create SSH session
	sshSession, err := client.NewSession()
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to create SSH session: %v", err))
		return
	}

	session.Session = sshSession

	// Set up terminal
	err = sshSession.RequestPty("xterm", 80, 24, ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	})
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to request PTY: %v", err))
		return
	}

	// Get pipes before starting shell
	stdout, err := sshSession.StdoutPipe()
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to get stdout pipe: %v", err))
		return
	}

	stderr, err := sshSession.StderrPipe()
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to get stderr pipe: %v", err))
		return
	}

	stdin, err := sshSession.StdinPipe()
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to get stdin pipe: %v", err))
		return
	}

	// Store stdin pipe for input handling
	session.stdin = stdin

	// Start shell
	err = sshSession.Shell()
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to start shell: %v", err))
		return
	}

	// Send connection success message
	sendMessage(session.Conn, "connected", "SSH connection established")

	// Start reading from SSH session and forwarding to WebSocket
	go session.forwardSSHToWebSocket(stdout, stderr)
}

func createSSHClient(req SSHRequest) (*ssh.Client, error) {
	config := &ssh.ClientConfig{
		User:            req.Username,
		Auth:            []ssh.AuthMethod{},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // For development only
		Timeout:         30 * time.Second,
	}

	// Add authentication methods in order of preference
	authMethods := []ssh.AuthMethod{}

	// 1. Try SSH agent first (most common)
	if agentAuth := agentAuth(); agentAuth != nil {
		log.Printf("Using SSH agent authentication for %s@%s", req.Username, req.Host)
		authMethods = append(authMethods, agentAuth)
	} else {
		log.Printf("SSH agent not available for %s@%s", req.Username, req.Host)
		// Fallback to common SSH key files
		homeDir := os.Getenv("HOME")
		if homeDir == "" {
			homeDir = os.Getenv("USERPROFILE") // Windows fallback
		}

		commonKeyPaths := []string{
			homeDir + "/.ssh/id_ed25519",
			homeDir + "/.ssh/id_rsa",
			homeDir + "/.ssh/id_ecdsa",
			homeDir + "/.ssh/id_dsa",
		}

		for _, keyPath := range commonKeyPaths {
			if _, err := os.Stat(keyPath); err == nil {
				key, err := os.ReadFile(keyPath)
				if err != nil {
					log.Printf("Failed to read key file %s: %v", keyPath, err)
					continue
				}

				signer, err := ssh.ParsePrivateKey(key)
				if err != nil {
					// Try parsing with passphrase prompt (for keys with passphrases)
					if strings.Contains(err.Error(), "passphrase") {
						log.Printf("SSH key %s requires a passphrase, skipping", keyPath)
						continue
					}
					log.Printf("Failed to parse key file %s: %v", keyPath, err)
					continue
				}

				authMethods = append(authMethods, ssh.PublicKeys(signer))
				log.Printf("Added SSH key: %s", keyPath)
			}
		}
	}

	// 2. Try password authentication only if provided
	if req.Password != "" {
		log.Printf("Adding password authentication for %s@%s (fallback method)", req.Username, req.Host)
		authMethods = append(authMethods, ssh.Password(req.Password))
	} else {
		log.Printf("No password provided for %s@%s, relying on SSH keys only", req.Username, req.Host)
	}

	// 3. Try key file if provided (and not already loaded above)
	if req.KeyPath != "" {
		// Check if this key path was already loaded in the common key paths section
		alreadyLoaded := false
		homeDir := os.Getenv("HOME")
		if homeDir == "" {
			homeDir = os.Getenv("USERPROFILE") // Windows fallback
		}

		commonKeyPaths := []string{
			homeDir + "/.ssh/id_ed25519",
			homeDir + "/.ssh/id_rsa",
			homeDir + "/.ssh/id_ecdsa",
			homeDir + "/.ssh/id_dsa",
		}

		for _, commonPath := range commonKeyPaths {
			if req.KeyPath == commonPath {
				alreadyLoaded = true
				break
			}
		}

		if !alreadyLoaded {
			key, err := os.ReadFile(req.KeyPath)
			if err != nil {
				return nil, fmt.Errorf("failed to read key file: %v", err)
			}

			signer, err := ssh.ParsePrivateKey(key)
			if err != nil {
				return nil, fmt.Errorf("failed to parse private key: %v", err)
			}

			authMethods = append(authMethods, ssh.PublicKeys(signer))
			log.Printf("Added custom SSH key: %s", req.KeyPath)
		} else {
			log.Printf("SSH key %s already loaded, skipping duplicate", req.KeyPath)
		}
	}

	// Note: SSH keys are already loaded above in the SSH agent fallback section
	// No need to load them again here

	// Set all authentication methods
	config.Auth = authMethods

	// Connect to SSH server
	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	log.Printf("🔗 Attempting SSH connection to %s with %d auth methods", addr, len(authMethods))

	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		// Provide more specific error information
		if authErr, ok := err.(*ssh.ServerAuthError); ok {
			log.Printf("❌ SSH authentication failed: %v", authErr)
			return nil, fmt.Errorf("SSH authentication failed: %v. Please ensure your public key is in the server's authorized_keys file or check your password", authErr)
		}
		log.Printf("❌ SSH connection failed: %v", err)
		return nil, fmt.Errorf("SSH connection failed: %v", err)
	}

	log.Printf("✅ SSH connection established successfully to %s", addr)

	return client, nil
}

func (s *SSHSession) forwardSSHToWebSocket(stdout, stderr io.Reader) {
	// Use a single goroutine to avoid concurrent writes
	go func() {
		// Create a combined reader for stdout and stderr
		combinedReader := io.MultiReader(stdout, stderr)
		buffer := make([]byte, 1024)

		for {
			select {
			case <-s.Context.Done():
				return
			default:
				n, err := combinedReader.Read(buffer)
				if err != nil {
					if err != io.EOF {
						log.Printf("SSH read error: %v", err)
					}
					// Don't send session_closed here - let the session monitor handle it
					return
				}
				s.sendMessageSafe("output", string(buffer[:n]))
			}
		}
	}()

	// Monitor session status - this is the only place that should send session_closed
	go func() {
		// Wait for session to end
		err := s.Session.Wait()
		if err != nil {
			log.Printf("SSH session ended with error: %v", err)
		} else {
			log.Printf("SSH session ended normally")
		}

		// Send session closed message (only once)
		s.sendMessageSafe("session_closed", "SSH session terminated")
	}()
}

func handleTerminalInput(session *SSHSession, input string) {
	if session.stdin == nil {
		log.Printf("No stdin pipe available")
		return
	}

	_, err := session.stdin.Write([]byte(input))
	if err != nil {
		log.Printf("Failed to write to SSH session: %v", err)
	}
}

func handleTerminalResize(session *SSHSession, data string) {
	if session.Session == nil {
		return
	}

	// Parse resize data (width,height)
	// This would need to be implemented based on your frontend resize format
	log.Printf("Terminal resize requested: %s", data)
}

func (s *SSHSession) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.Session != nil {
		s.Session.Close()
	}
	if s.Client != nil {
		s.Client.Close()
	}
	if s.Cancel != nil {
		s.Cancel()
	}
}

func (s *SSHSession) sendMessageSafe(msgType, data string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	msg := WSMessage{
		Type: msgType,
		Data: data,
	}

	if err := s.Conn.WriteJSON(msg); err != nil {
		log.Printf("Failed to send WebSocket message: %v", err)
	}
}

func sendMessage(conn *websocket.Conn, msgType, data string) {
	msg := WSMessage{
		Type: msgType,
		Data: data,
	}

	if err := conn.WriteJSON(msg); err != nil {
		log.Printf("Failed to send WebSocket message: %v", err)
	}
}

// Local file listing handler
func handleUserHome(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Error getting user home directory: %v", err)
		http.Error(w, "Failed to get user home directory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"homeDir": homeDir})
}

func handleLocalFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path       string `json:"path"`
		ShowHidden bool   `json:"showHidden"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Read directory contents
	files, err := readLocalDirectory(req.Path, req.ShowHidden)
	if err != nil {
		log.Printf("Error reading local directory %s: %v", req.Path, err)
		http.Error(w, "Failed to read directory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func readLocalDirectory(path string, showHidden bool) ([]map[string]interface{}, error) {
	// If path is /home/user, try to use actual user's home directory
	if path == "/home/user" {
		if homeDir, err := os.UserHomeDir(); err == nil {
			path = homeDir
		}
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}

	var files []map[string]interface{}

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue // Skip files we can't read
		}

		// Filter hidden files if not showing them
		if !showHidden && strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		file := map[string]interface{}{
			"name":    entry.Name(),
			"isDir":   entry.IsDir(),
			"size":    info.Size(),
			"modTime": info.ModTime().Unix(),
		}
		files = append(files, file)
	}

	return files, nil
}

// Create file handler
func handleCreateFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Create the file
	if err := os.WriteFile(req.Path, []byte(req.Content), 0644); err != nil {
		log.Printf("Error creating file %s: %v", req.Path, err)
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Delete files handler
func handleDeleteFiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Paths []string `json:"paths"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Delete each file
	for _, path := range req.Paths {
		if err := os.Remove(path); err != nil {
			log.Printf("Error deleting file %s: %v", path, err)
			http.Error(w, fmt.Sprintf("Failed to delete file: %s", path), http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Read file handler
func handleReadFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path string `json:"path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Read the file
	content, err := os.ReadFile(req.Path)
	if err != nil {
		log.Printf("Error reading file %s: %v", req.Path, err)
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"content": string(content)})
}

// Write file handler
func handleWriteFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Write the file
	if err := os.WriteFile(req.Path, []byte(req.Content), 0644); err != nil {
		log.Printf("Error writing file %s: %v", req.Path, err)
		http.Error(w, "Failed to write file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// Data storage handlers
func handleSaveData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req DataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get master password from config
	config := loadConfig()
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials not enabled", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Encrypt data
	encryptedData, err := encryptData(req.Data, masterPassword)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to encrypt data: %v", err), http.StatusInternalServerError)
		return
	}

	// Save encrypted data
	filename := fmt.Sprintf("data_%s.enc", req.Type)
	if err := saveEncryptedData(encryptedData, filename); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save encrypted data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DataResponse{
		Success: true,
		Data:    map[string]string{"filename": filename},
	})
}

func handleLoadData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dataType := r.URL.Query().Get("type")
	if dataType == "" {
		http.Error(w, "Type parameter required", http.StatusBadRequest)
		return
	}

	// Get config
	config := loadConfig()

	// Encrypted credentials are required for data storage
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials must be enabled for data storage", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Load encrypted data
	filename := fmt.Sprintf("data_%s.enc", dataType)
	encryptedData, err := loadEncryptedData(filename)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty data if file doesn't exist
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(DataResponse{
				Success: true,
				Data:    nil,
			})
			return
		}
		http.Error(w, fmt.Sprintf("Failed to load encrypted data: %v", err), http.StatusInternalServerError)
		return
	}

	// Decrypt data
	decryptedData, err := decryptData(encryptedData, masterPassword)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to decrypt data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DataResponse{
		Success: true,
		Data:    decryptedData,
	})
}

func handleExportData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get master password from config
	config := loadConfig()
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials not enabled", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Load all encrypted data files
	dataTypes := []string{"hosts", "groups", "tags", "state"}
	exportData := make(map[string]interface{})

	for _, dataType := range dataTypes {
		filename := fmt.Sprintf("data_%s.enc", dataType)
		encryptedData, err := loadEncryptedData(filename)
		if err != nil {
			if !os.IsNotExist(err) {
				http.Error(w, fmt.Sprintf("Failed to load %s data: %v", dataType, err), http.StatusInternalServerError)
				return
			}
			// Skip if file doesn't exist
			continue
		}

		// Decrypt data
		decryptedData, err := decryptData(encryptedData, masterPassword)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to decrypt %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}

		exportData[dataType] = decryptedData
	}

	// Set headers for file download
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=blackjack_data_export.json")

	json.NewEncoder(w).Encode(DataResponse{
		Success: true,
		Data:    exportData,
	})
}

func handleImportData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Data map[string]interface{} `json:"data"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get master password from config
	config := loadConfig()
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials not enabled", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Import each data type
	importedTypes := []string{}
	for dataType, data := range req.Data {
		// Encrypt data
		encryptedData, err := encryptData(data, masterPassword)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to encrypt %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}

		// Save encrypted data
		filename := fmt.Sprintf("data_%s.enc", dataType)
		if err := saveEncryptedData(encryptedData, filename); err != nil {
			http.Error(w, fmt.Sprintf("Failed to save %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}

		importedTypes = append(importedTypes, dataType)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DataResponse{
		Success: true,
		Data:    map[string]interface{}{"imported_types": importedTypes},
	})
}

func sendError(conn *websocket.Conn, message string) {
	sendMessage(conn, "error", message)
}

func agentAuth() ssh.AuthMethod {
	// Check if SSH agent is available
	if sshAgentSock := os.Getenv("SSH_AUTH_SOCK"); sshAgentSock != "" {
		conn, err := net.Dial("unix", sshAgentSock)
		if err != nil {
			log.Printf("Failed to connect to SSH agent: %v", err)
			return nil
		}
		agentClient := agent.NewClient(conn)
		return ssh.PublicKeysCallback(agentClient.Signers)
	}
	log.Printf("SSH_AUTH_SOCK not set, SSH agent not available")
	return nil
}

// SFTP WebSocket handler
func handleSFTPWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("SFTP WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// Generate session ID
	sessionID := fmt.Sprintf("sftp_%d", time.Now().UnixNano())

	// Create session context
	ctx, cancel := context.WithCancel(context.Background())

	session := &SSHSession{
		ID:      sessionID,
		Conn:    conn,
		Context: ctx,
		Cancel:  cancel,
	}

	// Store session
	sshSessionsMutex.Lock()
	sshSessions[sessionID] = session
	sshSessionsMutex.Unlock()

	// Clean up session when done
	defer func() {
		sshSessionsMutex.Lock()
		delete(sshSessions, sessionID)
		sshSessionsMutex.Unlock()
		session.cleanup()
	}()

	log.Printf("🔌 New SFTP WebSocket connection: %s", sessionID)
	log.Printf("🌐 SFTP WebSocket endpoint: ws://localhost:8082/ws/sftp")

	// Handle messages
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("SFTP WebSocket read error: %v", err)
			break
		}

		log.Printf("📨 SFTP received message: %s", msg.Type)

		switch msg.Type {
		case "connect":
			var req SSHRequest
			if err := json.Unmarshal([]byte(msg.Data), &req); err != nil {
				log.Printf("❌ Invalid SFTP connection request: %v", err)
				sendError(conn, "Invalid SFTP connection request")
				continue
			}
			handleSFTPConnect(session, req)
		case "list":
			handleSFTPList(session, msg.Data)
		case "download":
			handleSFTPDownload(session, msg.Data)
		case "upload":
			handleSFTPUpload(session, msg.Data)
		case "create_file":
			handleSFTPCreateFile(session, msg.Data)
		case "delete_files":
			handleSFTPDeleteFiles(session, msg.Data)
		case "read_file":
			handleSFTPReadFile(session, msg.Data)
		case "write_file":
			handleSFTPWriteFile(session, msg.Data)
		case "disconnect":
			session.cleanup()
			return
		default:
			log.Printf("❓ Unknown SFTP message type: %s", msg.Type)
		}
	}
}

func handleSFTPConnect(session *SSHSession, req SSHRequest) {
	log.Printf("🔗 Connecting SFTP to %s@%s:%d", req.Username, req.Host, req.Port)

	// Create SSH client for SFTP
	client, err := createSSHClient(req)
	if err != nil {
		log.Printf("❌ SFTP connection failed: %v", err)
		sendError(session.Conn, fmt.Sprintf("SFTP connection failed: %v", err))
		return
	}

	session.Client = client
	log.Printf("✅ SFTP connection established successfully")

	// Send connection success message
	sendMessage(session.Conn, "connected", "SFTP connection established")
}

func handleSFTPList(session *SSHSession, path string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	// Create SFTP client
	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// List directory contents
	files, err := sftpClient.ReadDir(path)
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to list directory: %v", err))
		return
	}

	// Convert to JSON and send
	fileList := make([]map[string]interface{}, 0)
	for _, file := range files {
		fileInfo := map[string]interface{}{
			"name":    file.Name(),
			"size":    file.Size(),
			"mode":    file.Mode().String(),
			"modTime": file.ModTime().Unix(),
			"isDir":   file.IsDir(),
		}
		fileList = append(fileList, fileInfo)
	}

	fileListJSON, _ := json.Marshal(fileList)
	sendMessage(session.Conn, "file_list", string(fileListJSON))
}

func handleSFTPDownload(session *SSHSession, data string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	// Parse download request
	var req struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal([]byte(data), &req); err != nil {
		sendError(session.Conn, "Invalid download request")
		return
	}

	log.Printf("📥 SFTP Download request: %s", req.Path)

	// Create SFTP client
	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		log.Printf("❌ Failed to create SFTP client: %v", err)
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// Check if file exists and get info
	fileInfo, err := sftpClient.Stat(req.Path)
	if err != nil {
		log.Printf("❌ File not found: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("File not found: %s", req.Path))
		return
	}

	// Check if it's a directory
	if fileInfo.IsDir() {
		log.Printf("❌ Cannot download directory: %s", req.Path)
		sendError(session.Conn, fmt.Sprintf("Cannot download directory: %s", req.Path))
		return
	}

	// Check file size (limit to 100MB)
	if fileInfo.Size() > 100*1024*1024 {
		log.Printf("❌ File too large: %s (%d bytes)", req.Path, fileInfo.Size())
		sendError(session.Conn, fmt.Sprintf("File too large: %s (%.1f MB)", req.Path, float64(fileInfo.Size())/1024/1024))
		return
	}

	// Read file
	file, err := sftpClient.Open(req.Path)
	if err != nil {
		log.Printf("❌ Failed to open file: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to open file: %v", err))
		return
	}
	defer file.Close()

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		log.Printf("❌ Failed to read file: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to read file: %v", err))
		return
	}

	log.Printf("✅ SFTP Download successful: %s (%d bytes)", req.Path, len(content))

	// Send file content as base64
	encoded := base64.StdEncoding.EncodeToString(content)
	sendMessage(session.Conn, "file_content", encoded)
}

func handleSFTPUpload(session *SSHSession, data string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	// Parse upload request
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(data), &req); err != nil {
		sendError(session.Conn, "Invalid upload request")
		return
	}

	// Create SFTP client
	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// Decode base64 content
	content, err := base64.StdEncoding.DecodeString(req.Content)
	if err != nil {
		sendError(session.Conn, "Failed to decode file content")
		return
	}

	// Create file
	file, err := sftpClient.Create(req.Path)
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to create file: %v", err))
		return
	}
	defer file.Close()

	// Write content
	_, err = file.Write(content)
	if err != nil {
		sendError(session.Conn, fmt.Sprintf("Failed to write file: %v", err))
		return
	}

	sendMessage(session.Conn, "upload_success", "File uploaded successfully")
}

func handleSFTPCreateFile(session *SSHSession, data string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(data), &req); err != nil {
		sendError(session.Conn, "Invalid create file request")
		return
	}

	log.Printf("📝 SFTP Create file request: %s", req.Path)

	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		log.Printf("❌ Failed to create SFTP client: %v", err)
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// Create the file
	file, err := sftpClient.Create(req.Path)
	if err != nil {
		log.Printf("❌ Failed to create file: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to create file: %v", err))
		return
	}
	defer file.Close()

	// Write content
	if _, err := file.Write([]byte(req.Content)); err != nil {
		log.Printf("❌ Failed to write file content: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to write file content: %v", err))
		return
	}

	log.Printf("✅ SFTP File created successfully: %s", req.Path)
	sendMessage(session.Conn, "create_success", "File created successfully")
}

func handleSFTPDeleteFiles(session *SSHSession, data string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	var req struct {
		Paths []string `json:"paths"`
	}
	if err := json.Unmarshal([]byte(data), &req); err != nil {
		sendError(session.Conn, "Invalid delete files request")
		return
	}

	log.Printf("🗑️ SFTP Delete files request: %v", req.Paths)

	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		log.Printf("❌ Failed to create SFTP client: %v", err)
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// Delete each file
	for _, path := range req.Paths {
		if err := sftpClient.Remove(path); err != nil {
			log.Printf("❌ Failed to delete file: %s - %v", path, err)
			sendError(session.Conn, fmt.Sprintf("Failed to delete file %s: %v", path, err))
			return
		}
	}

	log.Printf("✅ SFTP Files deleted successfully: %v", req.Paths)
	sendMessage(session.Conn, "delete_success", "Files deleted successfully")
}

func handleSFTPReadFile(session *SSHSession, data string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	var req struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal([]byte(data), &req); err != nil {
		sendError(session.Conn, "Invalid read file request")
		return
	}

	log.Printf("📖 SFTP Read file request: %s", req.Path)

	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		log.Printf("❌ Failed to create SFTP client: %v", err)
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// Check if file exists and is not a directory
	fileInfo, err := sftpClient.Stat(req.Path)
	if err != nil {
		log.Printf("❌ File not found: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("File not found: %s", req.Path))
		return
	}

	if fileInfo.IsDir() {
		log.Printf("❌ Cannot read directory: %s", req.Path)
		sendError(session.Conn, fmt.Sprintf("Cannot read directory: %s", req.Path))
		return
	}

	// Read file content
	file, err := sftpClient.Open(req.Path)
	if err != nil {
		log.Printf("❌ Failed to open file: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to open file: %v", err))
		return
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		log.Printf("❌ Failed to read file: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to read file: %v", err))
		return
	}

	log.Printf("✅ SFTP File read successfully: %s (%d bytes)", req.Path, len(content))
	encoded := base64.StdEncoding.EncodeToString(content)
	sendMessage(session.Conn, "file_content", encoded)
}

func handleSFTPWriteFile(session *SSHSession, data string) {
	if session.Client == nil {
		sendError(session.Conn, "SFTP not connected")
		return
	}

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal([]byte(data), &req); err != nil {
		sendError(session.Conn, "Invalid write file request")
		return
	}

	log.Printf("✏️ SFTP Write file request: %s", req.Path)

	sftpClient, err := sftp.NewClient(session.Client)
	if err != nil {
		log.Printf("❌ Failed to create SFTP client: %v", err)
		sendError(session.Conn, fmt.Sprintf("Failed to create SFTP client: %v", err))
		return
	}
	defer sftpClient.Close()

	// Create or overwrite the file
	file, err := sftpClient.Create(req.Path)
	if err != nil {
		log.Printf("❌ Failed to create file: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to create file: %v", err))
		return
	}
	defer file.Close()

	// Write content
	if _, err := file.Write([]byte(req.Content)); err != nil {
		log.Printf("❌ Failed to write file content: %s - %v", req.Path, err)
		sendError(session.Conn, fmt.Sprintf("Failed to write file content: %v", err))
		return
	}

	log.Printf("✅ SFTP File written successfully: %s (%d bytes)", req.Path, len(req.Content))
	sendMessage(session.Conn, "write_success", "File written successfully")
}

// Authentication handlers
func handleLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var loginReq struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user from accounts
	user, exists := getUser(loginReq.Username)
	if !exists {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Validate password
	if !checkPassword(loginReq.Password, user.Password) {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Create session
	session := createSession(loginReq.Username)

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    session.ID,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteStrictMode,
		Expires:  session.ExpiresAt,
	})

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Login successful",
		"user":    loginReq.Username,
	})

	log.Printf("🔐 User %s logged in successfully", loginReq.Username)
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get session from cookie
	cookie, err := r.Cookie("session_id")
	if err == nil {
		// Remove session
		authSessionsMutex.Lock()
		delete(authSessions, cookie.Value)
		authSessionsMutex.Unlock()
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_id",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Expires:  time.Unix(0, 0),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Logout successful",
	})

	log.Printf("🔐 User logged out")
}

func handleCreateAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AccountCreationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Create user account
	user, err := createUser(req.Username, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save accounts to file
	if err := saveUserAccounts(); err != nil {
		log.Printf("❌ Error saving user accounts: %v", err)
		http.Error(w, "Failed to save account", http.StatusInternalServerError)
		return
	}

	// Return success response with recovery code
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"message":      "Account created successfully",
		"username":     user.Username,
		"recoveryCode": user.RecoveryCode,
		"warning":      "IMPORTANT: Save your recovery code in a secure location. You will need it to recover your account if you forget your password.",
	})

	log.Printf("🔐 New account created: %s", user.Username)
}

func handleRecoverAccount(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AccountRecoveryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user from accounts
	user, exists := getUser(req.Username)
	if !exists {
		http.Error(w, "Account not found", http.StatusNotFound)
		return
	}

	// Validate recovery code
	if user.RecoveryCode != req.RecoveryCode {
		http.Error(w, "Invalid recovery code", http.StatusUnauthorized)
		return
	}

	// Validate new password
	if len(req.NewPassword) < 6 {
		http.Error(w, "New password must be at least 6 characters", http.StatusBadRequest)
		return
	}

	// Update password and generate new recovery code
	user.Password = hashPassword(req.NewPassword)
	user.RecoveryCode = generateRecoveryCode()

	// Save accounts to file
	if err := saveUserAccounts(); err != nil {
		log.Printf("❌ Error saving user accounts: %v", err)
		http.Error(w, "Failed to update account", http.StatusInternalServerError)
		return
	}

	// Return success response with new recovery code
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"message":      "Password updated successfully",
		"username":     user.Username,
		"recoveryCode": user.RecoveryCode,
		"warning":      "IMPORTANT: Your recovery code has been updated. Save the new recovery code in a secure location.",
	})

	log.Printf("🔐 Account recovered and password updated: %s", user.Username)
}

func handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check for session cookie
	cookie, err := r.Cookie("session_id")
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
		})
		return
	}

	session, valid := validateSession(cookie.Value)
	if !valid {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"authenticated": true,
		"user":          session.Username,
		"expires_at":    session.ExpiresAt,
	})
}

// Account Management Handlers
func handleAccountInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get session from context (set by requireAuth middleware)
	session, ok := r.Context().Value("session").(*Session)
	if !ok {
		http.Error(w, "Session not found", http.StatusUnauthorized)
		return
	}

	// Get user account info
	user, exists := getUser(session.Username)
	if !exists {
		http.Error(w, "User account not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"username":  session.Username,
		"lastLogin": session.CreatedAt.Format("2006-01-02 15:04:05"),
		"createdAt": user.CreatedAt.Format("2006-01-02 15:04:05"),
		"dataPath":  user.DataPath,
	})
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get session from context (set by requireAuth middleware)
	session, ok := r.Context().Value("session").(*Session)
	if !ok {
		http.Error(w, "Session not found", http.StatusUnauthorized)
		return
	}

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user account
	user, exists := getUser(session.Username)
	if !exists {
		http.Error(w, "User account not found", http.StatusNotFound)
		return
	}

	// Validate current password
	if !checkPassword(req.CurrentPassword, user.Password) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "Current password is incorrect",
		})
		return
	}

	// Validate new password
	if len(req.NewPassword) < 6 {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"message": "New password must be at least 6 characters long",
		})
		return
	}

	// Update the user password
	user.Password = hashPassword(req.NewPassword)

	// Save accounts to file
	if err := saveUserAccounts(); err != nil {
		log.Printf("❌ Error saving user accounts: %v", err)
		http.Error(w, "Failed to save password change", http.StatusInternalServerError)
		return
	}

	log.Printf("🔐 User %s changed password successfully", session.Username)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Password changed successfully",
	})
}

// Backup and Restore Handlers
func handleExportFullBackup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get master password from config
	config := loadConfig()
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials not enabled", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Load all data types
	backupData := make(map[string]interface{})

	dataTypes := []string{"hosts", "groups", "tags"}
	for _, dataType := range dataTypes {
		filename := fmt.Sprintf("data_%s.enc", dataType)
		encryptedData, err := loadEncryptedData(filename)
		if err != nil {
			if os.IsNotExist(err) {
				backupData[dataType] = []interface{}{} // Empty array if no data
				continue
			}
			http.Error(w, fmt.Sprintf("Failed to load %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}

		decryptedData, err := decryptData(encryptedData, masterPassword)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to decrypt %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}

		backupData[dataType] = decryptedData
	}

	// Add metadata
	backupData["version"] = "1.0"
	backupData["exportDate"] = time.Now().Format(time.RFC3339)
	backupData["exportType"] = "full"

	// Create encrypted backup
	encryptedBackup, err := encryptData(backupData, masterPassword)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to encrypt backup: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert to JSON
	backupJSON, err := json.Marshal(encryptedBackup)
	if err != nil {
		http.Error(w, "Failed to marshal backup data", http.StatusInternalServerError)
		return
	}

	// Set headers for file download
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"blackjack-backup-%s.enc\"", time.Now().Format("2006-01-02")))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(backupJSON)))

	w.Write(backupJSON)
}

func handleImportFullBackup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form
	err := r.ParseMultipartForm(10 << 20) // 10 MB max
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read file content
	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// Parse encrypted backup
	var encryptedBackup EncryptedData
	if err := json.Unmarshal(content, &encryptedBackup); err != nil {
		http.Error(w, "Invalid backup file format", http.StatusBadRequest)
		return
	}

	// Get master password from config
	config := loadConfig()
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials not enabled", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Decrypt backup
	backupData, err := decryptData(&encryptedBackup, masterPassword)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to decrypt backup: %v", err), http.StatusBadRequest)
		return
	}

	// Convert to map
	backupMap, ok := backupData.(map[string]interface{})
	if !ok {
		http.Error(w, "Invalid backup data format", http.StatusBadRequest)
		return
	}

	// Import each data type
	for dataType, data := range backupMap {
		if dataType == "version" || dataType == "exportDate" || dataType == "exportType" {
			continue // Skip metadata
		}

		// Encrypt and save data
		encryptedData, err := encryptData(data, masterPassword)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to encrypt %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}

		filename := fmt.Sprintf("data_%s.enc", dataType)
		if err := saveEncryptedData(encryptedData, filename); err != nil {
			http.Error(w, fmt.Sprintf("Failed to save %s data: %v", dataType, err), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DataResponse{
		Success: true,
		Data:    "Full backup imported successfully",
	})
}

func handleImportHosts(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Hosts        []map[string]interface{} `json:"hosts"`
		DefaultGroup string                   `json:"defaultGroup"`
		ConflictMode string                   `json:"conflictMode"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Get master password from config
	config := loadConfig()
	if !config.Auth.UseEncryptedCredentials {
		http.Error(w, "Encrypted credentials not enabled", http.StatusBadRequest)
		return
	}

	masterPasswordBytes, err := os.ReadFile(config.Auth.MasterPasswordFile)
	if err != nil {
		http.Error(w, "Failed to read master password", http.StatusInternalServerError)
		return
	}
	masterPassword := string(masterPasswordBytes)

	// Load existing hosts
	filename := "data_hosts.enc"
	encryptedData, err := loadEncryptedData(filename)
	if err != nil && !os.IsNotExist(err) {
		http.Error(w, fmt.Sprintf("Failed to load existing hosts: %v", err), http.StatusInternalServerError)
		return
	}

	var existingHosts []map[string]interface{}
	if err == nil {
		decryptedData, err := decryptData(encryptedData, masterPassword)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to decrypt existing hosts: %v", err), http.StatusInternalServerError)
			return
		}
		if hosts, ok := decryptedData.([]interface{}); ok {
			for _, host := range hosts {
				if hostMap, ok := host.(map[string]interface{}); ok {
					existingHosts = append(existingHosts, hostMap)
				}
			}
		}
	}

	// Process each host
	imported := 0
	for _, host := range req.Hosts {
		// Generate new ID
		host["id"] = fmt.Sprintf("host_%d", time.Now().UnixNano())

		// Apply default group if specified
		if req.DefaultGroup != "" {
			if req.DefaultGroup == "root" {
				host["groupId"] = ""
			} else {
				host["groupId"] = req.DefaultGroup
			}
		}

		// Handle conflicts
		hostName, _ := host["name"].(string)
		hostAddress, _ := host["address"].(string)

		existingIndex := -1
		for i, existing := range existingHosts {
			if existingName, ok := existing["name"].(string); ok && existingName == hostName {
				if existingAddr, ok := existing["address"].(string); ok && existingAddr == hostAddress {
					existingIndex = i
					break
				}
			}
		}

		switch req.ConflictMode {
		case "skip":
			if existingIndex >= 0 {
				continue // Skip existing hosts
			}
		case "overwrite":
			if existingIndex >= 0 {
				existingHosts[existingIndex] = host
			} else {
				existingHosts = append(existingHosts, host)
			}
			imported++
		case "merge":
			if existingIndex >= 0 {
				// Merge existing host with new data
				existing := existingHosts[existingIndex]
				for key, value := range host {
					existing[key] = value
				}
			} else {
				existingHosts = append(existingHosts, host)
			}
			imported++
		default:
			if existingIndex < 0 {
				existingHosts = append(existingHosts, host)
				imported++
			}
		}
	}

	// Save updated hosts
	encryptedData, err = encryptData(existingHosts, masterPassword)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to encrypt hosts: %v", err), http.StatusInternalServerError)
		return
	}

	if err := saveEncryptedData(encryptedData, filename); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save hosts: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(DataResponse{
		Success: true,
		Data:    map[string]interface{}{"imported": imported},
	})
}

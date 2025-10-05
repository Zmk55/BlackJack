package main

import (
	"context"
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
	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
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

var sessions = make(map[string]*SSHSession)
var sessionsMutex sync.RWMutex

func main() {
	// Serve static files
	http.Handle("/", http.FileServer(http.Dir("../web-app/")))

	// WebSocket endpoint for SSH connections
	http.HandleFunc("/ws/ssh", handleSSHWebSocket)

	// WebSocket endpoint for SFTP connections
	http.HandleFunc("/ws/sftp", handleSFTPWebSocket)

	// API endpoint for local file listing
	http.HandleFunc("/api/local-files", handleLocalFiles)

	// API endpoints for file operations
	http.HandleFunc("/api/create-file", handleCreateFile)
	http.HandleFunc("/api/delete-files", handleDeleteFiles)
	http.HandleFunc("/api/read-file", handleReadFile)
	http.HandleFunc("/api/write-file", handleWriteFile)

	// Health check endpoint
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	port := "8082"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	log.Printf("🚀 BlackJack Web Server starting on port %s", port)
	log.Printf("🌐 Web interface: http://localhost:%s", port)
	log.Printf("🔌 WebSocket endpoint: ws://localhost:%s/ws/ssh", port)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
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
	sessionsMutex.Lock()
	sessions[sessionID] = session
	sessionsMutex.Unlock()

	// Clean up session when done
	defer func() {
		sessionsMutex.Lock()
		delete(sessions, sessionID)
		sessionsMutex.Unlock()
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

	// 3. Try key file if provided
	if req.KeyPath != "" {
		key, err := os.ReadFile(req.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read key file: %v", err)
		}

		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("failed to parse private key: %v", err)
		}

		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	// 4. Try common SSH key locations
	homeDir := os.Getenv("HOME")
	if homeDir == "" {
		homeDir = os.Getenv("USERPROFILE") // Windows fallback
	}

	commonKeyPaths := []string{
		homeDir + "/.ssh/id_rsa",
		homeDir + "/.ssh/id_ed25519",
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
				log.Printf("Failed to parse key file %s: %v", keyPath, err)
				continue
			}

			authMethods = append(authMethods, ssh.PublicKeys(signer))
			log.Printf("Added SSH key: %s", keyPath)
		}
	}

	// Set all authentication methods
	config.Auth = authMethods

	// Connect to SSH server
	addr := fmt.Sprintf("%s:%d", req.Host, req.Port)
	client, err := ssh.Dial("tcp", addr, config)
	if err != nil {
		// Provide more specific error information
		if authErr, ok := err.(*ssh.ServerAuthError); ok {
			return nil, fmt.Errorf("SSH authentication failed: %v. Please ensure your public key is in the server's authorized_keys file", authErr)
		}
		return nil, fmt.Errorf("SSH connection failed: %v", err)
	}

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
	sessionsMutex.Lock()
	sessions[sessionID] = session
	sessionsMutex.Unlock()

	// Clean up session when done
	defer func() {
		sessionsMutex.Lock()
		delete(sessions, sessionID)
		sessionsMutex.Unlock()
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

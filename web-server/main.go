package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
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
	authMethods = append(authMethods, ssh.PublicKeys())

	// 2. Try password authentication if provided
	if req.Password != "" {
		authMethods = append(authMethods, ssh.Password(req.Password))
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
					// Send session closed message
					s.sendMessageSafe("session_closed", "SSH session terminated")
					return
				}
				s.sendMessageSafe("output", string(buffer[:n]))
			}
		}
	}()

	// Monitor session status
	go func() {
		// Wait for session to end
		err := s.Session.Wait()
		if err != nil {
			log.Printf("SSH session ended with error: %v", err)
		} else {
			log.Printf("SSH session ended normally")
		}

		// Send session closed message
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

func sendError(conn *websocket.Conn, message string) {
	sendMessage(conn, "error", message)
}

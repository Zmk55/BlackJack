package ssh

import (
	"fmt"
	"net"
	"os"
	"time"

	"github.com/blackjack/blackjack/pkg/models"
	"golang.org/x/crypto/ssh"
)

// Client represents an SSH client
type Client struct {
	config *ssh.ClientConfig
	host   *models.Host
}

// NewClient creates a new SSH client
func NewClient(host *models.Host) *Client {
	config := &ssh.ClientConfig{
		User: host.User,
		Auth: []ssh.AuthMethod{},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // TODO: Implement proper host key verification
		Timeout:         30 * time.Second,
	}

	// Add authentication based on host configuration
	switch host.Auth.Type {
	case models.AuthTypePassword:
		config.Auth = append(config.Auth, ssh.Password(host.Auth.Password))
	case models.AuthTypeKey:
		// TODO: Load SSH key from file
		// For now, fall back to SSH agent
		fallthrough
	case models.AuthTypeAgent:
		// Use SSH agent
		if auth := ssh.PublicKeysCallback(sshAgentCallback()); auth != nil {
			config.Auth = append(config.Auth, auth)
		}
	}

	return &Client{
		config: config,
		host:   host,
	}
}

// Connect establishes an SSH connection
func (c *Client) Connect() (*ssh.Client, error) {
	address := fmt.Sprintf("%s:%d", c.host.Address, c.host.Port)
	
	// Test connection first
	conn, err := net.DialTimeout("tcp", address, c.config.Timeout)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to %s: %w", address, err)
	}
	conn.Close()

	// Establish SSH connection
	client, err := ssh.Dial("tcp", address, c.config)
	if err != nil {
		return nil, fmt.Errorf("SSH connection failed: %w", err)
	}

	return client, nil
}

// ConnectAndRun connects and runs a command
func (c *Client) ConnectAndRun(command string) error {
	client, err := c.Connect()
	if err != nil {
		return err
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	defer session.Close()

	session.Stdout = os.Stdout
	session.Stderr = os.Stderr
	session.Stdin = os.Stdin

	if command == "" {
		// Start interactive shell
		if err := session.Shell(); err != nil {
			return fmt.Errorf("failed to start shell: %w", err)
		}
		session.Wait()
	} else {
		// Run specific command
		if err := session.Run(command); err != nil {
			return fmt.Errorf("command failed: %w", err)
		}
	}

	return nil
}

// sshAgentCallback returns an SSH agent callback
func sshAgentCallback() func() ([]ssh.Signer, error) {
	// TODO: Implement proper SSH agent support
	// For now, return nil to indicate no agent available
	return nil
}

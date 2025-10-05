package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

// AppConfig represents the application configuration
type AppConfig struct {
	Theme     string            `yaml:"theme" mapstructure:"theme"`
	Keybinds  map[string]string `yaml:"keybinds" mapstructure:"keybinds"`
	Terminal  TerminalConfig    `yaml:"terminal" mapstructure:"terminal"`
	SSH       SSHConfig         `yaml:"ssh" mapstructure:"ssh"`
	SFTP      SFTPConfig        `yaml:"sftp" mapstructure:"sftp"`
	Telemetry bool              `yaml:"telemetry" mapstructure:"telemetry"`
}

// TerminalConfig represents terminal configuration
type TerminalConfig struct {
	External bool   `yaml:"external" mapstructure:"external"`
	Command  string `yaml:"command" mapstructure:"command"`
}

// SSHConfig represents SSH configuration
type SSHConfig struct {
	ForwardAgent   bool `yaml:"forward_agent" mapstructure:"forward_agent"`
	StrictHostKey  bool `yaml:"strict_hostkey" mapstructure:"strict_hostkey"`
	ConnectTimeout int  `yaml:"connect_timeout" mapstructure:"connect_timeout"`
}

// SFTPConfig represents SFTP configuration
type SFTPConfig struct {
	TransferConcurrency int `yaml:"transfer_concurrency" mapstructure:"transfer_concurrency"`
	BufferSize          int `yaml:"buffer_size" mapstructure:"buffer_size"`
}

var (
	configDir  string
	dataDir    string
	appConfig  *AppConfig
)

// Initialize sets up the configuration system
func Initialize() error {
	// Determine config and data directories
	configDir = getConfigDir()
	dataDir = getDataDir()

	// Create directories if they don't exist
	if err := createDirectories(); err != nil {
		return fmt.Errorf("failed to create directories: %w", err)
	}

	// Load configuration
	if err := loadConfig(); err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	return nil
}

// GetConfigDir returns the configuration directory
func GetConfigDir() string {
	return configDir
}

// GetDataDir returns the data directory
func GetDataDir() string {
	return dataDir
}

// GetConfig returns the current app configuration
func GetConfig() *AppConfig {
	return appConfig
}

// getConfigDir determines the configuration directory
func getConfigDir() string {
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		return filepath.Join(dir, "blackjack")
	}
	return filepath.Join(os.Getenv("HOME"), ".blackjack", "config")
}

// getDataDir determines the data directory
func getDataDir() string {
	if dir := os.Getenv("XDG_STATE_HOME"); dir != "" {
		return filepath.Join(dir, "blackjack")
	}
	return filepath.Join(os.Getenv("HOME"), ".blackjack")
}

// createDirectories creates the necessary directories
func createDirectories() error {
	dirs := []string{
		configDir,
		filepath.Join(dataDir, "inventory"),
		filepath.Join(dataDir, "keys"),
		filepath.Join(dataDir, "sessions"),
		filepath.Join(dataDir, "logs"),
		filepath.Join(dataDir, "exports"),
		filepath.Join(dataDir, "plugins"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
	}

	// Set special permissions for keys directory
	keysDir := filepath.Join(dataDir, "keys")
	if err := os.Chmod(keysDir, 0700); err != nil {
		return fmt.Errorf("failed to set permissions for keys directory: %w", err)
	}

	return nil
}

// loadConfig loads the application configuration
func loadConfig() error {
	viper.SetConfigName("app")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(configDir)

	// Set defaults
	setDefaults()

	// Read config file
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found, use defaults and create it
			if err := saveDefaultConfig(); err != nil {
				return fmt.Errorf("failed to save default config: %w", err)
			}
		} else {
			return fmt.Errorf("failed to read config file: %w", err)
		}
	}

	// Unmarshal config
	appConfig = &AppConfig{}
	if err := viper.Unmarshal(appConfig); err != nil {
		return fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return nil
}

// setDefaults sets the default configuration values
func setDefaults() {
	viper.SetDefault("theme", "matrix")
	viper.SetDefault("keybinds.connect", "c")
	viper.SetDefault("keybinds.sftp", "s")
	viper.SetDefault("keybinds.search", "/")
	viper.SetDefault("keybinds.new", "n")
	viper.SetDefault("keybinds.edit", "e")
	viper.SetDefault("keybinds.delete", "d")
	viper.SetDefault("keybinds.help", "?")
	viper.SetDefault("keybinds.settings", "F10")
	viper.SetDefault("keybinds.keymanager", "F2")
	viper.SetDefault("keybinds.importexport", "F8")
	viper.SetDefault("terminal.external", true)
	viper.SetDefault("terminal.command", "$TERMINAL -e")
	viper.SetDefault("ssh.forward_agent", true)
	viper.SetDefault("ssh.strict_hostkey", true)
	viper.SetDefault("ssh.connect_timeout", 30)
	viper.SetDefault("sftp.transfer_concurrency", 4)
	viper.SetDefault("sftp.buffer_size", 32768)
	viper.SetDefault("telemetry", false)
}

// saveDefaultConfig saves the default configuration to file
func saveDefaultConfig() error {
	config := &AppConfig{
		Theme: "matrix",
		Keybinds: map[string]string{
			"connect":      "c",
			"sftp":         "s",
			"search":       "/",
			"new":          "n",
			"edit":         "e",
			"delete":       "d",
			"help":         "?",
			"settings":     "F10",
			"keymanager":   "F2",
			"importexport": "F8",
		},
		Terminal: TerminalConfig{
			External: true,
			Command:  "$TERMINAL -e",
		},
		SSH: SSHConfig{
			ForwardAgent:   true,
			StrictHostKey:  true,
			ConnectTimeout: 30,
		},
		SFTP: SFTPConfig{
			TransferConcurrency: 4,
			BufferSize:         32768,
		},
		Telemetry: false,
	}

	return SaveConfig(config)
}

// SaveConfig saves the configuration to file
func SaveConfig(config *AppConfig) error {
	viper.Set("theme", config.Theme)
	viper.Set("keybinds", config.Keybinds)
	viper.Set("terminal", config.Terminal)
	viper.Set("ssh", config.SSH)
	viper.Set("sftp", config.SFTP)
	viper.Set("telemetry", config.Telemetry)

	configFile := filepath.Join(configDir, "app.yaml")
	return viper.WriteConfigAs(configFile)
}

// GetKeybind returns the keybind for a given action
func GetKeybind(action string) string {
	if appConfig == nil {
		return ""
	}
	return appConfig.Keybinds[action]
}

// GetTerminalCommand returns the terminal command with environment variable substitution
func GetTerminalCommand() string {
	if appConfig == nil {
		return "x-terminal-emulator -e"
	}
	
	cmd := appConfig.Terminal.Command
	cmd = strings.ReplaceAll(cmd, "$TERMINAL", os.Getenv("TERMINAL"))
	if cmd == "" || cmd == "$TERMINAL -e" {
		cmd = "x-terminal-emulator -e"
	}
	
	return cmd
}

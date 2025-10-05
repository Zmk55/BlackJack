package main

import (
	"fmt"
	"os"

	"github.com/blackjack/blackjack/internal/app"
	"github.com/blackjack/blackjack/internal/config"
	"github.com/spf13/cobra"
)

var Version = "dev"

func main() {
	var rootCmd = &cobra.Command{
		Use:   "blackjack",
		Short: "BlackJack - A hacker-style TUI client for SSH/SFTP",
		Long: `BlackJack is a terminal-first SSH/SFTP client with organization,
fast navigation, and fully in-terminal settings.

Features:
- Organized host management with groups and subgroups
- Fast navigation with vim-like keybinds
- Built-in SFTP browser
- Secure key management
- Import/export capabilities`,
	}

	// TUI command (default)
	var tuiCmd = &cobra.Command{
		Use:   "tui",
		Short: "Launch the TUI interface",
		Run: func(cmd *cobra.Command, args []string) {
			app := app.New()
			if err := app.Run(); err != nil {
				if err.Error() == "open /dev/tty: no such device or address" {
					fmt.Fprintf(os.Stderr, "Error: Terminal does not support TUI. Please run in a proper terminal.\n")
					fmt.Fprintf(os.Stderr, "Try: export TERM=xterm-256color && blackjack tui\n")
					fmt.Fprintf(os.Stderr, "Or run in a proper terminal emulator.\n")
				} else {
					fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				}
				os.Exit(1)
			}
		},
	}

	// Add host command
	var addHostCmd = &cobra.Command{
		Use:   "add host",
		Short: "Add a new host",
		Run: func(cmd *cobra.Command, args []string) {
			// TODO: Implement non-TUI host addition
			fmt.Println("Non-TUI host addition not yet implemented")
		},
	}

	// Import command
	var importCmd = &cobra.Command{
		Use:   "import <file.tar.gz>",
		Short: "Import configuration from backup",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			// TODO: Implement import
			fmt.Printf("Import from %s not yet implemented\n", args[0])
		},
	}

	// Export command
	var exportCmd = &cobra.Command{
		Use:   "export",
		Short: "Export configuration to backup",
		Run: func(cmd *cobra.Command, args []string) {
			// TODO: Implement export
			fmt.Println("Export not yet implemented")
		},
	}

	// Doctor command
	var doctorCmd = &cobra.Command{
		Use:   "doctor",
		Short: "Check system configuration and permissions",
		Run: func(cmd *cobra.Command, args []string) {
			// TODO: Implement doctor
			fmt.Println("Doctor command not yet implemented")
		},
	}

	// Version command
	var versionCmd = &cobra.Command{
		Use:   "version",
		Short: "Show version information",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("BlackJack version %s\n", Version)
		},
	}

	// Add subcommands
	rootCmd.AddCommand(tuiCmd)
	rootCmd.AddCommand(addHostCmd)
	rootCmd.AddCommand(importCmd)
	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(doctorCmd)
	rootCmd.AddCommand(versionCmd)

	// Initialize config only for TUI commands
	rootCmd.PersistentPreRun = func(cmd *cobra.Command, args []string) {
		// Skip config initialization for help and version commands
		if cmd.Name() == "help" || cmd.Name() == "version" {
			return
		}
		
		// Only initialize config for TUI command and only if terminal supports it
		if cmd.Name() == "tui" {
			// Check if we have a proper terminal first
			if os.Getenv("TERM") == "dumb" || os.Getenv("TERM") == "" {
				fmt.Fprintf(os.Stderr, "Error: Terminal does not support TUI. Please run in a proper terminal.\n")
				fmt.Fprintf(os.Stderr, "Try: export TERM=xterm-256color && blackjack tui\n")
				os.Exit(1)
			}
			
			if err := config.Initialize(); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to initialize config: %v\n", err)
				os.Exit(1)
			}
		}
	}

	// Don't set default command - let user choose

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

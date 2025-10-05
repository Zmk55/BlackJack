package app

import (
	"fmt"
	"log"

	"github.com/blackjack/blackjack/internal/config"
	"github.com/blackjack/blackjack/internal/data"
	"github.com/blackjack/blackjack/internal/ui"
	"github.com/rivo/tview"
)

// App represents the main application
type App struct {
	app        *tview.Application
	ui         *ui.UI
	hostRepo   *data.HostRepository
	groupRepo  *data.GroupRepository
	tagRepo    *data.TagRepository
}

// New creates a new application instance
func New() *App {
	// Get data directory
	dataDir := config.GetDataDir()

	// Initialize repositories
	hostRepo := data.NewHostRepository(dataDir)
	groupRepo := data.NewGroupRepository(dataDir)
	tagRepo := data.NewTagRepository(dataDir)

	// Load data
	if err := hostRepo.Load(); err != nil {
		log.Printf("Failed to load hosts: %v", err)
	}
	if err := groupRepo.Load(); err != nil {
		log.Printf("Failed to load groups: %v", err)
	}
	if err := tagRepo.Load(); err != nil {
		log.Printf("Failed to load tags: %v", err)
	}

	// Create TUI application
	app := tview.NewApplication()

	// Create UI
	ui := ui.New(app, hostRepo, groupRepo, tagRepo)

	return &App{
		app:        app,
		ui:         ui,
		hostRepo:   hostRepo,
		groupRepo:  groupRepo,
		tagRepo:    tagRepo,
	}
}

// Run starts the application
func (a *App) Run() error {
	// Set up the UI
	if err := a.ui.Setup(); err != nil {
		return fmt.Errorf("failed to setup UI: %w", err)
	}

	// Set the root primitive
	a.app.SetRoot(a.ui.GetRoot(), true)

	// Enable mouse support
	a.app.EnableMouse(true)

	// Run the application
	return a.app.Run()
}

// GetHostRepository returns the host repository
func (a *App) GetHostRepository() *data.HostRepository {
	return a.hostRepo
}

// GetGroupRepository returns the group repository
func (a *App) GetGroupRepository() *data.GroupRepository {
	return a.groupRepo
}

// GetTagRepository returns the tag repository
func (a *App) GetTagRepository() *data.TagRepository {
	return a.tagRepo
}

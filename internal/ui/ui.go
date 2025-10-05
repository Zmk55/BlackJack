package ui

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
	"sync"

	"github.com/blackjack/blackjack/internal/data"
	"github.com/blackjack/blackjack/pkg/models"
	"github.com/gdamore/tcell/v2"
	"github.com/rivo/tview"
)

// UI represents the main user interface
type UI struct {
	app        *tview.Application
	hostRepo   *data.HostRepository
	groupRepo  *data.GroupRepository
	tagRepo    *data.TagRepository
	
	// Main layout
	root       *tview.Flex
	sidebar    *tview.TreeView
	mainArea   *tview.Flex
	hostTable  *tview.Table
	footer     *tview.TextView
	
	// State
	currentGroup string
	searchQuery  string
	inModal      bool  // Track if we're in a modal/form
	
	// Session management
	sessionManager *SessionManager
	activeSession  string
	
	// Tab wrapper
	tabManager     *TabManager
	activeTab      string
	tabBar         *tview.TextView
}

// SSHSession represents an active SSH session
type SSHSession struct {
	ID        string
	Host      *models.Host
	Process   *exec.Cmd
	Status    string // "connected", "disconnected", "connecting", "error"
	LastSeen  time.Time
	Created   time.Time
	mu        sync.RWMutex
}

// SessionManager manages multiple SSH sessions
type SessionManager struct {
	sessions map[string]*SSHSession
	mu       sync.RWMutex
}

// Tab represents a tab in the wrapper
type Tab struct {
	ID       string
	Title    string
	Type     string // "main", "ssh"
	Host     *models.Host
	Content   tview.Primitive
	Active   bool
}

// TabManager manages multiple tabs
type TabManager struct {
	tabs map[string]*Tab
	mu   sync.RWMutex
}

// New creates a new UI instance
func New(app *tview.Application, hostRepo *data.HostRepository, groupRepo *data.GroupRepository, tagRepo *data.TagRepository) *UI {
	return &UI{
		app:        app,
		hostRepo:   hostRepo,
		groupRepo:  groupRepo,
		tagRepo:    tagRepo,
		currentGroup: "",
		searchQuery:  "",
		sessionManager: &SessionManager{
			sessions: make(map[string]*SSHSession),
		},
		activeSession: "",
		tabManager: &TabManager{
			tabs: make(map[string]*Tab),
		},
		activeTab: "main",
	}
}

// Setup initializes the UI components
func (u *UI) Setup() error {
	fmt.Println("Setting up UI...")
	
	// Create main layout
	u.root = tview.NewFlex()
	
	// Create sidebar
	u.sidebar = u.createSidebar()
	
	// Create main area
	u.mainArea = u.createMainArea()
	
	// Create footer
	u.footer = u.createFooter()
	
	// Create tab bar
	u.tabBar = u.createTabBar()
	
	// Set up layout
	u.root.SetDirection(tview.FlexRow)
	u.root.AddItem(u.tabBar, 1, 0, false)
	u.root.AddItem(u.createTopLayout(), 0, 1, false)
	u.root.AddItem(u.footer, 1, 0, false)
	
	// Set up keybindings
	u.setupKeybindings()
	
	// Refresh the table after everything is set up
	u.refreshHostTable()
	
	fmt.Println("UI setup complete")
	return nil
}

// GetRoot returns the root primitive
func (u *UI) GetRoot() tview.Primitive {
	return u.root
}

// createTopLayout creates the top layout with sidebar and main area
func (u *UI) createTopLayout() *tview.Flex {
	flex := tview.NewFlex()
	flex.SetDirection(tview.FlexColumn)
	flex.AddItem(u.sidebar, 0, 1, true)
	flex.AddItem(u.mainArea, 0, 3, false)
	return flex
}

// createSidebar creates the sidebar with groups tree
func (u *UI) createSidebar() *tview.TreeView {
	tree := tview.NewTreeView()
	tree.SetBorder(true)
	tree.SetTitle("Groups")
	tree.SetRoot(u.buildGroupTree())
	tree.SetCurrentNode(u.buildGroupTree())
	
	// Set up selection handler
	tree.SetSelectedFunc(func(node *tview.TreeNode) {
		reference := node.GetReference()
		if reference != nil {
			if groupID, ok := reference.(string); ok {
				u.currentGroup = groupID
				u.refreshHostTable()
			}
		}
	})
	
	return tree
}

// buildGroupTree builds the group tree structure
func (u *UI) buildGroupTree() *tview.TreeNode {
	root := tview.NewTreeNode("All Groups")
	root.SetReference("")
	
	// Get hierarchy
	hierarchy := u.groupRepo.GetHierarchy()
	u.addGroupNodes(root, hierarchy)
	
	return root
}

// addGroupNodes recursively adds group nodes to the tree
func (u *UI) addGroupNodes(parent *tview.TreeNode, nodes []data.GroupNode) {
	for _, node := range nodes {
		groupNode := tview.NewTreeNode(node.Group.Name)
		groupNode.SetReference(node.Group.ID)
		
		// Add children if any
		if len(node.Children) > 0 {
			u.addGroupNodes(groupNode, node.Children)
		}
		
		parent.AddChild(groupNode)
	}
}

// createMainArea creates the main area with host table
func (u *UI) createMainArea() *tview.Flex {
	flex := tview.NewFlex()
	flex.SetDirection(tview.FlexColumn)
	
	// Create host table
	u.hostTable = u.createHostTable()
	flex.AddItem(u.hostTable, 0, 1, true)
	
	return flex
}

// createHostTable creates the host table
func (u *UI) createHostTable() *tview.Table {
	table := tview.NewTable()
	table.SetBorder(true)
	table.SetTitle("Hosts")
	table.SetSelectable(true, false) // Allow row selection, not column selection
	
	// Set up headers
	headers := []string{"Name", "Address", "User", "Port", "Tags", "Last Seen"}
	for i, header := range headers {
		cell := tview.NewTableCell(header)
		cell.SetTextColor(tview.Styles.SecondaryTextColor)
		cell.SetSelectable(false)
		cell.SetAlign(tview.AlignLeft)
		table.SetCell(0, i, cell)
	}
	
	// Set table properties
	table.SetFixed(1, 0) // Fix header row
	table.SetBorders(true)
	
	// Load initial data
	u.refreshHostTable()
	
	return table
}

// refreshHostTable refreshes the host table with current data
func (u *UI) refreshHostTable() {
	// Clear existing rows (except header)
	if u.hostTable != nil {
		rowCount := u.hostTable.GetRowCount()
		for i := rowCount - 1; i > 0; i-- {
			u.hostTable.RemoveRow(i)
		}
	}
	
	// Get hosts based on current group and search
	var hosts []models.Host
	if u.currentGroup == "" {
		hosts = u.hostRepo.GetAll()
	} else {
		hosts = u.hostRepo.GetByGroup(u.currentGroup)
	}
	
	
	// Apply search filter
	if u.searchQuery != "" {
		hosts = u.hostRepo.Search(u.searchQuery)
	}
	
	// If no hosts, show empty table (no sample data)
	// Sample data was only for initial testing
	
	// Add host rows
	if u.hostTable != nil {
		for i, host := range hosts {
			row := i + 1
			
			// Name
			cell := tview.NewTableCell(host.Name)
			cell.SetAlign(tview.AlignLeft)
			cell.SetSelectable(true)
			u.hostTable.SetCell(row, 0, cell)
			
			// Address
			cell = tview.NewTableCell(host.Address)
			cell.SetAlign(tview.AlignLeft)
			cell.SetSelectable(true)
			u.hostTable.SetCell(row, 1, cell)
			
			// User
			cell = tview.NewTableCell(host.User)
			cell.SetAlign(tview.AlignLeft)
			cell.SetSelectable(true)
			u.hostTable.SetCell(row, 2, cell)
			
			// Port
			cell = tview.NewTableCell(fmt.Sprintf("%d", host.Port))
			cell.SetAlign(tview.AlignLeft)
			cell.SetSelectable(true)
			u.hostTable.SetCell(row, 3, cell)
			
			// Tags
			tags := ""
			if len(host.Tags) > 0 {
				tags = fmt.Sprintf("%v", host.Tags)
			}
			cell = tview.NewTableCell(tags)
			cell.SetAlign(tview.AlignLeft)
			cell.SetSelectable(true)
			u.hostTable.SetCell(row, 4, cell)
			
			// Last Seen
			lastSeen := "Never"
			if !host.LastSeen.IsZero() {
				lastSeen = host.LastSeen.Format("2006-01-02 15:04")
			}
			cell = tview.NewTableCell(lastSeen)
			cell.SetAlign(tview.AlignLeft)
			cell.SetSelectable(true)
			u.hostTable.SetCell(row, 5, cell)
		}
	}
}

// createFooter creates the footer with keybind hints
func (u *UI) createFooter() *tview.TextView {
	textView := tview.NewTextView()
	textView.SetBorder(false)
	textView.SetText("c: Connect | s: SFTP | n: New | e: Edit | d: Delete | /: Search | ?: Help | F7: Tabs | F9: Sessions | F10: Settings | q: Quit (confirm) | ↑↓: Navigate")
	textView.SetTextColor(tview.Styles.SecondaryTextColor)
	return textView
}

// setupKeybindings sets up the keybindings
func (u *UI) setupKeybindings() {
	u.app.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		// If we're in a modal/form, only handle escape and ctrl+c
		if u.inModal {
			switch event.Key() {
			case tcell.KeyCtrlC:
				u.app.Stop()
				return nil
			}
			// Let all other keys pass through to the form
			return event
		}
		
		// Handle special keys first
		switch event.Key() {
		case tcell.KeyCtrlC:
			u.showExitConfirmation()
			return nil
		case tcell.KeyRune:
			if event.Rune() == 'q' || event.Rune() == 'Q' {
				u.showExitConfirmation()
				return nil
			}
		case tcell.KeyF10:
			u.showSettings()
			return nil
		case tcell.KeyF2:
			u.showKeyManager()
			return nil
		case tcell.KeyF8:
			u.showSettings()
			return nil
		case tcell.KeyF9:
			u.showSessionManager()
			return nil
		case tcell.KeyF7:
			u.showTabManager()
			return nil
		case tcell.KeyTab:
			// Switch focus between sidebar and main area
			u.switchFocus()
			return nil
		case tcell.KeyEscape:
			// Clear search or exit modal
			u.clearSearch()
			return nil
		}
		
		// Handle character input
		switch event.Rune() {
		case 'c':
			u.connectToHost()
			return nil
		case 's':
			u.openSFTP()
			return nil
		case 'n':
			u.showNewHost()
			return nil
		case 'e':
			u.editHost()
			return nil
		case 'd':
			u.deleteHost()
			return nil
		case '/':
			u.showSearch()
			return nil
		case '?':
			u.showHelp()
			return nil
		case 'g':
			// Focus groups tree
			u.focusGroups()
			return nil
		case 'h':
			// Collapse group
			u.collapseGroup()
			return nil
		case 'l':
			// Expand group
			u.expandGroup()
			return nil
		}
		
		// Let other keys pass through for normal navigation
		return event
	})
}

// connectToHost connects to the selected host
func (u *UI) connectToHost() {
	// Get the selected host from the table
	row, _ := u.hostTable.GetSelection()
	if row <= 0 {
		// No host selected or header row selected
		return
	}
	
	// For now, we'll use the first host as an example
	// In a real implementation, you'd store host data with the table
	hosts := u.hostRepo.GetAll()
	if len(hosts) == 0 {
		// No hosts available
		return
	}
	
	// Use the first host (in a real implementation, you'd get the selected host)
	host := &hosts[0]
	
	// Create SSH client and connect
	u.showConnectionDialog(host)
}

// openSFTP opens SFTP browser for the selected host
func (u *UI) openSFTP() {
	// TODO: Implement SFTP browser
	fmt.Println("Open SFTP - not yet implemented")
}

// showNewHost shows the new host dialog
func (u *UI) showNewHost() {
	// Create a modal form for adding a new host
	form := tview.NewForm()
	form.SetBorder(true)
	form.SetTitle("Add New Host")
	form.SetTitleAlign(tview.AlignLeft)
	
	// Form fields
	var hostName, hostAddress, hostUser, hostPort, hostKeyID, hostPassword, hostNotes string
	var hostGroups []string
	var hostTags []string
	var authType string = "agent" // Default to SSH agent
	
	// Add form fields
	form.AddInputField("Name", "", 20, nil, func(text string) {
		hostName = text
	})
	
	form.AddInputField("Address", "", 20, nil, func(text string) {
		hostAddress = text
	})
	
	form.AddInputField("User", "", 20, nil, func(text string) {
		hostUser = text
	})
	
	form.AddInputField("Port", "22", 6, nil, func(text string) {
		hostPort = text
	})
	
	// Add authentication type selection
	form.AddDropDown("Auth Type", []string{"SSH Agent", "SSH Key", "Password"}, 0, func(option string, index int) {
		switch index {
		case 0:
			authType = "agent"
		case 1:
			authType = "key"
		case 2:
			authType = "password"
		}
	})
	
	form.AddInputField("Key ID", "", 20, nil, func(text string) {
		hostKeyID = text
	})
	
	form.AddPasswordField("Password", "", 20, '*', func(text string) {
		hostPassword = text
	})
	
	form.AddInputField("Groups (comma-separated)", "", 30, nil, func(text string) {
		// Parse comma-separated groups
		if text != "" {
			hostGroups = strings.Split(text, ",")
			for i, group := range hostGroups {
				hostGroups[i] = strings.TrimSpace(group)
			}
		}
	})
	
	form.AddInputField("Tags (comma-separated)", "", 30, nil, func(text string) {
		// Parse comma-separated tags
		if text != "" {
			hostTags = strings.Split(text, ",")
			for i, tag := range hostTags {
				hostTags[i] = strings.TrimSpace(tag)
			}
		}
	})
	
	form.AddTextArea("Notes", "", 30, 3, 0, func(text string) {
		hostNotes = text
	})
	
	// Add buttons
	form.AddButton("Save", func() {
		u.saveNewHost(hostName, hostAddress, hostUser, hostPort, authType, hostKeyID, hostPassword, hostGroups, hostTags, hostNotes)
		u.inModal = false
		u.app.SetRoot(u.root, true)
	})
	
	form.AddButton("Cancel", func() {
		u.inModal = false
		u.app.SetRoot(u.root, true)
	})
	
	// Set up keyboard shortcuts
	form.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.inModal = false
			u.app.SetRoot(u.root, true)
			return nil
		}
		return event
	})
	
	// Center the form
	form.SetRect(10, 5, 60, 20)
	
	// Set modal state and show the form
	u.inModal = true
	u.app.SetRoot(form, true)
}

// editHost shows the edit host dialog
func (u *UI) editHost() {
	// Get the selected host from the table
	row, _ := u.hostTable.GetSelection()
	if row <= 0 {
		// No host selected or header row selected
		return
	}
	
	// Get host data from the table (this is a simplified approach)
	// In a real implementation, you'd store the host data with the table
	// For now, we'll create a new host form
	u.showNewHost()
}

// deleteHost shows the delete host confirmation
func (u *UI) deleteHost() {
	// TODO: Implement delete host confirmation
	fmt.Println("Delete host - not yet implemented")
}

// showSearch shows the search dialog
func (u *UI) showSearch() {
	// Create a simple input dialog for search
	inputField := tview.NewInputField()
	inputField.SetLabel("Search: ")
	inputField.SetFieldWidth(30)
	inputField.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter {
			u.searchQuery = inputField.GetText()
			u.refreshHostTable()
			u.inModal = false
			u.app.SetRoot(u.root, true)
		} else if key == tcell.KeyEscape {
			u.inModal = false
			u.app.SetRoot(u.root, true)
		}
	})
	
	// Set initial value
	if u.searchQuery != "" {
		inputField.SetText(u.searchQuery)
	}
	
	// Create a modal
	modal := tview.NewModal()
	modal.SetText("Enter search term:")
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.app.SetRoot(u.root, true)
			return nil
		}
		return event
	})
	
	// Create a flex container with the input field
	flex := tview.NewFlex()
	flex.SetDirection(tview.FlexRow)
	flex.AddItem(tview.NewBox(), 0, 1, false)
	flex.AddItem(inputField, 1, 0, true)
	flex.AddItem(tview.NewBox(), 0, 1, false)
	
	// Center the input
	flex.SetRect(20, 10, 40, 3)
	
	// Set modal state and show the search input
	u.inModal = true
	u.app.SetRoot(flex, true)
}

// showHelp shows the help dialog
func (u *UI) showHelp() {
	// TODO: Implement help dialog
	fmt.Println("Help - not yet implemented")
}

// showSettings shows the settings dialog
func (u *UI) showSettings() {
	u.inModal = true
	
	// Create a custom settings menu using a table for better navigation
	table := tview.NewTable()
	table.SetBorder(true)
	table.SetTitle("Settings & Tools")
	table.SetTitleAlign(tview.AlignLeft)
	
	// Add menu options as table rows
	menuItems := []struct {
		text string
		action func()
	}{
		{"Import Configuration", func() { u.showImportDialog() }},
		{"Export Configuration", func() { u.showExportDialog() }},
		{"Key Manager", func() { u.showKeyManager() }},
		{"System Doctor", func() { u.showSystemDoctor() }},
		{"About", func() { u.showAbout() }},
		{"Back", func() { u.inModal = false; u.app.SetRoot(u.root, true) }},
	}
	
	// Populate table with menu items
	for i, item := range menuItems {
		cell := tview.NewTableCell(item.text)
		cell.SetAlign(tview.AlignLeft)
		cell.SetSelectable(true)
		table.SetCell(i, 0, cell)
	}
	
	// Set selection style
	table.SetSelectedStyle(tcell.StyleDefault.Background(tcell.ColorBlue).Foreground(tcell.ColorWhite))
	
	// Handle selection
	table.SetSelectedFunc(func(row, column int) {
		if row < len(menuItems) {
			menuItems[row].action()
		}
	})
	
	// Handle escape key and arrow keys
	table.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.inModal = false
			u.app.SetRoot(u.root, true)
			return nil
		case tcell.KeyEnter:
			// Handle selection
			row, _ := table.GetSelection()
			if row < len(menuItems) {
				menuItems[row].action()
			}
			return nil
		}
		return event
	})
	
	u.app.SetRoot(table, true)
}

// showExitConfirmation shows the exit confirmation dialog
func (u *UI) showExitConfirmation() {
	u.inModal = true
	
	modal := tview.NewModal()
	modal.SetText("Are you sure you want to exit BlackJack?\n\nAny unsaved changes will be lost.")
	modal.AddButtons([]string{"Yes, Exit", "No, Stay"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		u.inModal = false
		if buttonLabel == "Yes, Exit" {
			u.app.Stop()
		} else {
			// Return to main interface
			u.app.SetRoot(u.root, true)
		}
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.inModal = false
			u.app.SetRoot(u.root, true)
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(modal, true)
}

// showKeyManager shows the key manager dialog
func (u *UI) showKeyManager() {
	u.inModal = true
	
	modal := tview.NewModal()
	modal.SetText("Key Manager\n\nManage SSH keys and authentication.\n\nFeatures:\n• View SSH keys\n• Add new keys\n• Remove keys\n• Test key authentication")
	modal.AddButtons([]string{"Open Key Manager", "Back"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		if buttonLabel == "Back" {
			u.showSettings()
		} else {
			// TODO: Implement actual key manager
			fmt.Println("Key manager opened")
			u.showSettings()
		}
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.showSettings()
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(modal, true)
}

// showImportDialog shows the import dialog
func (u *UI) showImportDialog() {
	u.inModal = true
	
	modal := tview.NewModal()
	modal.SetText("Import Configuration\n\nImport hosts, groups, and settings from a backup file.\n\nSupported formats:\n• YAML files\n• JSON files\n• Tarball archives")
	modal.AddButtons([]string{"Select File", "Back"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		if buttonLabel == "Back" {
			u.showSettings()
		} else {
			// TODO: Implement file selection and import
			fmt.Println("Import file selection opened")
			u.showSettings()
		}
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.showSettings()
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(modal, true)
}

// showExportDialog shows the export dialog
func (u *UI) showExportDialog() {
	u.inModal = true
	
	modal := tview.NewModal()
	modal.SetText("Export Configuration\n\nExport all hosts, groups, and settings to a backup file.\n\nOptions:\n• Include SSH keys\n• Include settings\n• Compress archive")
	modal.AddButtons([]string{"Export Now", "Back"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		if buttonLabel == "Back" {
			u.showSettings()
		} else {
			// TODO: Implement export functionality
			fmt.Println("Export started")
			u.showSettings()
		}
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.showSettings()
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(modal, true)
}

// showSystemDoctor shows the system doctor dialog
func (u *UI) showSystemDoctor() {
	u.inModal = true
	
	modal := tview.NewModal()
	modal.SetText("System Doctor\n\nCheck system configuration and permissions.\n\nChecks:\n• SSH agent status\n• Key permissions\n• Terminal compatibility\n• File system access")
	modal.AddButtons([]string{"Run Diagnostics", "Back"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		if buttonLabel == "Back" {
			u.showSettings()
		} else {
			// TODO: Implement system diagnostics
			fmt.Println("System diagnostics started")
			u.showSettings()
		}
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.showSettings()
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(modal, true)
}

// showAbout shows the about dialog
func (u *UI) showAbout() {
	u.inModal = true
	
	modal := tview.NewModal()
	modal.SetText("BlackJack v1.0.0\n\nA terminal-first SSH/SFTP client with organization,\nfast navigation, and fully in-terminal settings.\n\nFeatures:\n• Host management with groups\n• Fast navigation with vim-like keybinds\n• Built-in SFTP browser\n• Secure key management\n• Import/export capabilities")
	modal.AddButtons([]string{"OK"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		u.showSettings()
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.showSettings()
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(modal, true)
}

// switchFocus switches focus between sidebar and main area
func (u *UI) switchFocus() {
	// TODO: Implement focus switching
	fmt.Println("Switch focus - not yet implemented")
}

// clearSearch clears the search query
func (u *UI) clearSearch() {
	u.searchQuery = ""
	u.refreshHostTable()
}

// focusGroups focuses the groups tree
func (u *UI) focusGroups() {
	// TODO: Implement group focus
	fmt.Println("Focus groups - not yet implemented")
}

// collapseGroup collapses the current group
func (u *UI) collapseGroup() {
	// TODO: Implement group collapse
	fmt.Println("Collapse group - not yet implemented")
}

// expandGroup expands the current group
func (u *UI) expandGroup() {
	// TODO: Implement group expand
	fmt.Println("Expand group - not yet implemented")
}

// showConnectionDialog shows a connection dialog with options
func (u *UI) showConnectionDialog(host *models.Host) {
	// Create a modal with connection options
	modal := tview.NewModal()
	modal.SetText(fmt.Sprintf("Connect to %s (%s)?", host.Name, host.Address))
	modal.AddButtons([]string{"SSH Shell", "SSH Command", "New Tab", "New Session", "Sessions", "Cancel"})
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		u.inModal = false
		u.app.SetRoot(u.root, true)
		
		switch buttonLabel {
		case "SSH Shell":
			u.connectSSHShell(host)
		case "SSH Command":
			u.showSSHCommandDialog(host)
		case "New Tab":
			u.createNewTab(host)
		case "New Session":
			u.createNewSession(host)
		case "Sessions":
			u.showSessionManager()
		case "Cancel":
			// Do nothing
		}
	})
	
	u.inModal = true
	u.app.SetRoot(modal, true)
}

// connectSSHShell connects to SSH shell
func (u *UI) connectSSHShell(host *models.Host) {
	// Update last seen
	u.hostRepo.UpdateLastSeen(host.ID)
	
	// Stop the TUI application first
	u.app.Stop()
	
	// Build SSH command with proper terminal handling
	sshCmd := fmt.Sprintf("ssh -t %s@%s", host.User, host.Address)
	if host.Port != 22 {
		sshCmd = fmt.Sprintf("ssh -t -p %d %s@%s", host.Port, host.User, host.Address)
	}
	
	// Execute SSH command in a new shell
	cmd := exec.Command("bash", "-c", sshCmd)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Run SSH command
	if err := cmd.Run(); err != nil {
		fmt.Printf("SSH connection failed: %v\n", err)
	}
	
	// After SSH session ends, exit gracefully
	fmt.Println("SSH session ended. BlackJack will exit.")
	fmt.Println("Run './blackjack tui' to restart the application.")
	time.Sleep(2 * time.Second) // Give user time to read the message
	
	// Exit the application
	os.Exit(0)
}

// restartApplication restarts the entire BlackJack application
func (u *UI) restartApplication() {
	// Clear the terminal and reset state
	fmt.Print("\033[2J\033[H")
	fmt.Print("\033[?25h") // Show cursor
	
	// Get the current executable path
	execPath, err := os.Executable()
	if err != nil {
		fmt.Printf("Failed to get executable path: %v\n", err)
		fmt.Println("Please run: ./blackjack tui")
		return
	}
	
	// Give the terminal a moment to settle
	time.Sleep(500 * time.Millisecond)
	
	// Launch a new instance of BlackJack with proper terminal handling
	cmd := exec.Command("bash", "-c", execPath+" tui")
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Start the new process
	if err := cmd.Start(); err != nil {
		fmt.Printf("Failed to restart BlackJack: %v\n", err)
		fmt.Println("Please run: ./blackjack tui")
		return
	}
	
	// Wait a moment for the new process to start
	time.Sleep(100 * time.Millisecond)
	
	// Exit the current process
	os.Exit(0)
}

// Session management methods

// NewSessionManager creates a new session manager
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*SSHSession),
	}
}

// AddSession adds a new session to the manager
func (sm *SessionManager) AddSession(session *SSHSession) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.sessions[session.ID] = session
}

// RemoveSession removes a session from the manager
func (sm *SessionManager) RemoveSession(sessionID string) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	delete(sm.sessions, sessionID)
}

// GetSession retrieves a session by ID
func (sm *SessionManager) GetSession(sessionID string) (*SSHSession, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	session, exists := sm.sessions[sessionID]
	return session, exists
}

// GetAllSessions returns all sessions
func (sm *SessionManager) GetAllSessions() []*SSHSession {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	sessions := make([]*SSHSession, 0, len(sm.sessions))
	for _, session := range sm.sessions {
		sessions = append(sessions, session)
	}
	return sessions
}

// GetActiveSessions returns only active sessions
func (sm *SessionManager) GetActiveSessions() []*SSHSession {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	sessions := make([]*SSHSession, 0)
	for _, session := range sm.sessions {
		if session.Status == "connected" || session.Status == "connecting" {
			sessions = append(sessions, session)
		}
	}
	return sessions
}

// createSSHSession creates a new SSH session
func (u *UI) createSSHSession(host *models.Host) (*SSHSession, error) {
	sessionID := fmt.Sprintf("%s-%d", host.Name, time.Now().Unix())
	
	session := &SSHSession{
		ID:       sessionID,
		Host:     host,
		Status:   "connecting",
		Created:  time.Now(),
		LastSeen: time.Now(),
	}
	
	// Add to session manager
	u.sessionManager.AddSession(session)
	
	return session, nil
}

// connectToSession connects to an existing session
func (u *UI) connectToSession(sessionID string) error {
	session, exists := u.sessionManager.GetSession(sessionID)
	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	
	// Update session status
	session.mu.Lock()
	session.Status = "connecting"
	session.LastSeen = time.Now()
	session.mu.Unlock()
	
	// Build SSH command
	sshCmd := fmt.Sprintf("ssh -t %s@%s", session.Host.User, session.Host.Address)
	if session.Host.Port != 22 {
		sshCmd = fmt.Sprintf("ssh -t -p %d %s@%s", session.Host.Port, session.Host.User, session.Host.Address)
	}
	
	// Execute SSH command
	cmd := exec.Command("bash", "-c", sshCmd)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Store the command in the session
	session.mu.Lock()
	session.Process = cmd
	session.Status = "connected"
	session.mu.Unlock()
	
	// Run SSH command
	if err := cmd.Run(); err != nil {
		session.mu.Lock()
		session.Status = "error"
		session.mu.Unlock()
		return fmt.Errorf("SSH connection failed: %v", err)
	}
	
	// Update session status after exit
	session.mu.Lock()
	session.Status = "disconnected"
	session.LastSeen = time.Now()
	session.mu.Unlock()
	
	return nil
}

// showSessionManager shows the session management interface
func (u *UI) showSessionManager() {
	u.inModal = true
	
	// Create session list table with full coverage
	table := tview.NewTable()
	table.SetBorder(true)
	table.SetTitle("Active SSH Sessions")
	table.SetTitleAlign(tview.AlignLeft)
	
	// Set table to cover the full screen to hide any corruption
	table.SetBorderPadding(1, 1, 1, 1)
	
	// Add headers
	table.SetCell(0, 0, tview.NewTableCell("Session ID").SetSelectable(false))
	table.SetCell(0, 1, tview.NewTableCell("Host").SetSelectable(false))
	table.SetCell(0, 2, tview.NewTableCell("Status").SetSelectable(false))
	table.SetCell(0, 3, tview.NewTableCell("Last Seen").SetSelectable(false))
	
	// Populate with sessions
	sessions := u.sessionManager.GetAllSessions()
	for i, session := range sessions {
		row := i + 1
		table.SetCell(row, 0, tview.NewTableCell(session.ID))
		table.SetCell(row, 1, tview.NewTableCell(session.Host.Name))
		table.SetCell(row, 2, tview.NewTableCell(session.Status))
		table.SetCell(row, 3, tview.NewTableCell(session.LastSeen.Format("15:04:05")))
	}
	
	// Handle selection
	table.SetSelectedFunc(func(row, column int) {
		if row > 0 && row <= len(sessions) {
			session := sessions[row-1]
			u.connectToSession(session.ID)
		}
	})
	
	// Handle escape key
	table.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.inModal = false
			u.app.SetRoot(u.root, true)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(table, true)
}

// createNewSession creates a new SSH session
func (u *UI) createNewSession(host *models.Host) {
	// Create new session
	session, err := u.createSSHSession(host)
	if err != nil {
		fmt.Printf("Failed to create session: %v\n", err)
		return
	}
	
	// Create a full-screen container to hide corruption
	container := tview.NewFlex()
	container.SetDirection(tview.FlexRow)
	
	// Add empty space to push modal to center
	container.AddItem(tview.NewBox(), 0, 1, false)
	
	// Create modal
	modal := tview.NewModal()
	modal.SetText(fmt.Sprintf("Session created: %s\n\nConnect to this session?", session.ID))
	modal.AddButtons([]string{"Connect", "View Sessions", "Cancel"})
	
	// Add modal to container
	container.AddItem(modal, 0, 1, true)
	container.AddItem(tview.NewBox(), 0, 1, false)
	
	modal.SetDoneFunc(func(buttonIndex int, buttonLabel string) {
		u.inModal = false
		u.app.SetRoot(u.root, true)
		
		switch buttonLabel {
		case "Connect":
			u.connectToSession(session.ID)
		case "View Sessions":
			u.showSessionManager()
		case "Cancel":
			// Do nothing
		}
	})
	
	// Add arrow key support for modal navigation
	modal.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.inModal = false
			u.app.SetRoot(u.root, true)
			return nil
		case tcell.KeyUp, tcell.KeyLeft:
			// Move to previous button
			modal.SetFocus(-1)
			return nil
		case tcell.KeyDown, tcell.KeyRight:
			// Move to next button
			modal.SetFocus(1)
			return nil
		}
		return event
	})
	
	u.inModal = true
	u.app.SetRoot(container, true)
}

// Tab management methods

// NewTabManager creates a new tab manager
func NewTabManager() *TabManager {
	return &TabManager{
		tabs: make(map[string]*Tab),
	}
}

// AddTab adds a new tab
func (tm *TabManager) AddTab(tab *Tab) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.tabs[tab.ID] = tab
}

// RemoveTab removes a tab
func (tm *TabManager) RemoveTab(tabID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	delete(tm.tabs, tabID)
}

// GetTab retrieves a tab by ID
func (tm *TabManager) GetTab(tabID string) (*Tab, bool) {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	tab, exists := tm.tabs[tabID]
	return tab, exists
}

// GetAllTabs returns all tabs
func (tm *TabManager) GetAllTabs() []*Tab {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	tabs := make([]*Tab, 0, len(tm.tabs))
	for _, tab := range tm.tabs {
		tabs = append(tabs, tab)
	}
	return tabs
}

// SetActiveTab sets the active tab
func (tm *TabManager) SetActiveTab(tabID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	
	// Deactivate all tabs
	for _, tab := range tm.tabs {
		tab.Active = false
	}
	
	// Activate the specified tab
	if tab, exists := tm.tabs[tabID]; exists {
		tab.Active = true
	}
}

// createTabBar creates the tab bar
func (u *UI) createTabBar() *tview.TextView {
	textView := tview.NewTextView()
	textView.SetBorder(false)
	textView.SetTextAlign(tview.AlignLeft)
	textView.SetTextColor(tview.Styles.PrimaryTextColor)
	
	// Update tab bar content
	u.updateTabBar()
	
	return textView
}

// updateTabBar updates the tab bar content
func (u *UI) updateTabBar() {
	if u.tabBar == nil {
		return
	}
	
	tabs := u.tabManager.GetAllTabs()
	tabText := ""
	
	for i, tab := range tabs {
		if i > 0 {
			tabText += " | "
		}
		
		if tab.Active {
			tabText += fmt.Sprintf("[%s]", tab.Title)
		} else {
			tabText += tab.Title
		}
	}
	
	// Add new tab button
	tabText += " | [+]"
	
	u.tabBar.SetText(tabText)
}

// createNewTab creates a new tab for SSH session
func (u *UI) createNewTab(host *models.Host) *Tab {
	tabID := fmt.Sprintf("ssh-%s-%d", host.Name, time.Now().Unix())
	
	tab := &Tab{
		ID:     tabID,
		Title:  fmt.Sprintf("SSH: %s", host.Name),
		Type:   "ssh",
		Host:   host,
		Active: false,
	}
	
	u.tabManager.AddTab(tab)
	return tab
}

// switchToTab switches to a specific tab
func (u *UI) switchToTab(tabID string) {
	tab, exists := u.tabManager.GetTab(tabID)
	if !exists {
		return
	}
	
	// Set active tab
	u.tabManager.SetActiveTab(tabID)
	u.activeTab = tabID
	
	// Update tab bar
	u.updateTabBar()
	
	// Switch content based on tab type
	switch tab.Type {
	case "main":
		u.app.SetRoot(u.root, true)
	case "ssh":
		// For SSH tabs, we'll need to implement SSH session display
		// For now, just show the main interface
		u.app.SetRoot(u.root, true)
	}
}

// showTabManager shows the tab management interface
func (u *UI) showTabManager() {
	u.inModal = true
	
	// Create tab list table
	table := tview.NewTable()
	table.SetBorder(true)
	table.SetTitle("Active Tabs")
	table.SetTitleAlign(tview.AlignLeft)
	
	// Add headers
	table.SetCell(0, 0, tview.NewTableCell("Tab ID").SetSelectable(false))
	table.SetCell(0, 1, tview.NewTableCell("Title").SetSelectable(false))
	table.SetCell(0, 2, tview.NewTableCell("Type").SetSelectable(false))
	table.SetCell(0, 3, tview.NewTableCell("Status").SetSelectable(false))
	
	// Populate with tabs
	tabs := u.tabManager.GetAllTabs()
	for i, tab := range tabs {
		row := i + 1
		status := "Inactive"
		if tab.Active {
			status = "Active"
		}
		
		table.SetCell(row, 0, tview.NewTableCell(tab.ID))
		table.SetCell(row, 1, tview.NewTableCell(tab.Title))
		table.SetCell(row, 2, tview.NewTableCell(tab.Type))
		table.SetCell(row, 3, tview.NewTableCell(status))
	}
	
	// Handle selection
	table.SetSelectedFunc(func(row, column int) {
		if row > 0 && row <= len(tabs) {
			tab := tabs[row-1]
			u.switchToTab(tab.ID)
			u.inModal = false
		}
	})
	
	// Handle escape key
	table.SetInputCapture(func(event *tcell.EventKey) *tcell.EventKey {
		switch event.Key() {
		case tcell.KeyEscape:
			u.inModal = false
			u.app.SetRoot(u.root, true)
			return nil
		}
		return event
	})
	
	u.app.SetRoot(table, true)
}

// showSSHCommandDialog shows a dialog to enter SSH command
func (u *UI) showSSHCommandDialog(host *models.Host) {
	// Create input dialog for SSH command
	inputField := tview.NewInputField()
	inputField.SetLabel("SSH Command: ")
	inputField.SetFieldWidth(40)
	inputField.SetDoneFunc(func(key tcell.Key) {
		if key == tcell.KeyEnter {
			command := inputField.GetText()
			u.runSSHCommand(host, command)
			u.inModal = false
			u.app.SetRoot(u.root, true)
		} else if key == tcell.KeyEscape {
			u.inModal = false
			u.app.SetRoot(u.root, true)
		}
	})
	
	// Create a flex container with the input field
	flex := tview.NewFlex()
	flex.SetDirection(tview.FlexRow)
	flex.AddItem(tview.NewBox(), 0, 1, false)
	flex.AddItem(inputField, 1, 0, true)
	flex.AddItem(tview.NewBox(), 0, 1, false)
	
	// Center the input
	flex.SetRect(15, 10, 50, 3)
	
	// Show the command input
	u.inModal = true
	u.app.SetRoot(flex, true)
}

// runSSHCommand runs an SSH command
func (u *UI) runSSHCommand(host *models.Host, command string) {
	// Update last seen
	u.hostRepo.UpdateLastSeen(host.ID)
	
	// Stop the TUI application first
	u.app.Stop()
	
	// Build SSH command with proper terminal handling
	sshCmd := fmt.Sprintf("ssh -t %s@%s '%s'", host.User, host.Address, command)
	if host.Port != 22 {
		sshCmd = fmt.Sprintf("ssh -t -p %d %s@%s '%s'", host.Port, host.User, host.Address, command)
	}
	
	// Execute SSH command in a new shell
	cmd := exec.Command("bash", "-c", sshCmd)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	// Run SSH command
	if err := cmd.Run(); err != nil {
		fmt.Printf("SSH command failed: %v\n", err)
	}
	
	// After SSH command ends, exit gracefully
	fmt.Println("SSH command completed. BlackJack will exit.")
	fmt.Println("Run './blackjack tui' to restart the application.")
	time.Sleep(2 * time.Second) // Give user time to read the message
	
	// Exit the application
	os.Exit(0)
}

// saveNewHost saves a new host to the repository
func (u *UI) saveNewHost(name, address, user, portStr, authType, keyID, password string, groups, tags []string, notes string) {
	// Validate required fields
	if name == "" || address == "" || user == "" {
		// TODO: Show error message
		return
	}
	
	// Parse port
	port := 22
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			port = p
		}
	}
	
	// Create new host
	host := models.NewHost(
		fmt.Sprintf("%s-%d", strings.ToLower(strings.ReplaceAll(name, " ", "-")), time.Now().Unix()),
		name,
		address,
		user,
	)
	
	host.Port = port
	host.Notes = notes
	host.Groups = groups
	host.Tags = tags
	
	// Set authentication based on type
	switch authType {
	case "key":
		host.Auth.Type = models.AuthTypeKey
		host.Auth.KeyID = keyID
	case "password":
		host.Auth.Type = models.AuthTypePassword
		host.Auth.Password = password // Note: In production, this should be encrypted
	case "agent":
		fallthrough
	default:
		host.Auth.Type = models.AuthTypeAgent
	}
	
	// Save to repository
	if err := u.hostRepo.Add(host); err != nil {
		// TODO: Show error message
		fmt.Printf("Error adding host: %v\n", err)
		return
	}
	
	// Refresh the table
	u.refreshHostTable()
}

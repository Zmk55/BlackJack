package data

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/blackjack/blackjack/pkg/models"
	"gopkg.in/yaml.v3"
)

// GroupRepository handles group data operations
type GroupRepository struct {
	filePath string
	groups   []models.Group
}

// NewGroupRepository creates a new group repository
func NewGroupRepository(dataDir string) *GroupRepository {
	return &GroupRepository{
		filePath: filepath.Join(dataDir, "inventory", "groups.yaml"),
		groups:   []models.Group{},
	}
}

// Load loads groups from the YAML file
func (r *GroupRepository) Load() error {
	// Check if file exists
	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		// Create empty file
		return r.Save()
	}

	// Read file
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return fmt.Errorf("failed to read groups file: %w", err)
	}

	// Parse YAML
	var groupsFile models.GroupsFile
	if err := yaml.Unmarshal(data, &groupsFile); err != nil {
		return fmt.Errorf("failed to parse groups file: %w", err)
	}

	r.groups = groupsFile.Groups
	return nil
}

// Save saves groups to the YAML file
func (r *GroupRepository) Save() error {
	groupsFile := models.GroupsFile{
		Version: 1,
		Groups:  r.groups,
	}

	data, err := yaml.Marshal(groupsFile)
	if err != nil {
		return fmt.Errorf("failed to marshal groups: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(r.filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Write file
	if err := os.WriteFile(r.filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write groups file: %w", err)
	}

	return nil
}

// GetAll returns all groups
func (r *GroupRepository) GetAll() []models.Group {
	return r.groups
}

// GetByID returns a group by ID
func (r *GroupRepository) GetByID(id string) (*models.Group, error) {
	for i, group := range r.groups {
		if group.ID == id {
			return &r.groups[i], nil
		}
	}
	return nil, fmt.Errorf("group not found: %s", id)
}

// Add adds a new group
func (r *GroupRepository) Add(group *models.Group) error {
	// Validate group
	if err := group.Validate(); err != nil {
		return fmt.Errorf("invalid group: %w", err)
	}

	// Check if group already exists
	if _, err := r.GetByID(group.ID); err == nil {
		return fmt.Errorf("group already exists: %s", group.ID)
	}

	// Add group
	r.groups = append(r.groups, *group)
	return r.Save()
}

// Update updates an existing group
func (r *GroupRepository) Update(group *models.Group) error {
	// Validate group
	if err := group.Validate(); err != nil {
		return fmt.Errorf("invalid group: %w", err)
	}

	// Find and update group
	for i, g := range r.groups {
		if g.ID == group.ID {
			group.Updated = time.Now()
			r.groups[i] = *group
			return r.Save()
		}
	}

	return fmt.Errorf("group not found: %s", group.ID)
}

// Delete deletes a group by ID
func (r *GroupRepository) Delete(id string) error {
	// Check if group has children
	children := r.GetChildren(id)
	if len(children) > 0 {
		return fmt.Errorf("cannot delete group with children: %s", id)
	}

	for i, group := range r.groups {
		if group.ID == id {
			r.groups = append(r.groups[:i], r.groups[i+1:]...)
			return r.Save()
		}
	}
	return fmt.Errorf("group not found: %s", id)
}

// GetRootGroups returns all root groups (no parent)
func (r *GroupRepository) GetRootGroups() []models.Group {
	var result []models.Group
	for _, group := range r.groups {
		if group.IsRoot() {
			result = append(result, group)
		}
	}
	return result
}

// GetChildren returns all child groups of a parent
func (r *GroupRepository) GetChildren(parentID string) []models.Group {
	var result []models.Group
	for _, group := range r.groups {
		if group.Parent != nil && *group.Parent == parentID {
			result = append(result, group)
		}
	}
	return result
}

// GetHierarchy returns groups organized in a hierarchy
func (r *GroupRepository) GetHierarchy() []GroupNode {
	rootGroups := r.GetRootGroups()
	var result []GroupNode

	for _, root := range rootGroups {
		node := GroupNode{
			Group:  root,
			Level:  0,
			Parent: nil,
		}
		node.Children = r.buildChildren(&node)
		result = append(result, node)
	}

	return result
}

// GroupNode represents a group in the hierarchy
type GroupNode struct {
	Group    models.Group
	Level    int
	Parent   *GroupNode
	Children []GroupNode
}

// buildChildren recursively builds the children of a group node
func (r *GroupRepository) buildChildren(parent *GroupNode) []GroupNode {
	children := r.GetChildren(parent.Group.ID)
	var result []GroupNode

	for _, child := range children {
		node := GroupNode{
			Group:  child,
			Level:  parent.Level + 1,
			Parent: parent,
		}
		node.Children = r.buildChildren(&node)
		result = append(result, node)
	}

	return result
}

// GetSortedByName returns groups sorted by name
func (r *GroupRepository) GetSortedByName() []models.Group {
	groups := make([]models.Group, len(r.groups))
	copy(groups, r.groups)

	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Name < groups[j].Name
	})

	return groups
}

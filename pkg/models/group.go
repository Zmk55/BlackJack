package models

import (
	"fmt"
	"time"
)

// Group represents a host group
type Group struct {
	ID          string    `yaml:"id" json:"id"`
	Name        string    `yaml:"name" json:"name"`
	Parent      *string   `yaml:"parent,omitempty" json:"parent,omitempty"`
	Description string    `yaml:"description,omitempty" json:"description,omitempty"`
	Created     time.Time `yaml:"created" json:"created"`
	Updated     time.Time `yaml:"updated" json:"updated"`
}

// GroupsFile represents the groups.yaml file structure
type GroupsFile struct {
	Version int     `yaml:"version" json:"version"`
	Groups  []Group `yaml:"groups" json:"groups"`
}

// NewGroup creates a new group with default values
func NewGroup(id, name string) *Group {
	now := time.Now()
	return &Group{
		ID:      id,
		Name:    name,
		Created: now,
		Updated: now,
	}
}

// NewSubGroup creates a new subgroup with a parent
func NewSubGroup(id, name, parentID string) *Group {
	now := time.Now()
	return &Group{
		ID:      id,
		Name:    name,
		Parent:  &parentID,
		Created: now,
		Updated: now,
	}
}

// Validate checks if the group configuration is valid
func (g *Group) Validate() error {
	if g.ID == "" {
		return fmt.Errorf("group ID cannot be empty")
	}
	if g.Name == "" {
		return fmt.Errorf("group name cannot be empty")
	}
	return nil
}

// IsRoot returns true if this is a root group (no parent)
func (g *Group) IsRoot() bool {
	return g.Parent == nil
}

// SetParent sets the parent group
func (g *Group) SetParent(parentID string) {
	g.Parent = &parentID
	g.Updated = time.Now()
}

// RemoveParent removes the parent group (makes it a root group)
func (g *Group) RemoveParent() {
	g.Parent = nil
	g.Updated = time.Now()
}

// UpdateDescription updates the group description
func (g *Group) UpdateDescription(description string) {
	g.Description = description
	g.Updated = time.Now()
}

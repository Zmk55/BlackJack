package models

import (
	"fmt"
	"time"
)

// Tag represents a host tag
type Tag struct {
	ID          string    `yaml:"id" json:"id"`
	Name        string    `yaml:"name" json:"name"`
	Color       string    `yaml:"color,omitempty" json:"color,omitempty"`
	Description string    `yaml:"description,omitempty" json:"description,omitempty"`
	Created     time.Time `yaml:"created" json:"created"`
	Updated     time.Time `yaml:"updated" json:"updated"`
}

// TagsFile represents the tags.yaml file structure
type TagsFile struct {
	Version int    `yaml:"version" json:"version"`
	Tags    []Tag  `yaml:"tags" json:"tags"`
}

// NewTag creates a new tag with default values
func NewTag(id, name string) *Tag {
	now := time.Now()
	return &Tag{
		ID:      id,
		Name:    name,
		Created: now,
		Updated: now,
	}
}

// Validate checks if the tag configuration is valid
func (t *Tag) Validate() error {
	if t.ID == "" {
		return fmt.Errorf("tag ID cannot be empty")
	}
	if t.Name == "" {
		return fmt.Errorf("tag name cannot be empty")
	}
	return nil
}

// SetColor sets the tag color
func (t *Tag) SetColor(color string) {
	t.Color = color
	t.Updated = time.Now()
}

// UpdateDescription updates the tag description
func (t *Tag) UpdateDescription(description string) {
	t.Description = description
	t.Updated = time.Now()
}

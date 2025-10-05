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

// TagRepository handles tag data operations
type TagRepository struct {
	filePath string
	tags     []models.Tag
}

// NewTagRepository creates a new tag repository
func NewTagRepository(dataDir string) *TagRepository {
	return &TagRepository{
		filePath: filepath.Join(dataDir, "inventory", "tags.yaml"),
		tags:     []models.Tag{},
	}
}

// Load loads tags from the YAML file
func (r *TagRepository) Load() error {
	// Check if file exists
	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		// Create empty file
		return r.Save()
	}

	// Read file
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return fmt.Errorf("failed to read tags file: %w", err)
	}

	// Parse YAML
	var tagsFile models.TagsFile
	if err := yaml.Unmarshal(data, &tagsFile); err != nil {
		return fmt.Errorf("failed to parse tags file: %w", err)
	}

	r.tags = tagsFile.Tags
	return nil
}

// Save saves tags to the YAML file
func (r *TagRepository) Save() error {
	tagsFile := models.TagsFile{
		Version: 1,
		Tags:    r.tags,
	}

	data, err := yaml.Marshal(tagsFile)
	if err != nil {
		return fmt.Errorf("failed to marshal tags: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(r.filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Write file
	if err := os.WriteFile(r.filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write tags file: %w", err)
	}

	return nil
}

// GetAll returns all tags
func (r *TagRepository) GetAll() []models.Tag {
	return r.tags
}

// GetByID returns a tag by ID
func (r *TagRepository) GetByID(id string) (*models.Tag, error) {
	for i, tag := range r.tags {
		if tag.ID == id {
			return &r.tags[i], nil
		}
	}
	return nil, fmt.Errorf("tag not found: %s", id)
}

// Add adds a new tag
func (r *TagRepository) Add(tag *models.Tag) error {
	// Validate tag
	if err := tag.Validate(); err != nil {
		return fmt.Errorf("invalid tag: %w", err)
	}

	// Check if tag already exists
	if _, err := r.GetByID(tag.ID); err == nil {
		return fmt.Errorf("tag already exists: %s", tag.ID)
	}

	// Add tag
	r.tags = append(r.tags, *tag)
	return r.Save()
}

// Update updates an existing tag
func (r *TagRepository) Update(tag *models.Tag) error {
	// Validate tag
	if err := tag.Validate(); err != nil {
		return fmt.Errorf("invalid tag: %w", err)
	}

	// Find and update tag
	for i, t := range r.tags {
		if t.ID == tag.ID {
			tag.Updated = time.Now()
			r.tags[i] = *tag
			return r.Save()
		}
	}

	return fmt.Errorf("tag not found: %s", tag.ID)
}

// Delete deletes a tag by ID
func (r *TagRepository) Delete(id string) error {
	for i, tag := range r.tags {
		if tag.ID == id {
			r.tags = append(r.tags[:i], r.tags[i+1:]...)
			return r.Save()
		}
	}
	return fmt.Errorf("tag not found: %s", id)
}

// GetSortedByName returns tags sorted by name
func (r *TagRepository) GetSortedByName() []models.Tag {
	tags := make([]models.Tag, len(r.tags))
	copy(tags, r.tags)

	sort.Slice(tags, func(i, j int) bool {
		return tags[i].Name < tags[j].Name
	})

	return tags
}

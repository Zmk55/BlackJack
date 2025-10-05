package data

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/blackjack/blackjack/pkg/models"
	"gopkg.in/yaml.v3"
)

// HostRepository handles host data operations
type HostRepository struct {
	filePath string
	hosts    []models.Host
}

// NewHostRepository creates a new host repository
func NewHostRepository(dataDir string) *HostRepository {
	return &HostRepository{
		filePath: filepath.Join(dataDir, "inventory", "hosts.yaml"),
		hosts:    []models.Host{},
	}
}

// Load loads hosts from the YAML file
func (r *HostRepository) Load() error {
	// Check if file exists
	if _, err := os.Stat(r.filePath); os.IsNotExist(err) {
		// Create empty file
		return r.Save()
	}

	// Read file
	data, err := os.ReadFile(r.filePath)
	if err != nil {
		return fmt.Errorf("failed to read hosts file: %w", err)
	}

	// Parse YAML
	var hostsFile models.HostsFile
	if err := yaml.Unmarshal(data, &hostsFile); err != nil {
		return fmt.Errorf("failed to parse hosts file: %w", err)
	}

	r.hosts = hostsFile.Hosts
	return nil
}

// Save saves hosts to the YAML file
func (r *HostRepository) Save() error {
	hostsFile := models.HostsFile{
		Version: 1,
		Hosts:   r.hosts,
	}

	data, err := yaml.Marshal(hostsFile)
	if err != nil {
		return fmt.Errorf("failed to marshal hosts: %w", err)
	}

	// Ensure directory exists
	if err := os.MkdirAll(filepath.Dir(r.filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// Write file
	if err := os.WriteFile(r.filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write hosts file: %w", err)
	}

	return nil
}

// GetAll returns all hosts
func (r *HostRepository) GetAll() []models.Host {
	return r.hosts
}

// GetByID returns a host by ID
func (r *HostRepository) GetByID(id string) (*models.Host, error) {
	for i, host := range r.hosts {
		if host.ID == id {
			return &r.hosts[i], nil
		}
	}
	return nil, fmt.Errorf("host not found: %s", id)
}

// Add adds a new host
func (r *HostRepository) Add(host *models.Host) error {
	// Validate host
	if err := host.Validate(); err != nil {
		return fmt.Errorf("invalid host: %w", err)
	}

	// Check if host already exists
	if _, err := r.GetByID(host.ID); err == nil {
		return fmt.Errorf("host already exists: %s", host.ID)
	}

	// Add host
	r.hosts = append(r.hosts, *host)
	return r.Save()
}

// Update updates an existing host
func (r *HostRepository) Update(host *models.Host) error {
	// Validate host
	if err := host.Validate(); err != nil {
		return fmt.Errorf("invalid host: %w", err)
	}

	// Find and update host
	for i, h := range r.hosts {
		if h.ID == host.ID {
			host.Updated = time.Now()
			r.hosts[i] = *host
			return r.Save()
		}
	}

	return fmt.Errorf("host not found: %s", host.ID)
}

// Delete deletes a host by ID
func (r *HostRepository) Delete(id string) error {
	for i, host := range r.hosts {
		if host.ID == id {
			r.hosts = append(r.hosts[:i], r.hosts[i+1:]...)
			return r.Save()
		}
	}
	return fmt.Errorf("host not found: %s", id)
}

// GetByGroup returns hosts in a specific group
func (r *HostRepository) GetByGroup(groupID string) []models.Host {
	var result []models.Host
	for _, host := range r.hosts {
		for _, g := range host.Groups {
			if g == groupID {
				result = append(result, host)
				break
			}
		}
	}
	return result
}

// GetByTag returns hosts with a specific tag
func (r *HostRepository) GetByTag(tag string) []models.Host {
	var result []models.Host
	for _, host := range r.hosts {
		for _, t := range host.Tags {
			if t == tag {
				result = append(result, host)
				break
			}
		}
	}
	return result
}

// Search performs a fuzzy search on hosts
func (r *HostRepository) Search(query string) []models.Host {
	if query == "" {
		return r.hosts
	}

	var result []models.Host
	query = strings.ToLower(query)

	for _, host := range r.hosts {
		// Search in name, address, user, and notes
		if strings.Contains(strings.ToLower(host.Name), query) ||
			strings.Contains(strings.ToLower(host.Address), query) ||
			strings.Contains(strings.ToLower(host.User), query) ||
			strings.Contains(strings.ToLower(host.Notes), query) {
			result = append(result, host)
		}
	}

	return result
}

// UpdateLastSeen updates the last seen timestamp for a host
func (r *HostRepository) UpdateLastSeen(id string) error {
	host, err := r.GetByID(id)
	if err != nil {
		return err
	}

	host.UpdateLastSeen()
	return r.Update(host)
}

// GetSortedByLastSeen returns hosts sorted by last seen (most recent first)
func (r *HostRepository) GetSortedByLastSeen() []models.Host {
	hosts := make([]models.Host, len(r.hosts))
	copy(hosts, r.hosts)

	sort.Slice(hosts, func(i, j int) bool {
		return hosts[i].LastSeen.After(hosts[j].LastSeen)
	})

	return hosts
}

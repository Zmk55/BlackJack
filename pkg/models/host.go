package models

import (
	"fmt"
	"time"
)

// AuthType represents the authentication method
type AuthType string

const (
	AuthTypeKey      AuthType = "key"
	AuthTypeAgent    AuthType = "agent"
	AuthTypePassword AuthType = "password"
)

// Host represents a remote host configuration
type Host struct {
	ID       string    `yaml:"id" json:"id"`
	Name     string    `yaml:"name" json:"name"`
	Address  string    `yaml:"address" json:"address"`
	Port     int       `yaml:"port" json:"port"`
	User     string    `yaml:"user" json:"user"`
	Auth     Auth      `yaml:"auth" json:"auth"`
	Groups   []string  `yaml:"groups" json:"groups"`
	Tags     []string  `yaml:"tags" json:"tags"`
	Notes    string    `yaml:"notes" json:"notes"`
	LastSeen time.Time `yaml:"last_seen,omitempty" json:"last_seen,omitempty"`
	Created  time.Time `yaml:"created" json:"created"`
	Updated  time.Time `yaml:"updated" json:"updated"`
}

// Auth represents authentication configuration
type Auth struct {
	Type     AuthType `yaml:"type" json:"type"`
	KeyID    string   `yaml:"key_id,omitempty" json:"key_id,omitempty"`
	Password string   `yaml:"password,omitempty" json:"password,omitempty"` // Never stored in YAML
}

// HostsFile represents the hosts.yaml file structure
type HostsFile struct {
	Version int    `yaml:"version" json:"version"`
	Hosts   []Host `yaml:"hosts" json:"hosts"`
}

// NewHost creates a new host with default values
func NewHost(id, name, address, user string) *Host {
	now := time.Now()
	return &Host{
		ID:      id,
		Name:    name,
		Address: address,
		Port:    22,
		User:    user,
		Auth: Auth{
			Type: AuthTypeAgent,
		},
		Groups:  []string{},
		Tags:    []string{},
		Created: now,
		Updated: now,
	}
}

// Validate checks if the host configuration is valid
func (h *Host) Validate() error {
	if h.ID == "" {
		return fmt.Errorf("host ID cannot be empty")
	}
	if h.Name == "" {
		return fmt.Errorf("host name cannot be empty")
	}
	if h.Address == "" {
		return fmt.Errorf("host address cannot be empty")
	}
	if h.User == "" {
		return fmt.Errorf("host user cannot be empty")
	}
	if h.Port <= 0 || h.Port > 65535 {
		return fmt.Errorf("host port must be between 1 and 65535")
	}
	return nil
}

// UpdateLastSeen updates the last seen timestamp
func (h *Host) UpdateLastSeen() {
	h.LastSeen = time.Now()
	h.Updated = time.Now()
}

// AddGroup adds a group to the host
func (h *Host) AddGroup(groupID string) {
	for _, g := range h.Groups {
		if g == groupID {
			return // Already exists
		}
	}
	h.Groups = append(h.Groups, groupID)
	h.Updated = time.Now()
}

// RemoveGroup removes a group from the host
func (h *Host) RemoveGroup(groupID string) {
	for i, g := range h.Groups {
		if g == groupID {
			h.Groups = append(h.Groups[:i], h.Groups[i+1:]...)
			h.Updated = time.Now()
			return
		}
	}
}

// AddTag adds a tag to the host
func (h *Host) AddTag(tag string) {
	for _, t := range h.Tags {
		if t == tag {
			return // Already exists
		}
	}
	h.Tags = append(h.Tags, tag)
	h.Updated = time.Now()
}

// RemoveTag removes a tag from the host
func (h *Host) RemoveTag(tag string) {
	for i, t := range h.Tags {
		if t == tag {
			h.Tags = append(h.Tags[:i], h.Tags[i+1:]...)
			h.Updated = time.Now()
			return
		}
	}
}

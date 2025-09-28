import { describe, it, expect } from 'vitest';
import type { Vault, Host, Group } from './models';

// Mock merge function for testing
function mergeVaults(current: Vault, imported: Vault): Vault {
  const merged: Vault = {
    version: 1,
    groups: [...current.groups],
    hosts: [...current.hosts]
  };

  // Merge groups (case-sensitive unique by name)
  for (const group of imported.groups) {
    if (!merged.groups.some(g => g.name === group.name)) {
      merged.groups.push(group);
    }
  }

  // Merge hosts (unique by name, hostname, port)
  for (const host of imported.hosts) {
    const isDuplicate = merged.hosts.some(h => 
      h.name === host.name && h.hostname === host.hostname && h.port === host.port
    );
    
    if (!isDuplicate) {
      merged.hosts.push(host);
    }
  }

  return merged;
}

describe('Vault Merge Logic', () => {
  it('should merge groups by unique name', () => {
    const current: Vault = {
      version: 1,
      groups: [
        { name: 'Production', created_at: 1000 }
      ],
      hosts: []
    };

    const imported: Vault = {
      version: 1,
      groups: [
        { name: 'Staging', created_at: 2000 },
        { name: 'Production', created_at: 3000 } // Duplicate name
      ],
      hosts: []
    };

    const result = mergeVaults(current, imported);
    
    expect(result.groups).toHaveLength(2);
    expect(result.groups.find(g => g.name === 'Production')?.created_at).toBe(1000); // Original kept
    expect(result.groups.find(g => g.name === 'Staging')?.created_at).toBe(2000);
  });

  it('should merge hosts by unique composite key', () => {
    const current: Vault = {
      version: 1,
      groups: [],
      hosts: [
        {
          id: '1',
          name: 'web-01',
          hostname: 'web01.example.com',
          port: 22,
          auth: 'agent',
          tags: [],
          created_at: 1000,
          updated_at: 1000
        }
      ]
    };

    const imported: Vault = {
      version: 1,
      groups: [],
      hosts: [
        {
          id: '2',
          name: 'web-01', // Same name
          hostname: 'web01.example.com', // Same hostname
          port: 22, // Same port - should be duplicate
          auth: 'agent',
          tags: [],
          created_at: 2000,
          updated_at: 2000
        },
        {
          id: '3',
          name: 'web-02', // Different name
          hostname: 'web02.example.com',
          port: 22,
          auth: 'agent',
          tags: [],
          created_at: 2000,
          updated_at: 2000
        }
      ]
    };

    const result = mergeVaults(current, imported);
    
    expect(result.hosts).toHaveLength(2); // Original + new unique host
    expect(result.hosts.find(h => h.name === 'web-01')?.id).toBe('1'); // Original kept
    expect(result.hosts.find(h => h.name === 'web-02')?.id).toBe('3'); // New added
  });

  it('should handle empty vaults', () => {
    const empty: Vault = { version: 1, groups: [], hosts: [] };
    const result = mergeVaults(empty, empty);
    
    expect(result.groups).toHaveLength(0);
    expect(result.hosts).toHaveLength(0);
  });

  it('should preserve all data when no conflicts', () => {
    const current: Vault = {
      version: 1,
      groups: [{ name: 'Group A', created_at: 1000 }],
      hosts: [
        {
          id: '1',
          name: 'Host A',
          hostname: 'hosta.com',
          port: 22,
          auth: 'agent',
          tags: [],
          created_at: 1000,
          updated_at: 1000
        }
      ]
    };

    const imported: Vault = {
      version: 1,
      groups: [{ name: 'Group B', created_at: 2000 }],
      hosts: [
        {
          id: '2',
          name: 'Host B',
          hostname: 'hostb.com',
          port: 22,
          auth: 'agent',
          tags: [],
          created_at: 2000,
          updated_at: 2000
        }
      ]
    };

    const result = mergeVaults(current, imported);
    
    expect(result.groups).toHaveLength(2);
    expect(result.hosts).toHaveLength(2);
    expect(result.groups.map(g => g.name)).toEqual(['Group A', 'Group B']);
    expect(result.hosts.map(h => h.name)).toEqual(['Host A', 'Host B']);
  });
});

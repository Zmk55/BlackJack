import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vault, Host, Group, UIState } from './models';
import { VaultAPI } from './api';

interface AppState {
  // Vault data
  vault: Vault | null;
  loading: boolean;
  error: string | null;

  // UI state
  ui: UIState;

  // Actions
  loadVault: () => Promise<void>;
  saveVault: (vault: Vault) => Promise<void>;
  exportVault: (password: string) => Promise<void>;
  importVault: (password: string, merge: boolean) => Promise<void>;
  connectHost: (host: Host) => Promise<void>;
  
  // UI actions
  setSelectedHost: (hostId: string | undefined) => void;
  setSelectedGroup: (group: string | undefined) => void;
  setSearchQuery: (query: string) => void;
  setSortBy: (sortBy: 'name' | 'created_at' | 'updated_at') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  setTheme: (theme: 'system' | 'dark' | 'light') => void;
  toggleCommandPalette: () => void;
  
  // Host management
  addHost: (host: Omit<Host, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateHost: (id: string, updates: Partial<Host>) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;
  duplicateHost: (id: string) => Promise<void>;
  
  // Group management
  addGroup: (name: string) => Promise<void>;
  deleteGroup: (name: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      vault: null,
      loading: false,
      error: null,
      ui: {
        selectedHostId: undefined,
        selectedGroup: undefined,
        searchQuery: '',
        sortBy: 'name',
        sortOrder: 'asc',
        theme: 'system',
        showCommandPalette: false,
      },

      loadVault: async () => {
        set({ loading: true, error: null });
        try {
          const vault = await VaultAPI.load();
          set({ vault, loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to load vault', loading: false });
        }
      },

      saveVault: async (vault: Vault) => {
        set({ loading: true, error: null });
        try {
          await VaultAPI.save(vault);
          set({ vault, loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to save vault', loading: false });
        }
      },

      exportVault: async (password: string) => {
        set({ loading: true, error: null });
        try {
          await VaultAPI.exportToFile(password);
          set({ loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Export failed', loading: false });
        }
      },

      importVault: async (password: string, merge: boolean) => {
        set({ loading: true, error: null });
        try {
          const vault = await VaultAPI.importFromFile(password, merge);
          set({ vault, loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Import failed', loading: false });
        }
      },

      connectHost: async (host: Host) => {
        set({ loading: true, error: null });
        try {
          await VaultAPI.connect(host);
          set({ loading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Connection failed', loading: false });
        }
      },

      setSelectedHost: (hostId) => {
        set((state) => ({
          ui: { ...state.ui, selectedHostId: hostId }
        }));
      },

      setSelectedGroup: (group) => {
        set((state) => ({
          ui: { ...state.ui, selectedGroup: group }
        }));
      },

      setSearchQuery: (query) => {
        set((state) => ({
          ui: { ...state.ui, searchQuery: query }
        }));
      },

      setSortBy: (sortBy) => {
        set((state) => ({
          ui: { ...state.ui, sortBy }
        }));
      },

      setSortOrder: (order) => {
        set((state) => ({
          ui: { ...state.ui, sortOrder: order }
        }));
      },

      setTheme: (theme) => {
        set((state) => ({
          ui: { ...state.ui, theme }
        }));
      },

      toggleCommandPalette: () => {
        set((state) => ({
          ui: { ...state.ui, showCommandPalette: !state.ui.showCommandPalette }
        }));
      },

      addHost: async (hostData) => {
        const { vault } = get();
        if (!vault) return;

        const now = Date.now() / 1000;
        const newHost: Host = {
          ...hostData,
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
        };

        const updatedVault = {
          ...vault,
          hosts: [...vault.hosts, newHost]
        };

        await get().saveVault(updatedVault);
      },

      updateHost: async (id, updates) => {
        const { vault } = get();
        if (!vault) return;

        const updatedVault = {
          ...vault,
          hosts: vault.hosts.map(host => 
            host.id === id 
              ? { ...host, ...updates, updated_at: Date.now() / 1000 }
              : host
          )
        };

        await get().saveVault(updatedVault);
      },

      deleteHost: async (id) => {
        const { vault } = get();
        if (!vault) return;

        const updatedVault = {
          ...vault,
          hosts: vault.hosts.filter(host => host.id !== id)
        };

        await get().saveVault(updatedVault);
      },

      duplicateHost: async (id) => {
        const { vault } = get();
        if (!vault) return;

        const host = vault.hosts.find(h => h.id === id);
        if (!host) return;

        const now = Date.now() / 1000;
        const duplicatedHost: Host = {
          ...host,
          id: crypto.randomUUID(),
          name: `${host.name} (Copy)`,
          created_at: now,
          updated_at: now,
        };

        const updatedVault = {
          ...vault,
          hosts: [...vault.hosts, duplicatedHost]
        };

        await get().saveVault(updatedVault);
      },

      addGroup: async (name) => {
        const { vault } = get();
        if (!vault) return;

        const now = Date.now() / 1000;
        const newGroup = {
          name,
          created_at: now,
        };

        const updatedVault = {
          ...vault,
          groups: [...vault.groups, newGroup]
        };

        await get().saveVault(updatedVault);
      },

      deleteGroup: async (name) => {
        const { vault } = get();
        if (!vault) return;

        const updatedVault = {
          ...vault,
          groups: vault.groups.filter(g => g.name !== name),
          hosts: vault.hosts.map(host => 
            host.group === name ? { ...host, group: undefined } : host
          )
        };

        await get().saveVault(updatedVault);
      },
    }),
    {
      name: 'neonjack-ui-state',
      partialize: (state) => ({ ui: state.ui }),
    }
  )
);

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Server, 
  Folder, 
  Upload, 
  Download, 
  Plus,
  Hash,
  Terminal,
  Settings
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface Command {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  keywords: string[];
}

export function CommandPalette() {
  const {
    vault,
    ui,
    toggleCommandPalette,
    setSelectedHost,
    setSelectedGroup,
    setSearchQuery,
    exportVault,
    importVault,
    addHost,
    addGroup,
    connectHost
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const hosts = vault?.hosts || [];
  const groups = vault?.groups || [];

  const commands = useMemo(() => {
    const baseCommands: Command[] = [
      {
        id: 'new-host',
        title: 'New Host',
        description: 'Add a new SSH host',
        icon: Plus,
        action: async () => {
          const name = prompt('Enter host name:');
          if (!name) return;
          
          const hostname = prompt('Enter hostname:');
          if (!hostname) return;
          
          const portStr = prompt('Enter port (default 22):') || '22';
          const port = parseInt(portStr, 10) || 22;
          
          await addHost({
            name,
            hostname,
            port,
            auth: 'agent',
            tags: [],
          });
          toggleCommandPalette();
        },
        keywords: ['new', 'add', 'create', 'host']
      },
      {
        id: 'new-group',
        title: 'New Group',
        description: 'Create a new group',
        icon: Folder,
        action: async () => {
          const name = prompt('Enter group name:');
          if (name) {
            await addGroup(name);
            toggleCommandPalette();
          }
        },
        keywords: ['new', 'add', 'create', 'group']
      },
      {
        id: 'export',
        title: 'Export Vault',
        description: 'Export encrypted vault file',
        icon: Download,
        action: async () => {
          const password = prompt('Enter password for export:');
          if (password) {
            await exportVault(password);
            toggleCommandPalette();
          }
        },
        keywords: ['export', 'backup', 'save']
      },
      {
        id: 'import',
        title: 'Import Vault',
        description: 'Import encrypted vault file',
        icon: Upload,
        action: async () => {
          const password = prompt('Enter password for import:');
          if (password) {
            const merge = confirm('Merge with existing vault? (Cancel to replace)');
            await importVault(password, merge);
            toggleCommandPalette();
          }
        },
        keywords: ['import', 'restore', 'load']
      }
    ];

    const hostCommands: Command[] = hosts.map(host => ({
      id: `host-${host.id}`,
      title: host.name,
      description: `${host.username ? `${host.username}@` : ''}${host.hostname}${host.port !== 22 ? `:${host.port}` : ''}`,
      icon: Server,
      action: () => {
        setSelectedHost(host.id);
        toggleCommandPalette();
      },
      keywords: [host.name, host.hostname, host.username || '', host.group || '', ...host.tags]
    }));

    const groupCommands: Command[] = groups.map(group => ({
      id: `group-${group.name}`,
      title: group.name,
      description: `Filter by ${group.name} group`,
      icon: Folder,
      action: () => {
        setSelectedGroup(group.name);
        toggleCommandPalette();
      },
      keywords: [group.name, 'group']
    }));

    const tagCommands: Command[] = Array.from(new Set(hosts.flatMap(h => h.tags))).map(tag => ({
      id: `tag-${tag}`,
      title: tag,
      description: `Filter by ${tag} tag`,
      icon: Hash,
      action: () => {
        setSearchQuery(`tag:${tag}`);
        toggleCommandPalette();
      },
      keywords: [tag, 'tag']
    }));

    return [...baseCommands, ...hostCommands, ...groupCommands, ...tagCommands];
  }, [hosts, groups, addHost, addGroup, exportVault, importVault, setSelectedHost, setSelectedGroup, setSearchQuery, toggleCommandPalette]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;

    const searchTerms = query.toLowerCase().split(' ');
    return commands.filter(command => {
      const searchText = `${command.title} ${command.description} ${command.keywords.join(' ')}`.toLowerCase();
      return searchTerms.every(term => searchText.includes(term));
    });
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!ui.showCommandPalette) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
          }
          break;
        case 'Escape':
          e.preventDefault();
          toggleCommandPalette();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ui.showCommandPalette, filteredCommands, selectedIndex, toggleCommandPalette]);

  useEffect(() => {
    if (ui.showCommandPalette) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [ui.showCommandPalette]);

  if (!ui.showCommandPalette) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20">
      <div className="w-full max-w-2xl mx-4">
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl">
          {/* Search */}
          <div className="flex items-center gap-3 p-4 border-b border-border/50">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search commands, hosts, groups, or tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-96 overflow-y-auto">
            {filteredCommands.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No commands found</p>
              </div>
            ) : (
              <div className="p-2">
                {filteredCommands.map((command, index) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.id}
                      onClick={() => command.action()}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
                        index === selectedIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <Icon className="w-5 h-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{command.title}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {command.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-3 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>ESC Close</span>
            </div>
            <span>{filteredCommands.length} result{filteredCommands.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo } from 'react';
import { 
  Server, 
  KeyRound, 
  Shield, 
  Search, 
  Plus, 
  Trash2, 
  Copy,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { Host } from '@/lib/models';

function HostRow({ host, isSelected, onSelect, onConnect, onDuplicate, onDelete }: {
  host: Host;
  isSelected: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const authIcon = host.auth === 'agent' ? Shield : KeyRound;
  const AuthIcon = authIcon;

  return (
    <div
      className={cn(
        "host-card p-4 cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-primary/50 bg-primary/5"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{host.name}</h3>
            {host.group && (
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                {host.group}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Server className="w-3 h-3" />
            <span className="font-mono">
              {host.username ? `${host.username}@` : ''}{host.hostname}
              {host.port !== 22 && `:${host.port}`}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <AuthIcon className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {host.auth === 'agent' ? 'SSH Agent' : 'Key File'}
            </span>
            {host.tags.length > 0 && (
              <div className="flex gap-1 ml-2">
                {host.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
                {host.tags.length > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{host.tags.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onConnect();
            }}
          >
            <Play className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive-foreground hover:bg-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function HostList() {
  const {
    vault,
    ui,
    setSelectedHost,
    setSearchQuery,
    connectHost,
    duplicateHost,
    deleteHost,
    addHost
  } = useAppStore();

  const hosts = vault?.hosts || [];
  const groups = vault?.groups || [];

  const filteredHosts = useMemo(() => {
    let filtered = hosts;

    // Filter by group
    if (ui.selectedGroup) {
      filtered = filtered.filter(host => host.group === ui.selectedGroup);
    }

    // Filter by search query
    if (ui.searchQuery) {
      const query = ui.searchQuery.toLowerCase();
      filtered = filtered.filter(host => {
        if (query.startsWith('tag:')) {
          const tag = query.slice(4);
          return host.tags.some(t => t.toLowerCase().includes(tag));
        }
        return (
          host.name.toLowerCase().includes(query) ||
          host.hostname.toLowerCase().includes(query) ||
          host.username?.toLowerCase().includes(query) ||
          host.group?.toLowerCase().includes(query)
        );
      });
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[ui.sortBy];
      const bValue = b[ui.sortBy];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return ui.sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return ui.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });

    return filtered;
  }, [hosts, ui.selectedGroup, ui.searchQuery, ui.sortBy, ui.sortOrder]);

  const handleNewHost = async () => {
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
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search hosts... (use 'tag:' for tags)"
              value={ui.searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleNewHost}>
            <Plus className="w-4 h-4 mr-2" />
            New Host
          </Button>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filteredHosts.length} host{filteredHosts.length !== 1 ? 's' : ''}</span>
          {ui.selectedGroup && (
            <span>in {ui.selectedGroup}</span>
          )}
        </div>
      </div>

      {/* Host List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredHosts.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hosts found</h3>
            <p className="text-muted-foreground mb-4">
              {ui.searchQuery ? 'Try adjusting your search' : 'Add your first host to get started'}
            </p>
            {!ui.searchQuery && (
              <Button onClick={handleNewHost}>
                <Plus className="w-4 h-4 mr-2" />
                Add Host
              </Button>
            )}
          </div>
        ) : (
          filteredHosts.map((host) => (
            <HostRow
              key={host.id}
              host={host}
              isSelected={ui.selectedHostId === host.id}
              onSelect={() => setSelectedHost(host.id)}
              onConnect={() => connectHost(host)}
              onDuplicate={() => duplicateHost(host.id)}
              onDelete={() => deleteHost(host.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

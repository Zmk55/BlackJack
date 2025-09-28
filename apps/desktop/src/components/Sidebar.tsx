import React from 'react';
import { 
  Server, 
  Folder, 
  Upload, 
  Download, 
  Settings, 
  Plus,
  Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { 
    vault, 
    ui, setSelectedGroup, 
    setSearchQuery,
    exportVault,
    importVault,
    addGroup
  } = useAppStore();

  const groups = vault?.groups || [];
  const hosts = vault?.hosts || [];
  
  const groupCounts = groups.reduce((acc, group) => {
    acc[group.name] = hosts.filter(host => host.group === group.name).length;
    return acc;
  }, {} as Record<string, number>);

  const handleExport = async () => {
    const password = prompt('Enter password for export:');
    if (password) {
      await exportVault(password);
    }
  };

  const handleImport = async () => {
    const password = prompt('Enter password for import:');
    if (password) {
      const merge = confirm('Merge with existing vault? (Cancel to replace)');
      await importVault(password, merge);
    }
  };

  const handleNewGroup = async () => {
    const name = prompt('Enter group name:');
    if (name) {
      await addGroup(name);
    }
  };

  return (
    <div className="w-64 bg-card/95 backdrop-blur-sm border-r border-border/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Server className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Latch</h1>
            <p className="text-sm text-muted-foreground">SSH Manager</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 space-y-2">
        {/* All Hosts */}
        <button
          onClick={() => setSelectedGroup(undefined)}
          className={cn(
            "sidebar-item w-full",
            !ui.selectedGroup && "active"
          )}
        >
          <Server className="w-4 h-4" />
          <span>All Hosts</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {hosts.length}
          </span>
        </button>

        {/* Groups */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Groups
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleNewGroup}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          
          {groups.map((group) => (
            <button
              key={group.name}
              onClick={() => setSelectedGroup(group.name)}
              className={cn(
                "sidebar-item w-full",
                ui.selectedGroup === group.name && "active"
              )}
            >
              <Folder className="w-4 h-4" />
              <span className="truncate">{group.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {groupCounts[group.name] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <div className="px-3 py-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Tags
            </span>
          </div>
          
          {Array.from(new Set(hosts.flatMap(h => h.tags))).map((tag) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(`tag:${tag}`)}
              className="sidebar-item w-full"
            >
              <Hash className="w-4 h-4" />
              <span>{tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border/50 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleImport}
        >
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleExport}
        >
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { HostList } from '@/components/HostList';
import { HostDetails } from '@/components/HostDetails';
import { CommandPalette } from '@/components/CommandPalette';
import { Onboarding } from '@/components/Onboarding';
import { Toaster } from '@/components/Toast';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

function App() {
  const { loadVault, error, vault } = useAppStore();
  const { toast } = useToast();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  useEffect(() => {
    // Show onboarding for new users (empty vault)
    if (vault && vault.hosts.length === 0 && vault.groups.length === 0) {
      setShowOnboarding(true);
    }
  }, [vault]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command palette: Cmd/Ctrl + K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        useAppStore.getState().toggleCommandPalette();
      }
      
      // New host: N
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        // This would trigger the new host dialog
        // For now, we'll just focus the search input
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (showOnboarding) {
    return (
      <>
        <Onboarding />
        <Toaster />
      </>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex">
      <Sidebar />
      <div className="flex-1 flex">
        <div className="flex-1">
          <HostList />
        </div>
        <div className="w-96 border-l border-border/50">
          <HostDetails />
        </div>
      </div>
      <CommandPalette />
      <Toaster />
    </div>
  );
}

export default App;

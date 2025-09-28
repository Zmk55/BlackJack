import React, { useState, useEffect } from 'react';
import { 
  Server, 
  KeyRound, 
  Shield, 
  Save, 
  Terminal,
  Hash,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { validateHost } from '@/lib/validators';
import type { Host } from '@/lib/models';

export function HostDetails() {
  const {
    vault,
    ui,
    updateHost,
    connectHost
  } = useAppStore();

  const selectedHost = vault?.hosts.find(h => h.id === ui.selectedHostId);
  const groups = vault?.groups || [];

  const [formData, setFormData] = useState<Partial<Host>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'details' | 'notes' | 'preview'>('details');

  useEffect(() => {
    if (selectedHost) {
      setFormData(selectedHost);
      setErrors({});
    } else {
      setFormData({});
      setErrors({});
    }
  }, [selectedHost]);

  const handleSave = async () => {
    if (!selectedHost) return;

    const validationErrors = validateHost(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    await updateHost(selectedHost.id, formData);
  };

  const handleFieldChange = (field: keyof Host, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const generateSSHCommand = () => {
    if (!formData.hostname) return 'ssh';
    
    const parts = ['ssh'];
    
    if (formData.port && formData.port !== 22) {
      parts.push('-p', formData.port.toString());
    }
    
    if (formData.auth === 'key_path' && formData.key_path) {
      parts.push('-i', formData.key_path);
    }
    
    const target = formData.username 
      ? `${formData.username}@${formData.hostname}`
      : formData.hostname;
    
    parts.push(target);
    
    return parts.join(' ');
  };

  if (!selectedHost) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Server className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No host selected</h3>
          <p className="text-muted-foreground">
            Select a host from the list to view and edit its details
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">{formData.name || 'Untitled Host'}</h2>
            <p className="text-sm text-muted-foreground">
              {formData.username ? `${formData.username}@` : ''}{formData.hostname}
              {formData.port !== 22 && `:${formData.port}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => connectHost(selectedHost)}
            >
              <Terminal className="w-4 h-4 mr-2" />
              Connect
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border/50">
        <div className="flex">
          {[
            { id: 'details', label: 'Details', icon: Server },
            { id: 'notes', label: 'Notes', icon: FileText },
            { id: 'preview', label: 'SSH Command', icon: Terminal },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="hostname">Hostname *</Label>
                  <Input
                    id="hostname"
                    value={formData.hostname || ''}
                    onChange={(e) => handleFieldChange('hostname', e.target.value)}
                    className={errors.hostname ? 'border-destructive' : ''}
                  />
                  {errors.hostname && (
                    <p className="text-sm text-destructive mt-1">{errors.hostname}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username || ''}
                    onChange={(e) => handleFieldChange('username', e.target.value)}
                    placeholder="Leave empty for current user"
                  />
                </div>
                
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port || 22}
                    onChange={(e) => handleFieldChange('port', parseInt(e.target.value) || 22)}
                    className={errors.port ? 'border-destructive' : ''}
                  />
                  {errors.port && (
                    <p className="text-sm text-destructive mt-1">{errors.port}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Authentication */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Authentication</h3>
              
              <div>
                <Label htmlFor="auth">Authentication Method</Label>
                <Select
                  value={formData.auth || 'agent'}
                  onValueChange={(value) => handleFieldChange('auth', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        SSH Agent
                      </div>
                    </SelectItem>
                    <SelectItem value="key_path">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-4 h-4" />
                        Key File
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.auth === 'key_path' && (
                <div>
                  <Label htmlFor="key_path">Key Path</Label>
                  <Input
                    id="key_path"
                    value={formData.key_path || ''}
                    onChange={(e) => handleFieldChange('key_path', e.target.value)}
                    placeholder="/path/to/private/key"
                    className={errors.key_path ? 'border-destructive' : ''}
                  />
                  {errors.key_path && (
                    <p className="text-sm text-destructive mt-1">{errors.key_path}</p>
                  )}
                </div>
              )}
            </div>

            {/* Organization */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Organization</h3>
              
              <div>
                <Label htmlFor="group">Group</Label>
                <Select
                  value={formData.group || ''}
                  onValueChange={(value) => handleFieldChange('group', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No group</SelectItem>
                    {groups.map((group) => (
                      <SelectItem key={group.name} value={group.name}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tags?.join(', ') || ''}
                  onChange={(e) => handleFieldChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  placeholder="prod, web, database"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Separate tags with commas
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Notes</h3>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Add notes about this host..."
              className="min-h-[300px]"
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">SSH Command Preview</h3>
            <div className="bg-muted p-4 rounded-lg">
              <code className="text-sm font-mono">
                {generateSSHCommand()}
              </code>
            </div>
            <p className="text-sm text-muted-foreground">
              This command will be executed when you click Connect
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

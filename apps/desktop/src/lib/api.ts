import { invoke } from '@tauri-apps/api/tauri';
import { open, save } from '@tauri-apps/api/dialog';
import { writeFile, readFile } from '@tauri-apps/api/fs';
import type { Vault, Host } from './models';

export class VaultAPI {
  static async load(): Promise<Vault> {
    return await invoke('vault_load');
  }

  static async save(vault: Vault): Promise<void> {
    return await invoke('vault_save', { vault });
  }

  static async export(password: string): Promise<string> {
    return await invoke('vault_export', { password });
  }

  static async import(password: string, fileBytes: Uint8Array, merge: boolean): Promise<Vault> {
    return await invoke('vault_import', { password, fileBytes, merge });
  }

  static async connect(host: Host): Promise<void> {
    return await invoke('ssh_connect', { host });
  }

  static async exportToFile(password: string): Promise<void> {
    try {
      const exportData = await this.export(password);
      const filePath = await save({
        title: 'Export Latch Vault',
        defaultPath: 'latch-vault.sshvault',
        filters: [
          { name: 'Latch Vault', extensions: ['sshvault'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath) {
        await writeFile(filePath, exportData);
      }
    } catch (error) {
      throw new Error(`Export failed: ${error}`);
    }
  }

  static async importFromFile(password: string, merge: boolean): Promise<Vault> {
    try {
      const filePath = await open({
        title: 'Import Latch Vault',
        filters: [
          { name: 'Latch Vault', extensions: ['sshvault'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (filePath && typeof filePath === 'string') {
        const fileData = await readFile(filePath);
        const fileBytes = new Uint8Array(fileData);
        return await this.import(password, fileBytes, merge);
      }
      
      throw new Error('No file selected');
    } catch (error) {
      throw new Error(`Import failed: ${error}`);
    }
  }
}

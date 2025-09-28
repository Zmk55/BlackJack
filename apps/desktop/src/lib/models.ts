export type IdKind = "agent" | "key_path";

export interface Group {
  name: string;
  created_at: number; // epoch seconds
}

export interface Host {
  id: string;         // uuid v4
  name: string;       // display name (e.g., "prod-app-01")
  hostname: string;   // e.g., "app01.internal"
  port: number;       // default 22
  username?: string;  // default user
  auth: IdKind;       // "agent" | "key_path"
  key_path?: string;  // if auth === "key_path"
  group?: string;     // group name
  tags: string[];
  notes?: string;
  created_at: number;
  updated_at: number;
}

export interface Vault {
  version: 1;
  groups: Group[];
  hosts: Host[];
}

export interface ExportFile {
  fmt: "sshvault-export";
  v: 1;
  salt: string;      // base64
  nonce: string;     // base64
  ciphertext: string; // base64
}

export interface UIState {
  selectedHostId?: string;
  selectedGroup?: string;
  searchQuery: string;
  sortBy: 'name' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
  theme: 'system' | 'dark' | 'light';
  showCommandPalette: boolean;
}

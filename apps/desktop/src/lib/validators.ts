export function validateHostname(hostname: string): string | null {
  if (!hostname.trim()) {
    return 'Hostname is required';
  }
  
  // Basic hostname validation
  const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!hostnameRegex.test(hostname)) {
    return 'Invalid hostname format';
  }
  
  return null;
}

export function validatePort(port: number): string | null {
  if (port < 1 || port > 65535) {
    return 'Port must be between 1 and 65535';
  }
  
  return null;
}

export function validateName(name: string): string | null {
  if (!name.trim()) {
    return 'Name is required';
  }
  
  if (name.length > 100) {
    return 'Name must be less than 100 characters';
  }
  
  return null;
}

export function validateKeyPath(keyPath: string): string | null {
  if (!keyPath.trim()) {
    return 'Key path is required when using key authentication';
  }
  
  // Note: We can't easily validate if the file exists from the frontend
  // This will be handled by the SSH connection attempt
  return null;
}

export function validateHost(host: Partial<{
  name: string;
  hostname: string;
  port: number;
  auth: 'agent' | 'key_path';
  key_path?: string;
}>): Record<string, string> {
  const errors: Record<string, string> = {};
  
  const nameError = validateName(host.name || '');
  if (nameError) errors.name = nameError;
  
  const hostnameError = validateHostname(host.hostname || '');
  if (hostnameError) errors.hostname = hostnameError;
  
  const portError = validatePort(host.port || 22);
  if (portError) errors.port = portError;
  
  if (host.auth === 'key_path') {
    const keyPathError = validateKeyPath(host.key_path || '');
    if (keyPathError) errors.key_path = keyPathError;
  }
  
  return errors;
}

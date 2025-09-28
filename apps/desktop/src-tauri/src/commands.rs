use anyhow::{anyhow, Result};
use std::fs;
use std::process::{Command, Stdio};
use tauri::State;
use serde_json;

use crate::models::{Vault, Host, Group, IdKind};
use crate::crypto::{encrypt_vault, decrypt_vault};
use crate::fs::{get_vault_path, ensure_vault_dir};

#[tauri::command]
pub async fn vault_load() -> Result<Vault, String> {
    let vault_path = get_vault_path().map_err(|e| e.to_string())?;
    
    if !vault_path.exists() {
        return Ok(Vault::default());
    }
    
    let content = fs::read_to_string(&vault_path)
        .map_err(|e| format!("Failed to read vault file: {}", e))?;
    
    let vault: Vault = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse vault file: {}", e))?;
    
    Ok(vault)
}

#[tauri::command]
pub async fn vault_save(vault: Vault) -> Result<(), String> {
    ensure_vault_dir().map_err(|e| e.to_string())?;
    
    let vault_path = get_vault_path().map_err(|e| e.to_string())?;
    let content = serde_json::to_string_pretty(&vault)
        .map_err(|e| format!("Failed to serialize vault: {}", e))?;
    
    fs::write(&vault_path, content)
        .map_err(|e| format!("Failed to write vault file: {}", e))?;
    
    // Force sync to disk
    let file = fs::File::open(&vault_path)
        .map_err(|e| format!("Failed to open vault file for sync: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync vault file: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn vault_export(password: String) -> Result<String, String> {
    let vault = vault_load().await?;
    encrypt_vault(&vault, &password)
        .map_err(|e| format!("Export failed: {}", e))
}

#[tauri::command]
pub async fn vault_import(password: String, file_bytes: Vec<u8>, merge: bool) -> Result<Vault, String> {
    let export_data = String::from_utf8(file_bytes)
        .map_err(|e| format!("Invalid file data: {}", e))?;
    
    let imported_vault = decrypt_vault(&export_data, &password)
        .map_err(|e| format!("Import failed: {}", e))?;
    
    if merge {
        let mut current_vault = vault_load().await?;
        merge_vaults(&mut current_vault, imported_vault);
        vault_save(current_vault.clone()).await?;
        Ok(current_vault)
    } else {
        vault_save(imported_vault.clone()).await?;
        Ok(imported_vault)
    }
}

#[tauri::command]
pub async fn ssh_connect(host: Host) -> Result<(), String> {
    let mut ssh_args = Vec::new();
    
    // Add port if not default
    if host.port != 22 {
        ssh_args.push("-p".to_string());
        ssh_args.push(host.port.to_string());
    }
    
    // Add key path if using key authentication
    if let IdKind::KeyPath = host.auth {
        if let Some(key_path) = &host.key_path {
            ssh_args.push("-i".to_string());
            ssh_args.push(key_path.clone());
        }
    }
    
    // Build target string
    let target = if let Some(username) = &host.username {
        format!("{}@{}", username, host.hostname)
    } else {
        host.hostname.clone()
    };
    ssh_args.push(target);
    
    // Spawn SSH process
    let result = if cfg!(target_os = "windows") {
        spawn_windows_ssh(&ssh_args)
    } else {
        spawn_unix_ssh(&ssh_args)
    };
    
    result.map_err(|e| format!("Failed to connect: {}", e))
}

fn spawn_windows_ssh(args: &[String]) -> Result<(), String> {
    // Try Windows Terminal first
    let wt_result = Command::new("wt.exe")
        .args(&["-w", "0", "nt", "-p", "Command Prompt"])
        .arg("ssh")
        .args(args)
        .spawn();
    
    if wt_result.is_ok() {
        return Ok(());
    }
    
    // Fallback to cmd.exe
    let mut cmd_args = vec!["/c".to_string(), "start".to_string(), "ssh".to_string()];
    cmd_args.extend(args.iter().cloned());
    
    Command::new("cmd.exe")
        .args(&cmd_args)
        .spawn()
        .map_err(|e| format!("Failed to spawn SSH: {}", e))?;
    
    Ok(())
}

fn spawn_unix_ssh(args: &[String]) -> Result<(), String> {
    // Try to use the user's default terminal
    let terminal = std::env::var("TERMINAL").unwrap_or_else(|_| "xterm".to_string());
    
    let mut cmd = Command::new(&terminal);
    cmd.arg("-e").arg("ssh").args(args);
    
    cmd.spawn()
        .map_err(|e| format!("Failed to spawn SSH in terminal: {}", e))?;
    
    Ok(())
}

fn merge_vaults(current: &mut Vault, imported: Vault) {
    // Merge groups (case-sensitive unique by name)
    for group in imported.groups {
        if !current.groups.iter().any(|g| g.name == group.name) {
            current.groups.push(group);
        }
    }
    
    // Merge hosts (unique by name, hostname, port)
    for host in imported.hosts {
        let is_duplicate = current.hosts.iter().any(|h| {
            h.name == host.name && h.hostname == host.hostname && h.port == host.port
        });
        
        if !is_duplicate {
            current.hosts.push(host);
        }
    }
}

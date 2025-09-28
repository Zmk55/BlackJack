use anyhow::{anyhow, Result};
use dirs;
use std::fs;
use std::path::PathBuf;
use crate::models::Vault;

pub fn get_vault_path() -> Result<PathBuf> {
    let home_dir = dirs::home_dir()
        .ok_or_else(|| anyhow!("Could not find home directory"))?;
    
    let latch_dir = home_dir.join(".neonjack");
    if !latch_dir.exists() {
        fs::create_dir_all(&latch_dir)
            .map_err(|e| anyhow!("Failed to create .neonjack directory: {}", e))?;
    }
    
    Ok(latch_dir.join("vault.json"))
}

pub fn ensure_vault_dir() -> Result<()> {
    let vault_path = get_vault_path()?;
    if let Some(parent) = vault_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| anyhow!("Failed to create vault directory: {}", e))?;
    }
    Ok(())
}

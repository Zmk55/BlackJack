use anyhow::{anyhow, Result};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, NewAead};
use base64::{Engine as _, engine::general_purpose};
use rand::Rng;
use serde_json;

const ARGON2_MEMORY: u32 = 65536;
const ARGON2_TIME: u32 = 3;
const ARGON2_PARALLELISM: u32 = 1;
const KEY_LENGTH: usize = 32;
const NONCE_LENGTH: usize = 12;

pub fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; KEY_LENGTH]> {
    let argon2 = Argon2::default();
    let salt_string = SaltString::from_b64(&general_purpose::STANDARD.encode(salt))
        .map_err(|e| anyhow!("Invalid salt: {}", e))?;
    
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt_string)
        .map_err(|e| anyhow!("Argon2 hashing failed: {}", e))?;
    
    let hash_bytes = password_hash.hash.unwrap().as_bytes();
    if hash_bytes.len() < KEY_LENGTH {
        return Err(anyhow!("Derived key too short"));
    }
    
    let mut key = [0u8; KEY_LENGTH];
    key.copy_from_slice(&hash_bytes[..KEY_LENGTH]);
    Ok(key)
}

pub fn encrypt_vault(vault: &crate::models::Vault, password: &str) -> Result<String> {
    // Generate random salt and nonce
    let mut rng = OsRng;
    let salt = SaltString::generate(&mut rng);
    let mut nonce_bytes = [0u8; NONCE_LENGTH];
    rng.fill(&mut nonce_bytes);
    
    // Derive key
    let key = derive_key(password, salt.as_salt().as_bytes())?;
    
    // Serialize vault to JSON
    let plaintext = serde_json::to_string(vault)
        .map_err(|e| anyhow!("JSON serialization failed: {}", e))?;
    
    // Encrypt with AES-GCM
    let cipher = Aes256Gcm::new(Key::from_slice(&key));
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher.encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| anyhow!("Encryption failed: {}", e))?;
    
    // Create export file
    let export_file = crate::models::ExportFile {
        fmt: "sshvault-export".to_string(),
        v: 1,
        salt: general_purpose::STANDARD.encode(salt.as_salt().as_bytes()),
        nonce: general_purpose::STANDARD.encode(&nonce_bytes),
        ciphertext: general_purpose::STANDARD.encode(&ciphertext),
    };
    
    serde_json::to_string(&export_file)
        .map_err(|e| anyhow!("Export serialization failed: {}", e))
}

pub fn decrypt_vault(export_data: &str, password: &str) -> Result<crate::models::Vault> {
    // Parse export file
    let export_file: crate::models::ExportFile = serde_json::from_str(export_data)
        .map_err(|e| anyhow!("Invalid export format: {}", e))?;
    
    if export_file.fmt != "sshvault-export" || export_file.v != 1 {
        return Err(anyhow!("Unsupported export format"));
    }
    
    // Decode salt and nonce
    let salt_bytes = general_purpose::STANDARD.decode(&export_file.salt)
        .map_err(|e| anyhow!("Invalid salt encoding: {}", e))?;
    let nonce_bytes = general_purpose::STANDARD.decode(&export_file.nonce)
        .map_err(|e| anyhow!("Invalid nonce encoding: {}", e))?;
    let ciphertext = general_purpose::STANDARD.decode(&export_file.ciphertext)
        .map_err(|e| anyhow!("Invalid ciphertext encoding: {}", e))?;
    
    // Derive key
    let key = derive_key(password, &salt_bytes)?;
    
    // Decrypt
    let cipher = Aes256Gcm::new(Key::from_slice(&key));
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| anyhow!("Decryption failed - wrong password or corrupted data"))?;
    
    // Deserialize vault
    let vault: crate::models::Vault = serde_json::from_slice(&plaintext)
        .map_err(|e| anyhow!("Invalid vault data: {}", e))?;
    
    Ok(vault)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Vault, Group, Host, IdKind};

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let vault = Vault {
            version: 1,
            groups: vec![Group {
                name: "test-group".to_string(),
                created_at: 1234567890,
            }],
            hosts: vec![Host {
                id: "test-id".to_string(),
                name: "test-host".to_string(),
                hostname: "example.com".to_string(),
                port: 22,
                username: Some("user".to_string()),
                auth: IdKind::Agent,
                key_path: None,
                group: Some("test-group".to_string()),
                tags: vec!["prod".to_string()],
                notes: Some("Test host".to_string()),
                created_at: 1234567890,
                updated_at: 1234567890,
            }],
        };
        
        let password = "test-password-123";
        let encrypted = encrypt_vault(&vault, password).unwrap();
        let decrypted = decrypt_vault(&encrypted, password).unwrap();
        
        assert_eq!(vault.version, decrypted.version);
        assert_eq!(vault.groups.len(), decrypted.groups.len());
        assert_eq!(vault.hosts.len(), decrypted.hosts.len());
        assert_eq!(vault.hosts[0].name, decrypted.hosts[0].name);
    }
    
    #[test]
    fn test_wrong_password_fails() {
        let vault = Vault::default();
        let password = "correct-password";
        let wrong_password = "wrong-password";
        
        let encrypted = encrypt_vault(&vault, password).unwrap();
        let result = decrypt_vault(&encrypted, wrong_password);
        
        assert!(result.is_err());
    }
}

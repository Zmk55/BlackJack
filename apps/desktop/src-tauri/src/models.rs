use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IdKind {
    Agent,
    KeyPath,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub name: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Host {
    pub id: String,
    pub name: String,
    pub hostname: String,
    pub port: u16,
    pub username: Option<String>,
    pub auth: IdKind,
    pub key_path: Option<String>,
    pub group: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub version: u8,
    pub groups: Vec<Group>,
    pub hosts: Vec<Host>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportFile {
    pub fmt: String,
    pub v: u8,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

impl Default for Vault {
    fn default() -> Self {
        Self {
            version: 1,
            groups: Vec::new(),
            hosts: Vec::new(),
        }
    }
}

impl Host {
    pub fn new(name: String, hostname: String, port: u16) -> Self {
        let now = Utc::now().timestamp();
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            hostname,
            port,
            username: None,
            auth: IdKind::Agent,
            key_path: None,
            group: None,
            tags: Vec::new(),
            notes: None,
            created_at: now,
            updated_at: now,
        }
    }
}

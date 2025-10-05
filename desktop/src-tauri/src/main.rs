use tauri::{Manager, WebviewWindowBuilder, WebviewUrl};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Serialize, Deserialize, Clone)]
struct Host {
    id: String,
    name: String,
    address: String,
    user: String,
    port: u16,
}

// Global state
struct AppState {
    hosts: Mutex<Vec<Host>>,
}

#[tauri::command]
async fn get_hosts(state: tauri::State<AppState>) -> Result<Vec<Host>, String> {
    let hosts = state.hosts.lock().unwrap();
    Ok(hosts.clone())
}

#[tauri::command]
async fn add_host(
    state: tauri::State<AppState>,
    name: String,
    address: String,
    user: String,
    port: u16,
) -> Result<Host, String> {
    let mut hosts = state.hosts.lock().unwrap();
    let host = Host {
        id: format!("{}", hosts.len() + 1),
        name,
        address,
        user,
        port,
    };
    hosts.push(host.clone());
    Ok(host)
}

#[tauri::command]
async fn connect_ssh(
    state: tauri::State<AppState>,
    window: tauri::WebviewWindow,
    host_id: String,
) -> Result<String, String> {
    let hosts = state.hosts.lock().unwrap();
    let host = hosts.iter().find(|h| h.id == host_id)
        .ok_or("Host not found")?;
    
    // Create new SSH tab
    let tab_id = format!("ssh-{}-{}", host.name, chrono::Utc::now().timestamp_millis());
    
    // Create new window for SSH session
    let ssh_window = WebviewWindowBuilder::new(
        &window.app_handle(),
        &tab_id,
        WebviewUrl::App("index.html".into()),
    )
    .title(&format!("SSH: {}", host.name))
    .inner_size(1000.0, 700.0)
    .build()
    .map_err(|e| e.to_string())?;
    
    // Send host data to the new window
    ssh_window.emit("ssh-connect", host.clone()).map_err(|e| e.to_string())?;
    
    Ok(tab_id)
}

#[tauri::command]
async fn execute_ssh_command(
    host_id: String,
    command: String,
) -> Result<String, String> {
    // This would integrate with your existing SSH logic
    // For now, return a placeholder
    Ok(format!("Executing '{}' on host {}", command, host_id))
}

fn main() {
    // Initialize sample hosts
    let hosts = vec![
        Host {
            id: "1".to_string(),
            name: "Adguard.local".to_string(),
            address: "192.168.1.57".to_string(),
            user: "tim".to_string(),
            port: 22,
        },
        Host {
            id: "2".to_string(),
            name: "Web Server".to_string(),
            address: "192.168.1.100".to_string(),
            user: "admin".to_string(),
            port: 22,
        },
        Host {
            id: "3".to_string(),
            name: "Database".to_string(),
            address: "192.168.1.101".to_string(),
            user: "root".to_string(),
            port: 22,
        },
    ];
    
    let app_state = AppState {
        hosts: Mutex::new(hosts),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            get_hosts,
            add_host,
            connect_ssh,
            execute_ssh_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
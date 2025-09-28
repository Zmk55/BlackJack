// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod crypto;
mod fs;
mod commands;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::vault_load,
            commands::vault_save,
            commands::vault_export,
            commands::vault_import,
            commands::ssh_connect
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

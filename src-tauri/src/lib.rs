mod app_lifecycle;
mod collection;
mod media;
mod settings;
mod tray;
mod window;

/// VinylDeck is a dark, cinematic surface. On Linux the native window chrome
/// comes from GTK, which follows the (usually light) system theme and makes the
/// app look like a system dialog. Prefer the dark variant unless the user
/// already picked a GTK theme through the environment.
#[cfg(target_os = "linux")]
fn apply_linux_window_theme() {
    if std::env::var_os("GTK_THEME").is_none() {
        std::env::set_var("GTK_THEME", "Adwaita:dark");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    apply_linux_window_theme();

    tauri::Builder::default()
        // Must be registered first: a second launch hands off to this
        // instance and exits before any other plugin initializes.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::focus_existing(app);
        }))
        .manage(media::authority::PlaybackAuthority::new())
        .manage(settings::SettingsState::new())
        .manage(collection::CollectionState::new())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .on_window_event(tray::handle_window_close)
        .invoke_handler(tauri::generate_handler![
            media::commands::cmd_smtc_snapshot,
            media::commands::cmd_smtc_play,
            media::commands::cmd_smtc_pause,
            media::commands::cmd_smtc_toggle_play_pause,
            media::commands::cmd_smtc_next,
            media::commands::cmd_smtc_previous,
            media::commands::cmd_smtc_seek,
            settings::cmd_settings_snapshot,
            settings::cmd_settings_update,
            settings::cmd_settings_reset,
            collection::cmd_collection_snapshot,
            collection::cmd_collection_press,
            app_lifecycle::cmd_quit,
            window::cmd_set_always_on_top,
            window::cmd_set_window_mode,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(settings::initialize_settings(app_handle))?;
            if let Err(error) = collection::initialize_collection(app.handle()) {
                eprintln!("[VinylDeck crate] failed to load collection: {error}");
            }
            media::poller::start_smtc_poller(app.handle().clone());
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod app_lifecycle;
mod collection;
mod i18n;
mod media;
mod overlay;
mod presence;
mod reactivity;
mod settings;
mod shortcuts;
mod sleep;
mod tray;
mod update;
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

/// GNOME on Wayland ignores a client's request to stay above other windows,
/// so the Mini player would sink behind whatever gets focus. Under X11
/// (XWayland) the request is honoured. Runs before GTK starts; keeps an
/// explicit GDK_BACKEND, and stays on Wayland when XWayland is not there.
#[cfg(target_os = "linux")]
fn apply_linux_display_backend() {
    if should_use_x11_backend(
        std::env::var_os("GDK_BACKEND").is_some(),
        std::env::var_os("WAYLAND_DISPLAY").is_some(),
        std::env::var_os("DISPLAY").is_some(),
    ) {
        std::env::set_var("GDK_BACKEND", "x11");
    }
}

#[cfg(any(target_os = "linux", test))]
fn should_use_x11_backend(backend_set: bool, wayland: bool, xwayland: bool) -> bool {
    !backend_set && wayland && xwayland
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        apply_linux_window_theme();
        apply_linux_display_backend();
    }

    tauri::Builder::default()
        // Must be registered first: a second launch hands off to this
        // instance and exits before any other plugin initializes.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            window::focus_existing(app);
        }))
        .manage(media::authority::PlaybackAuthority::new())
        .manage(sleep::SleepTimerState::new())
        .manage(settings::SettingsState::new())
        .manage(collection::CollectionState::new())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(shortcuts::plugin())
        // Artwork bytes are served from the in-process cache. The frontend
        // converts the short `vinyldeck://art/<hash>` value from snapshots
        // into the platform URL form for this scheme.
        .register_uri_scheme_protocol("vinyldeck", |_context, request| {
            media::artwork::protocol_response(request.uri().path())
        })
        .on_window_event(tray::handle_window_close)
        .invoke_handler(tauri::generate_handler![
            media::commands::cmd_media_players,
            media::commands::cmd_smtc_snapshot,
            media::commands::cmd_smtc_play,
            media::commands::cmd_smtc_pause,
            media::commands::cmd_smtc_toggle_play_pause,
            media::commands::cmd_smtc_next,
            media::commands::cmd_smtc_previous,
            media::commands::cmd_smtc_seek,
            media::commands::cmd_media_set_repeat,
            media::commands::cmd_media_set_shuffle,
            sleep::cmd_sleep_timer_start,
            sleep::cmd_sleep_timer_cancel,
            sleep::cmd_sleep_timer_snapshot,
            settings::cmd_settings_snapshot,
            settings::cmd_settings_update,
            settings::cmd_settings_reset,
            collection::cmd_collection_snapshot,
            collection::cmd_collection_press,
            collection::cmd_collection_remove,
            collection::cmd_collection_wrapped,
            collection::cmd_collection_play_times,
            app_lifecycle::cmd_quit,
            window::cmd_set_always_on_top,
            window::cmd_set_window_mode,
            update::cmd_update_check,
            update::cmd_open_release,
        ])
        .setup(|app| {
            window::fit_main_to_monitor(app.handle());
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(settings::initialize_settings(app_handle))?;
            if let Err(error) = collection::initialize_collection(app.handle()) {
                eprintln!("[VinylDeck crate] failed to load collection: {error}");
            }
            media::poller::start_smtc_poller(app.handle().clone());
            reactivity::start(app.handle().clone());
            overlay::start(app.handle().clone());
            presence::start(app.handle().clone());
            shortcuts::register(app.handle());
            tray::setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::should_use_x11_backend;

    #[test]
    fn wayland_sessions_with_xwayland_switch_to_x11() {
        assert!(should_use_x11_backend(false, true, true));
        // An explicit GDK_BACKEND wins.
        assert!(!should_use_x11_backend(true, true, true));
        // Pure Wayland without XWayland would fail to open any window on X11.
        assert!(!should_use_x11_backend(false, true, false));
        // Plain X11 sessions need nothing.
        assert!(!should_use_x11_backend(false, false, true));
    }
}

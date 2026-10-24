//! System-wide shortcuts.
//!
//! These work while another app has focus: one toggles the Mini player and one
//! toggles playback. Both go through the same backend authority the tray and
//! windows use, so every surface stays in sync.
//!
//! Registration is best-effort: the desktop may already own one of the
//! combinations, in which case the app logs it and keeps the other shortcut.

use tauri::{AppHandle, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::media::{authority::PlaybackAuthority, platform, poller};
use crate::window::{self, WindowMode, MINI_LABEL};

pub const TOGGLE_MINI: &str = "Ctrl+Alt+M";
pub const TOGGLE_PLAYBACK: &str = "Ctrl+Alt+Space";

const MASK: Modifiers = Modifiers::CONTROL.union(Modifiers::ALT);

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            handle_shortcut(app, shortcut);
        })
        .build()
}

/// Registers the shortcuts once at startup.
pub fn register(app: &AppHandle) {
    for accelerator in [TOGGLE_MINI, TOGGLE_PLAYBACK] {
        if let Err(error) = app.global_shortcut().register(accelerator) {
            eprintln!("[VinylDeck shortcuts] could not register {accelerator}: {error}");
        }
    }
}

fn handle_shortcut(app: &AppHandle, shortcut: &Shortcut) {
    if shortcut.matches(MASK, Code::KeyM) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let target = next_window_mode(&app);
            if let Err(error) = window::set_window_mode(&app, target).await {
                eprintln!("[VinylDeck shortcuts] window mode switch failed: {error}");
            }
        });
        return;
    }

    if shortcut.matches(MASK, Code::Space) {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            let source_id = app
                .try_state::<PlaybackAuthority>()
                .and_then(|authority| authority.selected_source_id());
            if let Err(error) = platform::toggle_play_pause(source_id.as_deref()).await {
                eprintln!("[VinylDeck shortcuts] playback toggle failed: {error}");
            }
            poller::wake_poller();
        });
    }
}

fn next_window_mode(app: &AppHandle) -> WindowMode {
    if app.get_webview_window(MINI_LABEL).is_some() {
        WindowMode::Main
    } else {
        WindowMode::Mini
    }
}

#[cfg(test)]
mod tests {
    use super::{TOGGLE_MINI, TOGGLE_PLAYBACK};
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};

    #[test]
    fn accelerators_parse_to_the_expected_keys() {
        let mini = Shortcut::from_str(TOGGLE_MINI).expect("mini accelerator");
        assert!(mini.matches(Modifiers::CONTROL | Modifiers::ALT, Code::KeyM));

        let playback = Shortcut::from_str(TOGGLE_PLAYBACK).expect("playback accelerator");
        assert!(playback.matches(Modifiers::CONTROL | Modifiers::ALT, Code::Space));
    }
}

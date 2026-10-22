use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Runtime,
};
use tokio::time::{interval, Duration};

use crate::{
    app_lifecycle,
    media::{self, MediaState},
    settings::SettingsState,
    window::{self, WindowMode, MAIN_LABEL, MINI_LABEL},
};

pub const TRAY_ID: &str = "vinyldeck-tray";
pub const MENU_OPEN: &str = "open-vinyldeck";
pub const MENU_MINI: &str = "mini-player";
pub const MENU_PLAY_PAUSE: &str = "play-pause";
pub const MENU_PREVIOUS: &str = "previous";
pub const MENU_NEXT: &str = "next";
pub const MENU_QUIT: &str = "quit";
const TRAY_MEDIA_STATE_MS: u64 = 500;

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, MENU_OPEN, "Open VinylDeck", true, None::<&str>)?;
    let mini = MenuItem::with_id(app, MENU_MINI, "Mini Player", true, None::<&str>)?;
    let play_pause = MenuItem::with_id(app, MENU_PLAY_PAUSE, "Play/Pause", true, None::<&str>)?;
    let previous = MenuItem::with_id(app, MENU_PREVIOUS, "Previous", true, None::<&str>)?;
    let next = MenuItem::with_id(app, MENU_NEXT, "Next", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, "Quit", true, None::<&str>)?;
    let separator_a = PredefinedMenuItem::separator(app)?;
    let separator_b = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &open,
            &mini,
            &separator_a,
            &play_pause,
            &previous,
            &next,
            &separator_b,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("VinylDeck")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_OPEN => set_tray_window_mode(app, WindowMode::Main),
            MENU_MINI => set_tray_window_mode(app, WindowMode::Mini),
            MENU_PLAY_PAUSE => control_media_from_tray(app, TrayMediaAction::TogglePlayPause),
            MENU_PREVIOUS => control_media_from_tray(app, TrayMediaAction::Previous),
            MENU_NEXT => control_media_from_tray(app, TrayMediaAction::Next),
            MENU_QUIT => app_lifecycle::quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                set_tray_window_mode(tray.app_handle(), WindowMode::Main);
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let tray = builder.build(app)?;
    start_tray_media_state_loop(
        app.handle().clone(),
        tray,
        play_pause.clone(),
        previous.clone(),
        next.clone(),
    );

    Ok(())
}

pub fn handle_window_close(window: &tauri::Window, event: &tauri::WindowEvent) {
    let tauri::WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    match close_request_action(window.label(), should_quit_to_tray(window.app_handle())) {
        CloseRequestAction::AllowClose => {}
        CloseRequestAction::Quit => {
            api.prevent_close();
            app_lifecycle::quit(window.app_handle());
        }
        CloseRequestAction::HideToTray => {
            api.prevent_close();
            if let Err(error) = window.hide() {
                eprintln!(
                    "[VinylDeck tray] failed to hide {} on close request: {error}",
                    window.label()
                );
            }
        }
    }
}

fn should_hide_to_tray(label: &str) -> bool {
    matches!(label, MAIN_LABEL | MINI_LABEL)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CloseRequestAction {
    AllowClose,
    HideToTray,
    Quit,
}

fn close_request_action(label: &str, quit_to_tray: bool) -> CloseRequestAction {
    if !should_hide_to_tray(label) {
        return CloseRequestAction::AllowClose;
    }

    if quit_to_tray {
        CloseRequestAction::HideToTray
    } else {
        CloseRequestAction::Quit
    }
}

fn should_quit_to_tray(app: &AppHandle) -> bool {
    app.try_state::<SettingsState>()
        .map(|state| tauri::async_runtime::block_on(state.snapshot()).quit_to_tray)
        .unwrap_or(true)
}

fn set_tray_window_mode(app: &AppHandle, mode: WindowMode) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = window::set_window_mode(&app, mode).await {
            eprintln!("[VinylDeck tray] failed to set window mode: {error}");
        }
    });
}

#[derive(Debug, Clone, Copy)]
enum TrayMediaAction {
    TogglePlayPause,
    Previous,
    Next,
}

fn control_media_from_tray(app: &AppHandle, action: TrayMediaAction) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let Some(state) = app.try_state::<MediaState>() else {
            eprintln!("[VinylDeck tray] media state unavailable for tray control");
            return;
        };

        match action {
            TrayMediaAction::TogglePlayPause => {
                media::commands::media_toggle_play_pause(&app, &state).await;
            }
            TrayMediaAction::Previous => {
                media::commands::media_previous(&app, &state).await;
            }
            TrayMediaAction::Next => {
                media::commands::media_next(&app, &state).await;
            }
        }
    });
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrayPresentation {
    play_pause_text: &'static str,
    controls_enabled: bool,
    skip_enabled: bool,
    tooltip: String,
}

fn start_tray_media_state_loop<R: Runtime>(
    app: AppHandle<R>,
    tray: TrayIcon<R>,
    play_pause: MenuItem<R>,
    previous: MenuItem<R>,
    next: MenuItem<R>,
) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = interval(Duration::from_millis(TRAY_MEDIA_STATE_MS));
        let mut last: Option<TrayPresentation> = None;

        loop {
            ticker.tick().await;
            let Some(state) = app.try_state::<MediaState>() else {
                continue;
            };

            let snapshot = state.snapshot().await;
            let presentation = TrayPresentation {
                play_pause_text: if snapshot.is_playing { "Pause" } else { "Play" },
                controls_enabled: snapshot.can_control,
                skip_enabled: snapshot.can_skip,
                tooltip: tray_tooltip(&snapshot.track, &snapshot.artist, &snapshot.source_name),
            };

            if last.as_ref() == Some(&presentation) {
                continue;
            }

            let _ = play_pause.set_text(presentation.play_pause_text);
            let _ = play_pause.set_enabled(presentation.controls_enabled);
            let _ = previous.set_enabled(presentation.skip_enabled);
            let _ = next.set_enabled(presentation.skip_enabled);
            let _ = tray.set_tooltip(Some(&presentation.tooltip));
            last = Some(presentation);
        }
    });
}

fn tray_tooltip(track: &str, artist: &str, source_name: &str) -> String {
    if !track.is_empty() && !artist.is_empty() {
        format!("VinylDeck - {track} by {artist}")
    } else if !track.is_empty() {
        format!("VinylDeck - {track}")
    } else if !source_name.is_empty() {
        format!("VinylDeck - {source_name}")
    } else {
        "VinylDeck".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{close_request_action, should_hide_to_tray, tray_tooltip, CloseRequestAction};
    use crate::window::{MAIN_LABEL, MINI_LABEL};

    #[test]
    fn close_to_tray_applies_only_to_player_windows() {
        assert!(should_hide_to_tray(MAIN_LABEL));
        assert!(should_hide_to_tray(MINI_LABEL));
        assert!(!should_hide_to_tray("settings"));
        assert!(!should_hide_to_tray("devtools"));
    }

    #[test]
    fn close_action_respects_quit_to_tray_setting() {
        assert_eq!(
            close_request_action(MAIN_LABEL, true),
            CloseRequestAction::HideToTray
        );
        assert_eq!(
            close_request_action(MAIN_LABEL, false),
            CloseRequestAction::Quit
        );
        assert_eq!(
            close_request_action("devtools", false),
            CloseRequestAction::AllowClose
        );
    }

    #[test]
    fn tray_tooltip_falls_back_across_media_metadata() {
        assert_eq!(
            tray_tooltip("Track", "Artist", "Spotify"),
            "VinylDeck - Track by Artist"
        );
        assert_eq!(tray_tooltip("Track", "", "Spotify"), "VinylDeck - Track");
        assert_eq!(tray_tooltip("", "", "Spotify"), "VinylDeck - Spotify");
        assert_eq!(tray_tooltip("", "", ""), "VinylDeck");
    }
}

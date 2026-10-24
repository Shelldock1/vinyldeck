use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, Runtime,
};

use tokio::sync::watch;

use crate::{
    app_lifecycle,
    i18n::Language,
    media::{authority::PlaybackAuthority, model::MediaSnapshot, platform, poller},
    settings::SettingsState,
    window::{self, WindowMode, MAIN_LABEL, MINI_LABEL},
};

pub const TRAY_ID: &str = "vinyldeck-tray";
pub const MENU_OPEN: &str = "open-vinyldeck";
pub const MENU_MINI: &str = "mini-player";
pub const MENU_PLAY_PAUSE: &str = "play-pause";
pub const MENU_PREVIOUS: &str = "previous";
pub const MENU_NEXT: &str = "next";
pub const MENU_SHUFFLE: &str = "shuffle";
pub const MENU_REPEAT: &str = "repeat";
pub const MENU_QUIT: &str = "quit";

/// Tray menu labels for one language.
#[derive(Debug, PartialEq, Eq)]
struct TrayText {
    open: &'static str,
    mini: &'static str,
    play_pause: &'static str,
    play: &'static str,
    pause: &'static str,
    previous: &'static str,
    next: &'static str,
    shuffle: &'static str,
    repeat: &'static str,
    quit: &'static str,
}

const TRAY_TEXT_EN: TrayText = TrayText {
    open: "Open VinylDeck",
    mini: "Mini Player",
    play_pause: "Play/Pause",
    play: "Play",
    pause: "Pause",
    previous: "Previous",
    next: "Next",
    shuffle: "Shuffle",
    repeat: "Repeat",
    quit: "Quit",
};

const TRAY_TEXT_RU: TrayText = TrayText {
    open: "Открыть VinylDeck",
    mini: "Мини-плеер",
    play_pause: "Воспроизвести/пауза",
    play: "Воспроизвести",
    pause: "Пауза",
    previous: "Предыдущий",
    next: "Следующий",
    shuffle: "Перемешать",
    repeat: "Повтор",
    quit: "Выйти",
};

fn tray_text(language: Language) -> &'static TrayText {
    match language {
        Language::En => &TRAY_TEXT_EN,
        Language::Ru => &TRAY_TEXT_RU,
    }
}

/// Live tray language; settings updates push into it and the tray loop
/// relabels the menu.
pub struct TrayLanguage(watch::Sender<Language>);

/// Called by the settings authority whenever `language` may have changed.
pub fn set_language(app: &AppHandle, setting: &str) {
    if let Some(state) = app.try_state::<TrayLanguage>() {
        let language = Language::resolve(setting);
        state.0.send_if_modified(|current| {
            let changed = *current != language;
            *current = language;
            changed
        });
    }
}

#[derive(Clone)]
struct TrayItems<R: Runtime> {
    open: MenuItem<R>,
    mini: MenuItem<R>,
    play_pause: MenuItem<R>,
    previous: MenuItem<R>,
    next: MenuItem<R>,
    shuffle: CheckMenuItem<R>,
    repeat: CheckMenuItem<R>,
    quit: MenuItem<R>,
}

impl<R: Runtime> TrayItems<R> {
    fn apply_labels(&self, text: &TrayText) {
        let _ = self.open.set_text(text.open);
        let _ = self.mini.set_text(text.mini);
        let _ = self.previous.set_text(text.previous);
        let _ = self.next.set_text(text.next);
        let _ = self.shuffle.set_text(text.shuffle);
        let _ = self.repeat.set_text(text.repeat);
        let _ = self.quit.set_text(text.quit);
    }
}

pub fn setup_tray(app: &mut App) -> tauri::Result<()> {
    let language = app
        .try_state::<SettingsState>()
        .map(|state| Language::resolve(&tauri::async_runtime::block_on(state.snapshot()).language))
        .unwrap_or(Language::En);
    let text = tray_text(language);
    let open = MenuItem::with_id(app, MENU_OPEN, text.open, true, None::<&str>)?;
    let mini = MenuItem::with_id(app, MENU_MINI, text.mini, true, None::<&str>)?;
    let play_pause = MenuItem::with_id(app, MENU_PLAY_PAUSE, text.play_pause, true, None::<&str>)?;
    let previous = MenuItem::with_id(app, MENU_PREVIOUS, text.previous, true, None::<&str>)?;
    let next = MenuItem::with_id(app, MENU_NEXT, text.next, true, None::<&str>)?;
    let shuffle =
        CheckMenuItem::with_id(app, MENU_SHUFFLE, text.shuffle, true, false, None::<&str>)?;
    let repeat = CheckMenuItem::with_id(app, MENU_REPEAT, text.repeat, true, false, None::<&str>)?;
    let quit = MenuItem::with_id(app, MENU_QUIT, text.quit, true, None::<&str>)?;
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
            &shuffle,
            &repeat,
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
            MENU_SHUFFLE => control_mode_from_tray(app, TrayModeAction::ToggleShuffle),
            MENU_REPEAT => control_mode_from_tray(app, TrayModeAction::ToggleRepeat),
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
    let (language_tx, language_rx) = watch::channel(language);
    app.manage(TrayLanguage(language_tx));
    start_tray_media_state_loop(
        app.handle().clone(),
        tray,
        TrayItems {
            open,
            mini,
            play_pause,
            previous,
            next,
            shuffle,
            repeat,
            quit,
        },
        language_rx,
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
    // The poller picks up the new state and feeds PlaybackAuthority, which
    // refreshes the tray and the frontend. Transport commands target the
    // explicit player choice, or the current snapshot's source for Auto.
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let source_id = app
            .try_state::<PlaybackAuthority>()
            .and_then(|authority| authority.selected_source_id());
        let result = match action {
            TrayMediaAction::TogglePlayPause => {
                platform::toggle_play_pause(source_id.as_deref()).await
            }
            TrayMediaAction::Previous => platform::previous(source_id.as_deref()).await,
            TrayMediaAction::Next => platform::next(source_id.as_deref()).await,
        };
        poller::wake_poller();
        if let Err(error) = result {
            eprintln!("[VinylDeck tray] media control failed: {error}");
        }
    });
}

#[derive(Debug, Clone, Copy)]
enum TrayModeAction {
    ToggleShuffle,
    ToggleRepeat,
}

fn control_mode_from_tray(app: &AppHandle, action: TrayModeAction) {
    let app = app.clone();
    let snapshot = app
        .try_state::<PlaybackAuthority>()
        .and_then(|authority| authority.snapshot());
    let source_id = app
        .try_state::<PlaybackAuthority>()
        .and_then(|authority| authority.selected_source_id());
    let shuffle = snapshot.as_ref().is_some_and(|snapshot| snapshot.shuffle);
    let repeat_mode = snapshot
        .as_ref()
        .map(|snapshot| snapshot.repeat_mode.clone())
        .unwrap_or_else(|| "off".to_string());

    tauri::async_runtime::spawn(async move {
        let result = match action {
            TrayModeAction::ToggleShuffle => {
                platform::set_shuffle(!shuffle, source_id.as_deref()).await
            }
            TrayModeAction::ToggleRepeat => {
                // off -> all -> off; a second click on "one" also turns it off.
                let next_mode = if repeat_mode == "off" { "all" } else { "off" };
                platform::set_repeat(next_mode, source_id.as_deref()).await
            }
        };
        poller::wake_poller();
        if let Err(error) = result {
            eprintln!("[VinylDeck tray] media mode control failed: {error}");
        }
    });
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct TrayPresentation {
    language: Language,
    play_pause_text: &'static str,
    controls_enabled: bool,
    skip_enabled: bool,
    shuffle_enabled: bool,
    shuffle_checked: bool,
    repeat_enabled: bool,
    repeat_checked: bool,
    tooltip: String,
}

fn tray_presentation(snapshot: Option<&MediaSnapshot>, language: Language) -> TrayPresentation {
    let text = tray_text(language);
    match snapshot {
        Some(snapshot) => TrayPresentation {
            language,
            play_pause_text: if snapshot.is_playing {
                text.pause
            } else {
                text.play
            },
            controls_enabled: snapshot.can_control,
            skip_enabled: snapshot.can_skip,
            shuffle_enabled: snapshot.can_shuffle,
            shuffle_checked: snapshot.can_shuffle && snapshot.shuffle,
            repeat_enabled: snapshot.can_repeat,
            repeat_checked: snapshot.can_repeat && snapshot.repeat_mode != "off",
            tooltip: tray_tooltip(&snapshot.track, &snapshot.artist, &snapshot.source_name),
        },
        None => TrayPresentation {
            language,
            play_pause_text: text.play_pause,
            controls_enabled: false,
            skip_enabled: false,
            shuffle_enabled: false,
            shuffle_checked: false,
            repeat_enabled: false,
            repeat_checked: false,
            tooltip: tray_tooltip("", "", ""),
        },
    }
}

fn start_tray_media_state_loop<R: Runtime>(
    app: AppHandle<R>,
    tray: TrayIcon<R>,
    items: TrayItems<R>,
    mut language_rx: watch::Receiver<Language>,
) {
    let Some(authority) = app.try_state::<PlaybackAuthority>() else {
        eprintln!("[VinylDeck tray] playback authority unavailable");
        return;
    };
    let mut receiver = authority.subscribe();

    tauri::async_runtime::spawn(async move {
        let mut last: Option<TrayPresentation> = None;

        loop {
            let language = *language_rx.borrow_and_update();
            let presentation = tray_presentation(receiver.borrow_and_update().as_ref(), language);

            if last.as_ref() != Some(&presentation) {
                if last.as_ref().map(|last| last.language) != Some(language) {
                    items.apply_labels(tray_text(language));
                }
                let _ = items.play_pause.set_text(presentation.play_pause_text);
                let _ = items.play_pause.set_enabled(presentation.controls_enabled);
                let _ = items.previous.set_enabled(presentation.skip_enabled);
                let _ = items.next.set_enabled(presentation.skip_enabled);
                let _ = items.shuffle.set_enabled(presentation.shuffle_enabled);
                let _ = items.shuffle.set_checked(presentation.shuffle_checked);
                let _ = items.repeat.set_enabled(presentation.repeat_enabled);
                let _ = items.repeat.set_checked(presentation.repeat_checked);
                let _ = tray.set_tooltip(Some(&presentation.tooltip));
                last = Some(presentation);
            }

            tokio::select! {
                changed = receiver.changed() => {
                    if changed.is_err() {
                        break;
                    }
                }
                changed = language_rx.changed() => {
                    if changed.is_err() {
                        break;
                    }
                }
            }
        }
    });
}

fn tray_tooltip(track: &str, artist: &str, source_name: &str) -> String {
    if !track.is_empty() && !artist.is_empty() {
        format!("VinylDeck - {track} \u{2014} {artist}")
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
    use super::{
        close_request_action, should_hide_to_tray, tray_presentation, tray_text, tray_tooltip,
        CloseRequestAction,
    };
    use crate::i18n::Language;
    use crate::media::model::MediaSnapshot;
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
            "VinylDeck - Track \u{2014} Artist"
        );
        assert_eq!(tray_tooltip("Track", "", "Spotify"), "VinylDeck - Track");
        assert_eq!(tray_tooltip("", "", "Spotify"), "VinylDeck - Spotify");
        assert_eq!(tray_tooltip("", "", ""), "VinylDeck");
    }

    #[test]
    fn tray_presentation_follows_authority_snapshot() {
        let idle = tray_presentation(None, Language::En);
        assert_eq!(idle.tooltip, "VinylDeck");
        assert!(!idle.controls_enabled);
        assert!(!idle.skip_enabled);
        assert!(!idle.shuffle_enabled);
        assert!(!idle.shuffle_checked);
        assert!(!idle.repeat_enabled);
        assert!(!idle.repeat_checked);

        let playing = MediaSnapshot {
            track: "Track".to_string(),
            artist: "Artist".to_string(),
            is_playing: true,
            can_control: true,
            can_skip: false,
            ..MediaSnapshot::default()
        };
        let presentation = tray_presentation(Some(&playing), Language::En);
        assert_eq!(presentation.play_pause_text, "Pause");
        assert_eq!(presentation.tooltip, "VinylDeck - Track \u{2014} Artist");
        assert!(presentation.controls_enabled);
        assert!(!presentation.skip_enabled);
        assert!(!presentation.shuffle_enabled);
        assert!(!presentation.repeat_enabled);

        let paused = MediaSnapshot {
            is_playing: false,
            ..playing
        };
        assert_eq!(
            tray_presentation(Some(&paused), Language::En).play_pause_text,
            "Play"
        );
    }

    #[test]
    fn tray_mode_items_follow_capability_and_state() {
        let modes = MediaSnapshot {
            can_shuffle: true,
            shuffle: true,
            can_repeat: true,
            repeat_mode: "all".to_string(),
            ..MediaSnapshot::default()
        };
        let presentation = tray_presentation(Some(&modes), Language::En);
        assert!(presentation.shuffle_enabled);
        assert!(presentation.shuffle_checked);
        assert!(presentation.repeat_enabled);
        assert!(presentation.repeat_checked);

        let one = MediaSnapshot {
            repeat_mode: "one".to_string(),
            ..modes.clone()
        };
        assert!(tray_presentation(Some(&one), Language::En).repeat_checked);

        let off = MediaSnapshot {
            repeat_mode: "off".to_string(),
            shuffle: false,
            ..modes
        };
        let off_presentation = tray_presentation(Some(&off), Language::En);
        assert!(off_presentation.repeat_enabled);
        assert!(!off_presentation.repeat_checked);
        assert!(off_presentation.shuffle_enabled);
        assert!(!off_presentation.shuffle_checked);

        let unsupported = MediaSnapshot {
            shuffle: true,
            repeat_mode: "all".to_string(),
            ..MediaSnapshot::default()
        };
        let unsupported_presentation = tray_presentation(Some(&unsupported), Language::En);
        assert!(!unsupported_presentation.shuffle_enabled);
        assert!(!unsupported_presentation.shuffle_checked);
        assert!(!unsupported_presentation.repeat_enabled);
        assert!(!unsupported_presentation.repeat_checked);
    }

    #[test]
    fn tray_speaks_russian() {
        let playing = MediaSnapshot {
            track: "Track".to_string(),
            is_playing: true,
            ..MediaSnapshot::default()
        };
        assert_eq!(
            tray_presentation(Some(&playing), Language::Ru).play_pause_text,
            "Пауза"
        );
        assert_eq!(tray_text(Language::Ru).quit, "Выйти");
        assert_eq!(tray_text(Language::En).quit, "Quit");
    }
}

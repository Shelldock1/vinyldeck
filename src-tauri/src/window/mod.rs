use std::str::FromStr;

use tauri::{
    window::{Effect, EffectsBuilder},
    AppHandle, LogicalSize, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::settings::SettingsState;

pub(crate) const MAIN_LABEL: &str = "main";
pub(crate) const MINI_LABEL: &str = "mini";

/// Mini starts at the approved 280px square and can only shrink from there.
const MINI_MIN_WIDTH: f64 = 140.0;
const MINI_MIN_HEIGHT: f64 = 140.0;
const MINI_MAX_WIDTH: f64 = 280.0;
const MINI_MAX_HEIGHT: f64 = 280.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum WindowMode {
    Main,
    Fullscreen,
    Mini,
}

impl FromStr for WindowMode {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "main" => Ok(Self::Main),
            "fullscreen" => Ok(Self::Fullscreen),
            "mini" => Ok(Self::Mini),
            other => Err(format!("Unknown window mode: {other}")),
        }
    }
}

#[tauri::command]
pub async fn cmd_set_window_mode(app: AppHandle, mode: String) -> Result<(), String> {
    window_debug_log(&format!("cmd_set_window_mode requested: {mode}"));
    set_window_mode(&app, WindowMode::from_str(&mode)?).await
}

#[tauri::command]
pub fn cmd_set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    for label in [MAIN_LABEL, MINI_LABEL] {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_always_on_top(enabled)
                .map_err(|error| error.to_string())?;
        }
    }

    Ok(())
}

pub(crate) async fn set_window_mode(app: &AppHandle, mode: WindowMode) -> Result<(), String> {
    match mode {
        WindowMode::Main => show_main(app),
        WindowMode::Fullscreen => show_fullscreen(app),
        WindowMode::Mini => show_mini(app).await,
    }
}

fn show_main(app: &AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        mini.destroy().map_err(|error| error.to_string())?;
    }

    let main = app
        .get_webview_window(MAIN_LABEL)
        .ok_or_else(|| "Main window not found".to_string())?;

    main.set_fullscreen(false)
        .map_err(|error| error.to_string())?;
    main.set_decorations(true)
        .map_err(|error| error.to_string())?;
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

fn show_fullscreen(app: &AppHandle) -> Result<(), String> {
    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        mini.destroy().map_err(|error| error.to_string())?;
    }

    let main = app
        .get_webview_window(MAIN_LABEL)
        .ok_or_else(|| "Main window not found".to_string())?;

    main.show().map_err(|error| error.to_string())?;
    main.set_decorations(false)
        .map_err(|error| error.to_string())?;
    main.set_fullscreen(true)
        .map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

async fn show_mini(app: &AppHandle) -> Result<(), String> {
    window_debug_log("show_mini: start");

    let transparent = should_apply_mini_transparency(app).await;

    let mini = match app.get_webview_window(MINI_LABEL) {
        Some(window) => {
            window_debug_log("show_mini: reusing existing mini window");
            apply_mini_resize_bounds(&window);
            apply_mini_transparency(&window, transparent);
            window
        }
        None => {
            window_debug_log("show_mini: building mini window at app URL index.html");

            // Mini is always created shrink-resizable and
            // always created transparent-capable so the Mini Transparency
            // setting can be toggled at runtime without recreating the
            // window. When the setting is off, opaque CSS in MiniView paints
            // over the transparency so nothing changes visually.
            let mut builder =
                WebviewWindowBuilder::new(app, MINI_LABEL, WebviewUrl::App("index.html".into()))
                    .title("VinylDeck Mini")
                    .inner_size(280.0, 280.0)
                    .min_inner_size(MINI_MIN_WIDTH, MINI_MIN_HEIGHT)
                    .max_inner_size(MINI_MAX_WIDTH, MINI_MAX_HEIGHT)
                    .resizable(true)
                    .decorations(false)
                    .transparent(true)
                    .always_on_top(true)
                    .skip_taskbar(true);

            if transparent {
                builder = builder.effects(EffectsBuilder::new().effect(Effect::Acrylic).build());
            }

            builder.build().map_err(|error| error.to_string())?
        }
    };
    window_debug_log("show_mini: mini window ready");

    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        window_debug_log("show_mini: hiding main window");
        main.hide().map_err(|error| error.to_string())?;
    }

    match mini.url() {
        Ok(url) => window_debug_log(&format!("show_mini: current url {url}")),
        Err(error) => window_debug_log(&format!("show_mini: url read failed: {error}")),
    }

    mini.show().map_err(|error| error.to_string())?;
    window_debug_log("show_mini: shown");
    mini.set_focus().map_err(|error| error.to_string())?;
    window_debug_log("show_mini: focused");

    Ok(())
}

fn apply_mini_resize_bounds(window: &WebviewWindow) {
    let min_size = LogicalSize::new(MINI_MIN_WIDTH, MINI_MIN_HEIGHT);
    let max_size = LogicalSize::new(MINI_MAX_WIDTH, MINI_MAX_HEIGHT);

    if let Err(error) = window.set_min_size(Some(min_size)) {
        eprintln!("[VinylDeck window] failed to apply mini min size: {error}");
    }
    if let Err(error) = window.set_max_size(Some(max_size)) {
        eprintln!("[VinylDeck window] failed to apply mini max size: {error}");
    }
}

/// Applies or clears the Mini-only Acrylic blur-through effect on an
/// already-built Mini window. Safe to call any time the Mini Transparency
/// setting changes, whether or not Mini currently exists (callers should
/// check `get_webview_window` first).
pub(crate) fn apply_mini_transparency(window: &WebviewWindow, enabled: bool) {
    if enabled {
        if let Err(error) =
            window.set_effects(EffectsBuilder::new().effect(Effect::Acrylic).build())
        {
            eprintln!("[VinylDeck window] failed to apply mini acrylic effect: {error}");
        }
    } else if let Err(error) = window.set_effects(None) {
        eprintln!("[VinylDeck window] failed to clear mini acrylic effect: {error}");
    }
}

/// Reads the persisted Mini Transparency setting. This is called from inside
/// an already-async command/task (`cmd_set_window_mode`, the tray's spawned
/// task), so it awaits the settings snapshot directly instead of using
/// `tauri::async_runtime::block_on`, which would panic with "Cannot start a
/// runtime from within a runtime" in that context.
async fn should_apply_mini_transparency(app: &AppHandle) -> bool {
    match app.try_state::<SettingsState>() {
        Some(state) => state.snapshot().await.mini_transparent_mode,
        None => false,
    }
}

fn window_debug_log(_message: &str) {
    #[cfg(debug_assertions)]
    println!("[VinylDeck window] {_message}");
}

#[cfg(test)]
mod tests {
    use super::WindowMode;
    use std::str::FromStr;

    #[test]
    fn parses_valid_modes() {
        assert_eq!(WindowMode::from_str("main"), Ok(WindowMode::Main));
        assert_eq!(
            WindowMode::from_str("fullscreen"),
            Ok(WindowMode::Fullscreen)
        );
        assert_eq!(WindowMode::from_str("mini"), Ok(WindowMode::Mini));
    }

    #[test]
    fn rejects_invalid_modes() {
        assert_eq!(
            WindowMode::from_str("compact"),
            Err("Unknown window mode: compact".to_string())
        );
    }
}

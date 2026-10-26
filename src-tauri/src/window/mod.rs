use std::str::FromStr;

use tauri::{
    window::{Effect, EffectsBuilder},
    AppHandle, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::settings::SettingsState;

pub(crate) const MAIN_LABEL: &str = "main";
pub(crate) const MINI_LABEL: &str = "mini";

/// Mini starts at the approved 280px square and can only shrink from there.
const MINI_MIN_WIDTH: f64 = 140.0;
const MINI_MIN_HEIGHT: f64 = 140.0;
const MINI_MAX_WIDTH: f64 = 280.0;
const MINI_MAX_HEIGHT: f64 = 280.0;

/// Gap between the Mini window and the monitor working area edge.
const MINI_SCREEN_MARGIN: f64 = 16.0;

/// Largest share of the monitor working area the main window opens at.
const MAIN_MAX_WORK_AREA_SHARE: f64 = 0.92;

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

/// The "Always on top" setting is for Main. Mini is a floating companion and
/// always stays on top, so this never touches it.
#[tauri::command]
pub fn cmd_set_always_on_top(app: AppHandle, enabled: bool) -> Result<(), String> {
    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        main.set_always_on_top(enabled)
            .map_err(|error| error.to_string())?;
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

/// Brings the running instance forward when a second launch is attempted.
/// A visible main window (windowed or fullscreen) keeps its mode; otherwise
/// this follows the tray "Open VinylDeck" path so mini closes and main shows.
pub(crate) fn focus_existing(app: &AppHandle) {
    if let Some(main) = app.get_webview_window(MAIN_LABEL) {
        let in_mini = app.get_webview_window(MINI_LABEL).is_some();
        if !in_mini && main.is_visible().unwrap_or(false) {
            let _ = main.unminimize();
            let _ = main.set_focus();
            return;
        }
    }

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = set_window_mode(&app, WindowMode::Main).await {
            eprintln!("[VinylDeck] failed to focus existing instance: {error}");
        }
    });
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
    main.set_decorations(false)
        .map_err(|error| error.to_string())?;
    // Leaving fullscreen keeps the old (screen-sized) placement, which can put
    // the window partly off-screen. Re-center on the way back to windowed mode.
    main.center().map_err(|error| error.to_string())?;
    main.show().map_err(|error| error.to_string())?;
    main.set_focus().map_err(|error| error.to_string())?;

    Ok(())
}

/// Shrinks the main window at launch when its configured size does not fit the
/// monitor working area (small laptop screens, large DPI scales, panels), then
/// re-centers it. The deck itself scales to fit whatever size results.
pub(crate) fn fit_main_to_monitor(app: &AppHandle) {
    let Some(main) = app.get_webview_window(MAIN_LABEL) else {
        return;
    };
    let monitor = main
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| main.primary_monitor().ok().flatten());
    let (Some(monitor), Ok(size)) = (monitor, main.inner_size()) else {
        return;
    };

    let area = monitor.work_area().size;
    let min = main_min_size(app, monitor.scale_factor());
    let Some(fitted) = fit_within(
        (size.width, size.height),
        (area.width, area.height),
        MAIN_MAX_WORK_AREA_SHARE,
        min,
    ) else {
        return;
    };

    window_debug_log(&format!(
        "fit_main_to_monitor: {}x{} -> {}x{}",
        size.width, size.height, fitted.0, fitted.1
    ));
    if let Err(error) = main.set_size(PhysicalSize::new(fitted.0, fitted.1)) {
        eprintln!("[VinylDeck window] failed to fit main window: {error}");
        return;
    }
    let _ = main.center();
}

/// The configured `minWidth`/`minHeight` of the Main window, in physical pixels.
/// Returns `(0, 0)` when unconfigured so the fit stays unclamped.
fn main_min_size(app: &AppHandle, scale_factor: f64) -> (u32, u32) {
    app.config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_LABEL)
        .and_then(|window| window.min_width.zip(window.min_height))
        .map(|(width, height)| {
            (
                (width * scale_factor).round() as u32,
                (height * scale_factor).round() as u32,
            )
        })
        .unwrap_or((0, 0))
}

/// Returns the clamped size when `size` exceeds `share` of `area`, else None.
/// The configured `min` always wins: the result never goes below it, even when
/// the working area itself is smaller than the minimum.
fn fit_within(
    size: (u32, u32),
    area: (u32, u32),
    share: f64,
    min: (u32, u32),
) -> Option<(u32, u32)> {
    if area.0 == 0 || area.1 == 0 {
        return None;
    }
    let max_width = (f64::from(area.0) * share).floor() as u32;
    let max_height = (f64::from(area.1) * share).floor() as u32;
    // Prefer the minimum over the share, per the explicit 700x560 requirement.
    let max_width = max_width.max(min.0);
    let max_height = max_height.max(min.1);
    if size.0 <= max_width && size.1 <= max_height {
        return None;
    }
    Some((size.0.min(max_width), size.1.min(max_height)))
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

    // Mini is a floating companion: it must stay above regular windows even if
    // the persisted "always on top" setting (which is meant for Main) is off.
    mini.set_always_on_top(true)
        .map_err(|error| error.to_string())?;

    mini.show().map_err(|error| error.to_string())?;
    window_debug_log("show_mini: shown");
    mini.set_focus().map_err(|error| error.to_string())?;
    window_debug_log("show_mini: focused");

    // Pin it to the bottom-right corner of the working area. Done after show()
    // so the monitor the window landed on is already known.
    place_mini_bottom_right(app, &mini);

    Ok(())
}

/// Docks the Mini window to the bottom-right corner of the monitor it sits on,
/// inset by [`MINI_SCREEN_MARGIN`] from the working area (so panels/taskbars do
/// not cover it). Uses physical pixels, so it stays put across DPI scales.
fn place_mini_bottom_right(app: &AppHandle, window: &WebviewWindow) {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| {
            app.get_webview_window(MAIN_LABEL)
                .and_then(|main| main.current_monitor().ok().flatten())
        })
        .or_else(|| window.primary_monitor().ok().flatten());

    let Some(monitor) = monitor else {
        eprintln!("[VinylDeck window] mini placement skipped: no monitor");
        return;
    };

    // `outer_size` on X11 includes GTK's invisible client-side frame budget,
    // which is larger than the actual frameless window; the content size is
    // what has to sit on the screen.
    let Ok(size) = window.inner_size() else {
        eprintln!("[VinylDeck window] mini placement skipped: unknown window size");
        return;
    };

    let area = monitor.work_area();
    let margin = (MINI_SCREEN_MARGIN * monitor.scale_factor()).round() as i32;
    let x = area.position.x + area.size.width as i32 - size.width as i32 - margin;
    let y = area.position.y + area.size.height as i32 - size.height as i32 - margin;

    if let Err(error) = window.set_position(PhysicalPosition::new(x, y)) {
        eprintln!("[VinylDeck window] failed to place mini window: {error}");
    }
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
    use super::{fit_within, WindowMode};
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

    /// The Main minimum read from `tauri.conf.json` (the same source production
    /// reads through the app config), so tests do not duplicate the numbers.
    fn configured_main_min() -> (u32, u32) {
        let config: serde_json::Value = serde_json::from_str(include_str!("../../tauri.conf.json"))
            .expect("tauri.conf.json should parse");
        let main = config["app"]["windows"]
            .as_array()
            .and_then(|windows| windows.iter().find(|window| window["label"] == "main"))
            .expect("main window config should exist");
        (
            main["minWidth"].as_u64().expect("minWidth should be set") as u32,
            main["minHeight"].as_u64().expect("minHeight should be set") as u32,
        )
    }

    #[test]
    fn main_window_only_shrinks_when_it_does_not_fit() {
        let min = configured_main_min();
        assert_eq!(fit_within((1000, 860), (1920, 1040), 0.92, min), None);
        assert_eq!(
            fit_within((1000, 860), (1366, 728), 0.92, min),
            Some((1000, 669))
        );
        assert_eq!(fit_within((1000, 860), (0, 0), 0.92, min), None);
    }

    #[test]
    fn main_fit_keeps_the_92_percent_share_above_the_minimum() {
        let min = configured_main_min();
        // Normal monitors: 92% is well above the minimum, so nothing shrinks.
        assert_eq!(fit_within((1000, 860), (2560, 1440), 0.92, min), None);
        // 92% of 728px is 669px, still above the minimum height.
        assert_eq!(
            fit_within((1000, 860), (1366, 728), 0.92, min),
            Some((1000, 669))
        );
    }

    #[test]
    fn main_fit_never_goes_below_the_minimum_on_a_small_work_area() {
        let min = configured_main_min();
        // 92% of 600px is 552px, which would undercut the minimum height.
        assert_eq!(
            fit_within((1000, 860), (1280, 600), 0.92, min),
            Some((1000, min.1))
        );
        // A work area smaller than the minimum still yields the minimum.
        assert_eq!(fit_within((1000, 860), (600, 480), 0.92, min), Some(min));
    }

    #[test]
    fn main_fit_leaves_an_already_small_size_alone() {
        let min = configured_main_min();
        // Smaller than both the working area and the minimum: nothing to shrink.
        assert_eq!(fit_within((600, 500), (640, 480), 0.92, min), None);
        // Already at the minimum: the fit must not request anything smaller.
        assert_eq!(fit_within(min, (640, 480), 0.92, min), None);
    }
}

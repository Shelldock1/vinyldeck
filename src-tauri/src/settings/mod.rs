use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

use crate::i18n::{LANGUAGES, LANGUAGE_AUTO};
use crate::media::authority::PlaybackAuthority;
use crate::window::{self, MINI_LABEL};

pub const SETTINGS_CHANGED_EVENT: &str = "settings-changed";

const STORE_FILE: &str = "settings.json";
const STORE_KEY: &str = "settings";
const VERSION: u8 = 4;
const MAX_SOURCE_TEXT_CHARS: usize = 256;
const MAX_DISCORD_CLIENT_ID_CHARS: usize = 32;

const SHELL_THEMES: &[&str] = &["noir", "glass"];
const SCHEMES: &[&str] = &["light", "dark", "halloween"];
const LEGACY_THEMES: &[&str] = &["noir", "glass", "aurora", "vapor", "paper"];
const WINDOW_MODES: &[&str] = &["main", "fullscreen", "mini"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PersistedSettings {
    pub version: u8,
    pub theme: String,
    /// Colour scheme layered over the shell: light | dark | halloween.
    /// "dark" leaves the shell tokens untouched.
    pub scheme: String,
    pub ambient_mode: String,
    /// Legacy compatibility. Derived from ambient_mode but kept in payloads so
    /// older frontend callers/tests do not fail abruptly during migration.
    pub art_ambient: bool,
    pub vinyl_wobble: bool,
    pub film_grain: bool,
    pub lean_back_mode: bool,
    pub cursor_hide: bool,
    pub idle_timeout_seconds: u8,
    pub always_on_top: bool,
    pub keyboard_shortcuts_enabled: bool,
    pub quit_to_tray: bool,
    pub start_with_windows: bool,
    pub window_mode: String,
    /// Mini-only: applies a native Windows Acrylic blur-through effect on the
    /// Mini window and lets its own background go fully transparent.
    pub mini_transparent_mode: bool,
    /// Stable media-session id the deck follows. Empty means Auto.
    pub player_source_id: String,
    /// Display fallback for the selected session (kept even when it is not
    /// currently running).
    pub player_source_name: String,
    /// Discord application id for Rich Presence. Empty disables the feature;
    /// there is no generic id that can be shipped, so the user supplies one.
    pub discord_client_id: String,
    /// UI language: `"auto"` (follow the OS), `"en"`, or `"ru"`.
    pub language: String,
}

impl Default for PersistedSettings {
    fn default() -> Self {
        Self {
            version: VERSION,
            theme: "noir".to_string(),
            scheme: "dark".to_string(),
            ambient_mode: "off".to_string(),
            art_ambient: false,
            vinyl_wobble: true,
            film_grain: true,
            lean_back_mode: true,
            cursor_hide: true,
            idle_timeout_seconds: 3,
            always_on_top: false,
            keyboard_shortcuts_enabled: true,
            quit_to_tray: true,
            start_with_windows: false,
            window_mode: "main".to_string(),
            mini_transparent_mode: false,
            player_source_id: String::new(),
            player_source_name: String::new(),
            discord_client_id: String::new(),
            language: LANGUAGE_AUTO.to_string(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub theme: Option<String>,
    pub scheme: Option<String>,
    pub ambient_mode: Option<String>,
    pub art_ambient: Option<bool>,
    pub vinyl_wobble: Option<bool>,
    pub film_grain: Option<bool>,
    pub lean_back_mode: Option<bool>,
    pub cursor_hide: Option<bool>,
    pub idle_timeout_seconds: Option<u8>,
    pub always_on_top: Option<bool>,
    pub keyboard_shortcuts_enabled: Option<bool>,
    pub quit_to_tray: Option<bool>,
    pub start_with_windows: Option<bool>,
    pub window_mode: Option<String>,
    pub mini_transparent_mode: Option<bool>,
    pub player_source_id: Option<String>,
    pub player_source_name: Option<String>,
    pub discord_client_id: Option<String>,
    pub language: Option<String>,
}

pub struct SettingsState {
    settings: Mutex<PersistedSettings>,
}

impl SettingsState {
    pub fn new() -> Self {
        Self {
            settings: Mutex::new(PersistedSettings::default()),
        }
    }

    pub async fn snapshot(&self) -> PersistedSettings {
        self.settings.lock().await.clone()
    }

    async fn replace(&self, settings: PersistedSettings) {
        *self.settings.lock().await = settings;
    }

    /// Atomically applies a settings patch inside a single lock hold so
    /// concurrent updates (Main + Mini windows) cannot read-modify-write
    /// stale values and clobber each other.
    pub async fn update(
        &self,
        app: &AppHandle,
        patch: SettingsPatch,
    ) -> Result<PersistedSettings, String> {
        let mut settings = self.settings.lock().await;
        let current = settings.clone();
        let next = apply_patch(&current, patch);
        *settings = next.clone();
        drop(settings);

        if next.start_with_windows != current.start_with_windows {
            sync_start_with_windows(app, next.start_with_windows)?;
        }
        sync_authority_selection(app, &next);
        save_settings(app, &next)?;
        sync_mini_transparency(app, &next, &current);
        if next.language != current.language {
            crate::tray::set_language(app, &next.language);
        }
        emit_settings_changed(app, &next);

        Ok(next)
    }

    /// Atomically resets to defaults inside a single lock hold (see `update`).
    pub async fn reset(&self, app: &AppHandle) -> Result<PersistedSettings, String> {
        let mut settings = self.settings.lock().await;
        let current = settings.clone();
        let next = PersistedSettings::default();
        *settings = next.clone();
        drop(settings);

        sync_start_with_windows(app, next.start_with_windows)?;
        sync_authority_selection(app, &next);
        save_settings(app, &next)?;
        sync_mini_transparency(app, &next, &current);
        crate::tray::set_language(app, &next.language);
        emit_settings_changed(app, &next);

        Ok(next)
    }
}

pub async fn initialize_settings(app: AppHandle) -> Result<(), String> {
    let settings = load_settings(&app)?;
    if let Err(error) = sync_start_with_windows(&app, settings.start_with_windows) {
        eprintln!("[VinylDeck settings] Failed to restore autostart: {error}");
    }
    app.state::<SettingsState>().replace(settings.clone()).await;
    sync_authority_selection(&app, &settings);
    save_settings(&app, &settings)?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_settings_snapshot(
    state: State<'_, SettingsState>,
) -> Result<PersistedSettings, String> {
    Ok(state.snapshot().await)
}

#[tauri::command]
pub async fn cmd_settings_update(
    app: AppHandle,
    state: State<'_, SettingsState>,
    patch: SettingsPatch,
) -> Result<PersistedSettings, String> {
    state.update(&app, patch).await
}

#[tauri::command]
pub async fn cmd_settings_reset(
    app: AppHandle,
    state: State<'_, SettingsState>,
) -> Result<PersistedSettings, String> {
    state.reset(&app).await
}

fn load_settings(app: &AppHandle) -> Result<PersistedSettings, String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    Ok(validate_settings(store.get(STORE_KEY)))
}

fn save_settings(app: &AppHandle, settings: &PersistedSettings) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let value = serde_json::to_value(settings).map_err(|error| error.to_string())?;
    store.set(STORE_KEY, value);
    store.save().map_err(|error| error.to_string())
}

fn emit_settings_changed(app: &AppHandle, settings: &PersistedSettings) {
    let _ = app.emit(SETTINGS_CHANGED_EVENT, settings);
}

/// Mirrors the persisted player choice into the playback authority so the
/// poller and transport commands never read settings directly.
fn sync_authority_selection(app: &AppHandle, settings: &PersistedSettings) {
    if let Some(authority) = app.try_state::<PlaybackAuthority>() {
        authority.set_selection(Some(settings.player_source_id.clone()));
    }
}

/// Keeps the live Mini window's Acrylic effect in sync with the persisted
/// setting. No-op if Mini is not currently open, and only touches the OS
/// window when the value actually changed.
fn sync_mini_transparency(
    app: &AppHandle,
    settings: &PersistedSettings,
    previous: &PersistedSettings,
) {
    if settings.mini_transparent_mode == previous.mini_transparent_mode {
        return;
    }

    if let Some(mini) = app.get_webview_window(MINI_LABEL) {
        window::apply_mini_transparency(&mini, settings.mini_transparent_mode);
    }
}

fn validate_settings(value: Option<Value>) -> PersistedSettings {
    let Some(Value::Object(raw)) = value else {
        return PersistedSettings::default();
    };

    let defaults = PersistedSettings::default();
    let legacy_theme = read_string_choice(raw.get("theme"), LEGACY_THEMES)
        .unwrap_or_else(|| defaults.theme.clone());
    let theme = if SHELL_THEMES.contains(&legacy_theme.as_str()) {
        legacy_theme.clone()
    } else {
        shell_from_legacy_theme(&legacy_theme).to_string()
    };
    let art_ambient = read_bool(raw.get("artAmbient"), false);
    let ambient_mode = normalize_ambient_mode(raw.get("ambientMode"))
        .unwrap_or_else(|| ambient_from_legacy_theme(&legacy_theme, art_ambient).to_string());
    let window_mode = read_string_choice(raw.get("windowMode"), WINDOW_MODES)
        .unwrap_or_else(|| defaults.window_mode.clone());

    PersistedSettings {
        version: VERSION,
        theme,
        scheme: read_string_choice(raw.get("scheme"), SCHEMES)
            .unwrap_or_else(|| defaults.scheme.clone()),
        art_ambient: ambient_mode != "off",
        ambient_mode,
        vinyl_wobble: read_bool(raw.get("vinylWobble"), defaults.vinyl_wobble),
        film_grain: read_bool(raw.get("filmGrain"), defaults.film_grain),
        lean_back_mode: read_bool(raw.get("leanBackMode"), defaults.lean_back_mode),
        cursor_hide: read_bool(raw.get("cursorHide"), defaults.cursor_hide),
        idle_timeout_seconds: read_idle_timeout(raw.get("idleTimeoutSeconds")),
        always_on_top: read_bool(raw.get("alwaysOnTop"), defaults.always_on_top),
        keyboard_shortcuts_enabled: read_bool(
            raw.get("keyboardShortcutsEnabled"),
            defaults.keyboard_shortcuts_enabled,
        ),
        quit_to_tray: read_bool(raw.get("quitToTray"), defaults.quit_to_tray),
        start_with_windows: read_bool(raw.get("startWithWindows"), defaults.start_with_windows),
        window_mode,
        mini_transparent_mode: read_bool(
            raw.get("miniTransparentMode"),
            defaults.mini_transparent_mode,
        ),
        player_source_id: read_source_text(raw.get("playerSourceId")),
        player_source_name: read_source_text(raw.get("playerSourceName")),
        discord_client_id: read_discord_client_id(raw.get("discordClientId")),
        language: read_string_choice(raw.get("language"), LANGUAGES)
            .unwrap_or_else(|| defaults.language.clone()),
    }
}

fn apply_patch(current: &PersistedSettings, patch: SettingsPatch) -> PersistedSettings {
    let mut next = current.clone();

    if let Some(theme) = patch
        .theme
        .filter(|value| SHELL_THEMES.contains(&value.as_str()))
    {
        next.theme = theme;
    }
    if let Some(scheme) = patch
        .scheme
        .filter(|value| SCHEMES.contains(&value.as_str()))
    {
        next.scheme = scheme;
    }
    if let Some(mode) = patch
        .ambient_mode
        .and_then(|value| normalize_ambient_mode_string(&value))
    {
        next.ambient_mode = mode;
    } else if let Some(value) = patch.art_ambient {
        next.ambient_mode = if value { "beam" } else { "off" }.to_string();
    }
    if let Some(value) = patch.vinyl_wobble {
        next.vinyl_wobble = value;
    }
    if let Some(value) = patch.film_grain {
        next.film_grain = value;
    }
    if let Some(value) = patch.lean_back_mode {
        next.lean_back_mode = value;
    }
    if let Some(value) = patch.cursor_hide {
        next.cursor_hide = value;
    }
    if let Some(value) = patch.idle_timeout_seconds {
        next.idle_timeout_seconds = value.clamp(1, 5);
    }
    if let Some(value) = patch.always_on_top {
        next.always_on_top = value;
    }
    if let Some(value) = patch.keyboard_shortcuts_enabled {
        next.keyboard_shortcuts_enabled = value;
    }
    if let Some(value) = patch.quit_to_tray {
        next.quit_to_tray = value;
    }
    if let Some(value) = patch.start_with_windows {
        next.start_with_windows = value;
    }
    if let Some(window_mode) = patch
        .window_mode
        .filter(|value| WINDOW_MODES.contains(&value.as_str()))
    {
        if window_mode != "mini" {
            next.window_mode = window_mode;
        }
    }
    if let Some(value) = patch.mini_transparent_mode {
        next.mini_transparent_mode = value;
    }
    if let Some(value) = patch.player_source_id {
        next.player_source_id = normalize_source_text(&value);
    }
    if let Some(value) = patch.player_source_name {
        next.player_source_name = normalize_source_text(&value);
    }
    if let Some(value) = patch.discord_client_id {
        next.discord_client_id = normalize_discord_client_id(&value);
    }
    if let Some(language) = patch
        .language
        .filter(|value| LANGUAGES.contains(&value.as_str()))
    {
        next.language = language;
    }

    next.art_ambient = next.ambient_mode != "off";
    next.version = VERSION;
    next
}

fn sync_start_with_windows(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable()
    } else {
        autostart.disable()
    }
    .map_err(|error| error.to_string())
}

fn shell_from_legacy_theme(theme: &str) -> &'static str {
    match theme {
        "glass" | "paper" => "glass",
        _ => "noir",
    }
}

fn ambient_from_legacy_theme(theme: &str, art_ambient: bool) -> &'static str {
    match theme {
        "aurora" | "vapor" => "beam",
        "noir" if art_ambient => "beam",
        _ => "off",
    }
}

fn normalize_ambient_mode(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?;
    normalize_ambient_mode_string(value)
}

fn normalize_ambient_mode_string(value: &str) -> Option<String> {
    match value {
        "off" => Some("off".to_string()),
        "beam" | "caustic" | "aurora" => Some("beam".to_string()),
        _ => None,
    }
}

fn read_string_choice(value: Option<&Value>, choices: &[&str]) -> Option<String> {
    let value = value?.as_str()?;
    choices.contains(&value).then(|| value.to_string())
}

fn read_bool(value: Option<&Value>, fallback: bool) -> bool {
    value.and_then(Value::as_bool).unwrap_or(fallback)
}

fn read_idle_timeout(value: Option<&Value>) -> u8 {
    value
        .and_then(Value::as_u64)
        .map(|value| value.clamp(1, 5) as u8)
        .unwrap_or(PersistedSettings::default().idle_timeout_seconds)
}

fn read_source_text(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .map(normalize_source_text)
        .unwrap_or_default()
}

fn read_discord_client_id(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .map(normalize_discord_client_id)
        .unwrap_or_default()
}

/// Discord application ids are numeric snowflakes. Dropping anything else here
/// keeps a pasted URL or a stray keypress from producing an invalid handshake.
fn normalize_discord_client_id(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(char::is_ascii_digit)
        .take(MAX_DISCORD_CLIENT_ID_CHARS)
        .collect()
}

fn normalize_source_text(value: &str) -> String {
    value.trim().chars().take(MAX_SOURCE_TEXT_CHARS).collect()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{apply_patch, validate_settings, PersistedSettings, SettingsPatch};

    #[test]
    fn validates_bad_settings_to_safe_defaults() {
        let settings = validate_settings(Some(json!({
            "version": 999,
            "theme": "bogus",
            "ambientMode": "laser",
            "artAmbient": "yes",
            "vinylWobble": "yes",
            "filmGrain": false,
            "leanBackMode": true,
            "cursorHide": false,
            "idleTimeoutSeconds": 99,
            "alwaysOnTop": true,
            "keyboardShortcutsEnabled": "no",
            "quitToTray": "no",
            "startWithWindows": "no",
            "windowMode": "bad",
            "miniTransparentMode": "no"
        })));

        assert_eq!(settings.theme, "noir");
        assert_eq!(settings.scheme, "dark");
        assert_eq!(settings.ambient_mode, "off");
        assert!(!settings.art_ambient);
        assert!(settings.vinyl_wobble);
        assert!(!settings.film_grain);
        assert_eq!(settings.idle_timeout_seconds, 5);
        assert!(settings.keyboard_shortcuts_enabled);
        assert!(settings.quit_to_tray);
        assert!(!settings.start_with_windows);
        assert_eq!(settings.window_mode, "main");
        assert!(!settings.mini_transparent_mode);
        assert_eq!(settings.player_source_id, "");
        assert_eq!(settings.player_source_name, "");
        assert_eq!(settings.discord_client_id, "");
        assert_eq!(settings.version, 4);
    }

    #[test]
    fn migrates_legacy_themes_to_shell_and_ambient_modes() {
        let aurora = validate_settings(Some(json!({ "theme": "aurora" })));
        assert_eq!(aurora.theme, "noir");
        assert_eq!(aurora.ambient_mode, "beam");
        assert!(aurora.art_ambient);

        let paper = validate_settings(Some(json!({ "theme": "paper" })));
        assert_eq!(paper.theme, "glass");
        assert_eq!(paper.ambient_mode, "off");
    }

    #[test]
    fn legacy_art_ambient_maps_to_studio_beam() {
        let settings = validate_settings(Some(json!({
            "theme": "noir",
            "artAmbient": true
        })));

        assert_eq!(settings.theme, "noir");
        assert_eq!(settings.ambient_mode, "beam");
        assert!(settings.art_ambient);
    }

    #[test]
    fn patch_clamps_timeout_and_keeps_mini_out_of_persistence() {
        let current = PersistedSettings {
            window_mode: "fullscreen".to_string(),
            ..PersistedSettings::default()
        };
        let settings = apply_patch(
            &current,
            SettingsPatch {
                idle_timeout_seconds: Some(0),
                window_mode: Some("mini".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(settings.idle_timeout_seconds, 1);
        assert_eq!(settings.window_mode, "fullscreen");
    }

    #[test]
    fn patch_ambient_mode_and_legacy_art_ambient() {
        let current = PersistedSettings::default();
        let caustic = apply_patch(
            &current,
            SettingsPatch {
                ambient_mode: Some("caustic".to_string()),
                ..SettingsPatch::default()
            },
        );
        let off = apply_patch(
            &caustic,
            SettingsPatch {
                art_ambient: Some(false),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(caustic.ambient_mode, "beam");
        assert!(caustic.art_ambient);
        assert_eq!(off.ambient_mode, "off");
        assert!(!off.art_ambient);
    }

    #[test]
    fn reopen_persists_only_main_or_fullscreen_window_modes() {
        let current = PersistedSettings::default();
        let fullscreen = apply_patch(
            &current,
            SettingsPatch {
                window_mode: Some("fullscreen".to_string()),
                ..SettingsPatch::default()
            },
        );
        let mini_attempt = apply_patch(
            &fullscreen,
            SettingsPatch {
                window_mode: Some("mini".to_string()),
                ..SettingsPatch::default()
            },
        );
        let main = apply_patch(
            &mini_attempt,
            SettingsPatch {
                window_mode: Some("main".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(fullscreen.window_mode, "fullscreen");
        assert_eq!(mini_attempt.window_mode, "fullscreen");
        assert_eq!(main.window_mode, "main");
    }

    #[test]
    fn discord_client_id_keeps_digits_only() {
        let settings = validate_settings(Some(json!({
            "discordClientId": " 1234-5678-9012 "
        })));
        assert_eq!(settings.discord_client_id, "123456789012");

        let patched = apply_patch(
            &PersistedSettings::default(),
            SettingsPatch {
                discord_client_id: Some("abc 42 99".to_string()),
                ..SettingsPatch::default()
            },
        );
        assert_eq!(patched.discord_client_id, "4299");
    }

    #[test]
    fn patch_scheme_accepts_only_known_values() {
        let current = PersistedSettings::default();
        let halloween = apply_patch(
            &current,
            SettingsPatch {
                scheme: Some("halloween".to_string()),
                ..SettingsPatch::default()
            },
        );
        let bogus = apply_patch(
            &halloween,
            SettingsPatch {
                scheme: Some("neon".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(halloween.scheme, "halloween");
        assert_eq!(halloween.theme, "noir");
        assert_eq!(bogus.scheme, "halloween");
        assert_eq!(
            validate_settings(Some(json!({ "scheme": "light" }))).scheme,
            "light"
        );
    }

    #[test]
    fn patch_interaction_toggles() {
        let current = PersistedSettings::default();
        let settings = apply_patch(
            &current,
            SettingsPatch {
                keyboard_shortcuts_enabled: Some(false),
                quit_to_tray: Some(false),
                start_with_windows: Some(true),
                ..SettingsPatch::default()
            },
        );

        assert!(!settings.keyboard_shortcuts_enabled);
        assert!(!settings.quit_to_tray);
        assert!(settings.start_with_windows);
    }

    #[test]
    fn patch_toggles_mini_transparent_mode() {
        let current = PersistedSettings::default();
        assert!(!current.mini_transparent_mode);

        let settings = apply_patch(
            &current,
            SettingsPatch {
                mini_transparent_mode: Some(true),
                ..SettingsPatch::default()
            },
        );

        assert!(settings.mini_transparent_mode);
    }

    #[test]
    fn validates_and_trims_player_source_fields() {
        let settings = validate_settings(Some(json!({
            "playerSourceId": "  org.mpris.MediaPlayer2.spotify  ",
            "playerSourceName": "  Spotify  ",
            "version": 2
        })));

        assert_eq!(settings.player_source_id, "org.mpris.MediaPlayer2.spotify");
        assert_eq!(settings.player_source_name, "Spotify");
        assert_eq!(settings.version, 4);

        let long = "x".repeat(400);
        let clamped = validate_settings(Some(json!({
            "playerSourceId": long,
            "playerSourceName": "  ",
        })));
        assert_eq!(clamped.player_source_id.chars().count(), 256);
        assert_eq!(clamped.player_source_name, "");
    }

    #[test]
    fn patch_player_source_and_auto_reset() {
        let current = PersistedSettings::default();
        let selected = apply_patch(
            &current,
            SettingsPatch {
                player_source_id: Some("  Spotify.exe  ".to_string()),
                player_source_name: Some("  Spotify  ".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(selected.player_source_id, "Spotify.exe");
        assert_eq!(selected.player_source_name, "Spotify");

        let auto = apply_patch(
            &selected,
            SettingsPatch {
                player_source_id: Some("".to_string()),
                player_source_name: Some("".to_string()),
                ..SettingsPatch::default()
            },
        );

        assert_eq!(auto.player_source_id, "");
        assert_eq!(auto.player_source_name, "");
    }

    #[test]
    fn language_accepts_only_known_values() {
        assert_eq!(PersistedSettings::default().language, "auto");
        assert_eq!(
            validate_settings(Some(json!({ "language": "ru" }))).language,
            "ru"
        );
        assert_eq!(
            validate_settings(Some(json!({ "language": "klingon" }))).language,
            "auto"
        );

        let patched = apply_patch(
            &PersistedSettings::default(),
            SettingsPatch {
                language: Some("en".to_string()),
                ..SettingsPatch::default()
            },
        );
        assert_eq!(patched.language, "en");
        let ignored = apply_patch(
            &patched,
            SettingsPatch {
                language: Some("de".to_string()),
                ..SettingsPatch::default()
            },
        );
        assert_eq!(ignored.language, "en");
    }

    /// Every persisted field has to survive the store round trip: the file is
    /// written on one launch and read back by `validate_settings` on the next.
    #[test]
    fn persisted_settings_round_trip_without_losing_fields() {
        let settings = PersistedSettings {
            version: 4,
            theme: "glass".to_string(),
            scheme: "halloween".to_string(),
            ambient_mode: "beam".to_string(),
            art_ambient: true,
            vinyl_wobble: false,
            film_grain: false,
            lean_back_mode: false,
            cursor_hide: false,
            idle_timeout_seconds: 5,
            always_on_top: true,
            keyboard_shortcuts_enabled: false,
            quit_to_tray: false,
            start_with_windows: true,
            window_mode: "fullscreen".to_string(),
            mini_transparent_mode: true,
            player_source_id: "SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify".to_string(),
            player_source_name: "Spotify".to_string(),
            discord_client_id: "123456789012345678".to_string(),
            language: "ru".to_string(),
        };

        let stored = serde_json::to_value(&settings).expect("settings serialize");
        let reloaded = validate_settings(Some(stored));

        assert_eq!(reloaded, settings);
    }

    /// The oldest file in the wild (version 2) is missing scheme, language,
    /// Mini transparency, player source and Discord. Upgrading must keep the
    /// known values and fill the new ones with safe defaults.
    #[test]
    fn version_two_settings_file_upgrades_without_losing_values() {
        let reloaded = validate_settings(Some(json!({
            "version": 2,
            "theme": "glass",
            "ambientMode": "beam",
            "artAmbient": true,
            "vinylWobble": false,
            "filmGrain": false,
            "leanBackMode": false,
            "cursorHide": false,
            "idleTimeoutSeconds": 4,
            "alwaysOnTop": true,
            "keyboardShortcutsEnabled": false,
            "quitToTray": false,
            "startWithWindows": false,
            "windowMode": "fullscreen"
        })));

        assert_eq!(reloaded.version, 4);
        assert_eq!(reloaded.theme, "glass");
        assert_eq!(reloaded.scheme, "dark");
        assert_eq!(reloaded.ambient_mode, "beam");
        assert!(!reloaded.vinyl_wobble);
        assert_eq!(reloaded.idle_timeout_seconds, 4);
        assert!(reloaded.always_on_top);
        assert!(!reloaded.keyboard_shortcuts_enabled);
        assert!(!reloaded.quit_to_tray);
        assert_eq!(reloaded.window_mode, "fullscreen");
        assert!(!reloaded.mini_transparent_mode);
        assert_eq!(reloaded.player_source_id, "");
        assert_eq!(reloaded.player_source_name, "");
        assert_eq!(reloaded.discord_client_id, "");
        assert_eq!(reloaded.language, "auto");
    }
}

//! The Crate: every album VinylDeck plays is "pressed" into a persistent
//! collection. The frontend supplies the visual identity (pressing recipe,
//! colors, a tiny label thumbnail); the backend owns the records, assigns
//! pressing numbers, and counts plays from the media poller so several
//! windows can never double count.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

pub mod listen;
mod wrapped;

pub const COLLECTION_CHANGED_EVENT: &str = "collection-changed";

const STORE_FILE: &str = "collection.json";
const STORE_KEY: &str = "records";
const HISTORY_KEY: &str = "history";
const MAX_RECORDS: usize = 5_000;
const MAX_THUMBNAIL_LEN: usize = 48 * 1024;
const MAX_TEXT_LEN: usize = 512;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PressingColors {
    pub primary: String,
    pub secondary: String,
    pub accent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CollectedRecord {
    pub key: String,
    pub album: String,
    pub artist: String,
    pub pressing_number: u32,
    /// Unix epoch milliseconds.
    pub first_pressed_at: u64,
    pub last_played_at: Option<u64>,
    pub play_count: u32,
    /// None until the frontend has derived the pressing (a play can be
    /// counted before artwork arrives).
    pub recipe: Option<String>,
    pub pressing_type: Option<String>,
    pub pressing_name: Option<String>,
    pub colors: Option<PressingColors>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PressInput {
    pub artist: String,
    pub album: String,
    pub recipe: String,
    pub pressing_type: String,
    pub pressing_name: String,
    pub colors: PressingColors,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PressResult {
    pub record: CollectedRecord,
    /// True when this call gave the album its pressing for the first time.
    pub newly_pressed: bool,
}

pub struct CollectionState {
    records: Mutex<Vec<CollectedRecord>>,
    history: Mutex<Vec<wrapped::PlayEvent>>,
}

impl CollectionState {
    pub fn new() -> Self {
        Self {
            records: Mutex::new(Vec::new()),
            history: Mutex::new(Vec::new()),
        }
    }
}

pub fn initialize_collection(app: &AppHandle) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let records = validate_records(store.get(STORE_KEY));
    let history = wrapped::validate_history(store.get(HISTORY_KEY));
    let state = app.state::<CollectionState>();
    tauri::async_runtime::block_on(async {
        *state.records.lock().await = records;
        *state.history.lock().await = history;
    });
    Ok(())
}

#[tauri::command]
pub async fn cmd_collection_snapshot(
    state: State<'_, CollectionState>,
) -> Result<Vec<CollectedRecord>, String> {
    Ok(state.records.lock().await.clone())
}

#[tauri::command]
pub async fn cmd_collection_press(
    app: AppHandle,
    state: State<'_, CollectionState>,
    input: PressInput,
) -> Result<PressResult, String> {
    let mut records = state.records.lock().await;
    let result = press(&mut records, input, now_millis())?;
    save_records(&app, &records)?;
    drop(records);
    emit_record_changed(&app, &result.record);
    Ok(result)
}

/// Called by the media poller once a listen crosses the scrobble threshold.
pub async fn record_play(app: &AppHandle, artist: &str, album: &str, track: &str) {
    let state = app.state::<CollectionState>();
    let now = now_millis();
    let mut records = state.records.lock().await;
    let Some(record) = count_play(&mut records, artist, album, track, now) else {
        return;
    };

    let mut history = state.history.lock().await;
    history.push(wrapped::PlayEvent {
        at: now,
        artist: clip(artist.trim()),
        album: clip(album.trim()),
        track: clip(track.trim()),
    });
    if history.len() > wrapped::MAX_HISTORY {
        let excess = history.len() - wrapped::MAX_HISTORY;
        history.drain(..excess);
    }

    if let Err(error) = save_collection(app, &records, &history) {
        eprintln!("[VinylDeck crate] failed to save play: {error}");
    }
    drop(history);
    drop(records);
    emit_record_changed(app, &record);
}

#[tauri::command]
pub async fn cmd_collection_wrapped(
    state: State<'_, CollectionState>,
    month: Option<String>,
) -> Result<wrapped::WrappedStats, String> {
    let records = state.records.lock().await.clone();
    let history = state.history.lock().await.clone();
    Ok(wrapped::build_wrapped(
        &records,
        &history,
        month.as_deref(),
        now_millis(),
    ))
}

/// Shared identity with the frontend pressing seed: artist + (album or track).
pub fn record_key(artist: &str, album: &str, track: &str) -> Option<String> {
    let artist = artist.trim().to_lowercase();
    let album = album.trim();
    let title = if album.is_empty() {
        track.trim()
    } else {
        album
    }
    .to_lowercase();
    if title.is_empty() {
        return None;
    }
    Some(format!("{artist}|{title}"))
}

pub(crate) fn press(
    records: &mut Vec<CollectedRecord>,
    input: PressInput,
    now: u64,
) -> Result<PressResult, String> {
    let key = record_key(&input.artist, &input.album, "")
        .ok_or_else(|| "cannot press a record without an album or track".to_string())?;
    let thumbnail = input.thumbnail.filter(|value| is_valid_thumbnail(value));

    if let Some(record) = records.iter_mut().find(|record| record.key == key) {
        let newly_pressed = record.recipe.is_none();
        if newly_pressed {
            record.recipe = Some(clip(&input.recipe));
            record.pressing_type = Some(clip(&input.pressing_type));
            record.pressing_name = Some(clip(&input.pressing_name));
            record.colors = Some(clip_colors(input.colors));
        }
        if record.thumbnail.is_none() {
            record.thumbnail = thumbnail;
        }
        return Ok(PressResult {
            record: record.clone(),
            newly_pressed,
        });
    }

    if records.len() >= MAX_RECORDS {
        return Err("collection is full".to_string());
    }

    let record = CollectedRecord {
        key,
        album: clip(input.album.trim()),
        artist: clip(input.artist.trim()),
        pressing_number: next_pressing_number(records),
        first_pressed_at: now,
        last_played_at: None,
        play_count: 0,
        recipe: Some(clip(&input.recipe)),
        pressing_type: Some(clip(&input.pressing_type)),
        pressing_name: Some(clip(&input.pressing_name)),
        colors: Some(clip_colors(input.colors)),
        thumbnail,
    };
    records.push(record.clone());
    Ok(PressResult {
        record,
        newly_pressed: true,
    })
}

fn count_play(
    records: &mut Vec<CollectedRecord>,
    artist: &str,
    album: &str,
    track: &str,
    now: u64,
) -> Option<CollectedRecord> {
    let key = record_key(artist, album, track)?;

    if let Some(record) = records.iter_mut().find(|record| record.key == key) {
        record.play_count = record.play_count.saturating_add(1);
        record.last_played_at = Some(now);
        return Some(record.clone());
    }

    if records.len() >= MAX_RECORDS {
        return None;
    }

    // Stub until the frontend presses it (no artwork seen yet).
    let title = if album.trim().is_empty() {
        track
    } else {
        album
    };
    let record = CollectedRecord {
        key,
        album: clip(title.trim()),
        artist: clip(artist.trim()),
        pressing_number: next_pressing_number(records),
        first_pressed_at: now,
        last_played_at: Some(now),
        play_count: 1,
        recipe: None,
        pressing_type: None,
        pressing_name: None,
        colors: None,
        thumbnail: None,
    };
    records.push(record.clone());
    Some(record)
}

fn next_pressing_number(records: &[CollectedRecord]) -> u32 {
    records
        .iter()
        .map(|record| record.pressing_number)
        .max()
        .unwrap_or(0)
        .saturating_add(1)
}

fn save_records(app: &AppHandle, records: &[CollectedRecord]) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    let value = serde_json::to_value(records).map_err(|error| error.to_string())?;
    store.set(STORE_KEY, value);
    store.save().map_err(|error| error.to_string())
}

fn save_collection(
    app: &AppHandle,
    records: &[CollectedRecord],
    history: &[wrapped::PlayEvent],
) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|error| error.to_string())?;
    store.set(
        STORE_KEY,
        serde_json::to_value(records).map_err(|error| error.to_string())?,
    );
    store.set(
        HISTORY_KEY,
        serde_json::to_value(history).map_err(|error| error.to_string())?,
    );
    store.save().map_err(|error| error.to_string())
}

fn emit_record_changed(app: &AppHandle, record: &CollectedRecord) {
    let _ = app.emit(COLLECTION_CHANGED_EVENT, record);
}

fn validate_records(value: Option<Value>) -> Vec<CollectedRecord> {
    let Some(Value::Array(items)) = value else {
        return Vec::new();
    };

    let mut records: Vec<CollectedRecord> = Vec::new();
    for item in items {
        let Ok(mut record) = serde_json::from_value::<CollectedRecord>(item) else {
            continue;
        };
        if record.key.is_empty() || records.iter().any(|known| known.key == record.key) {
            continue;
        }
        if record
            .thumbnail
            .as_deref()
            .is_some_and(|value| !is_valid_thumbnail(value))
        {
            record.thumbnail = None;
        }
        records.push(record);
        if records.len() >= MAX_RECORDS {
            break;
        }
    }
    records
}

fn is_valid_thumbnail(value: &str) -> bool {
    value.len() <= MAX_THUMBNAIL_LEN && value.starts_with("data:image/")
}

pub(super) fn clip(value: &str) -> String {
    value.chars().take(MAX_TEXT_LEN).collect()
}

fn clip_colors(colors: PressingColors) -> PressingColors {
    PressingColors {
        primary: clip(&colors.primary),
        secondary: clip(&colors.secondary),
        accent: clip(&colors.accent),
    }
}

fn now_millis() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{count_play, press, record_key, validate_records, PressInput, PressingColors};

    fn input(artist: &str, album: &str) -> PressInput {
        PressInput {
            artist: artist.to_string(),
            album: album.to_string(),
            recipe: "galaxy".to_string(),
            pressing_type: "splatter".to_string(),
            pressing_name: "Galaxy Pressing".to_string(),
            colors: PressingColors {
                primary: "#112233".to_string(),
                secondary: "#445566".to_string(),
                accent: "#778899".to_string(),
            },
            thumbnail: Some("data:image/jpeg;base64,AAAA".to_string()),
        }
    }

    #[test]
    fn key_is_case_insensitive_and_falls_back_to_track() {
        assert_eq!(
            record_key(" Bia ", "We On Go", ""),
            Some("bia|we on go".into())
        );
        assert_eq!(record_key("Bia", "", "Single"), Some("bia|single".into()));
        assert_eq!(record_key("Bia", " ", " "), None);
    }

    #[test]
    fn first_press_numbers_records_and_repress_is_idempotent() {
        let mut records = Vec::new();
        let first = press(&mut records, input("A", "One"), 10).unwrap();
        let second = press(&mut records, input("B", "Two"), 20).unwrap();
        let again = press(&mut records, input("a", "ONE"), 30).unwrap();

        assert!(first.newly_pressed);
        assert_eq!(first.record.pressing_number, 1);
        assert_eq!(second.record.pressing_number, 2);
        assert!(!again.newly_pressed);
        assert_eq!(again.record.first_pressed_at, 10);
        assert_eq!(records.len(), 2);
    }

    #[test]
    fn plays_accumulate_and_stub_records_get_pressed_later() {
        let mut records = Vec::new();
        let stub = count_play(&mut records, "A", "One", "Track", 5).unwrap();
        assert_eq!(stub.play_count, 1);
        assert!(stub.recipe.is_none());

        let pressed = press(&mut records, input("A", "One"), 6).unwrap();
        assert!(pressed.newly_pressed);
        assert_eq!(pressed.record.play_count, 1);
        assert_eq!(pressed.record.recipe.as_deref(), Some("galaxy"));

        let played = count_play(&mut records, "A", "One", "Other", 7).unwrap();
        assert_eq!(played.play_count, 2);
        assert_eq!(played.last_played_at, Some(7));
    }

    #[test]
    fn rejects_oversized_or_foreign_thumbnails() {
        let mut records = Vec::new();
        let mut bad = input("A", "One");
        bad.thumbnail = Some("https://example.com/x.png".to_string());
        let result = press(&mut records, bad, 1).unwrap();
        assert!(result.record.thumbnail.is_none());
    }

    #[test]
    fn validation_drops_garbage_and_duplicates() {
        let records = validate_records(Some(json!([
            { "key": "a|one", "album": "One", "artist": "A", "pressingNumber": 1,
              "firstPressedAt": 1, "lastPlayedAt": null, "playCount": 3,
              "recipe": null, "pressingType": null, "pressingName": null,
              "colors": null, "thumbnail": "javascript:alert(1)" },
            { "key": "a|one", "album": "Dup", "artist": "A", "pressingNumber": 2,
              "firstPressedAt": 1, "lastPlayedAt": null, "playCount": 0,
              "recipe": null, "pressingType": null, "pressingName": null,
              "colors": null, "thumbnail": null },
            { "nonsense": true },
            42
        ])));

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].play_count, 3);
        assert!(records[0].thumbnail.is_none());
        assert!(validate_records(Some(json!({ "not": "a list" }))).is_empty());
    }
}

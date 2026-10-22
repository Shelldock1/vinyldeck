use std::hash::{DefaultHasher, Hash, Hasher};

use serde::{Deserialize, Serialize};

#[allow(dead_code)]
const TICKS_PER_SECOND: f64 = 10_000_000.0;

pub(crate) const REPEAT_MODE_OFF: &str = "off";
pub(crate) const REPEAT_MODE_ALL: &str = "all";
pub(crate) const REPEAT_MODE_ONE: &str = "one";

/// MPRIS `LoopStatus` values are `None`, `Track`, and `Playlist`.
#[allow(dead_code)]
pub(crate) fn repeat_mode_from_mpris(loop_status: &str) -> &'static str {
    match loop_status {
        "Track" => REPEAT_MODE_ONE,
        "Playlist" => REPEAT_MODE_ALL,
        _ => REPEAT_MODE_OFF,
    }
}

/// SMTC `MediaPlaybackAutoRepeatMode` discriminator values.
#[allow(dead_code)]
pub(crate) fn repeat_mode_from_smtc_code(code: i32) -> &'static str {
    match code {
        1 => REPEAT_MODE_ONE,
        2 => REPEAT_MODE_ALL,
        _ => REPEAT_MODE_OFF,
    }
}

#[allow(dead_code)]
pub(crate) fn mpris_loop_status(mode: &str) -> Option<&'static str> {
    match mode {
        REPEAT_MODE_OFF => Some("None"),
        REPEAT_MODE_ALL => Some("Playlist"),
        REPEAT_MODE_ONE => Some("Track"),
        _ => None,
    }
}

#[allow(dead_code)]
pub(crate) fn smtc_auto_repeat_code(mode: &str) -> Option<i32> {
    match mode {
        REPEAT_MODE_OFF => Some(0),
        REPEAT_MODE_ONE => Some(1),
        REPEAT_MODE_ALL => Some(2),
        _ => None,
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSnapshot {
    pub track: String,
    pub artist: String,
    pub album: String,
    pub artwork_data_url: Option<String>,
    pub duration: f64,
    pub position: f64,
    pub is_playing: bool,
    pub source_name: String,
    pub source_id: String,
    pub can_seek: bool,
    pub can_skip: bool,
    pub can_control: bool,
    pub can_repeat: bool,
    pub can_shuffle: bool,
    /// `"off"`, `"all"`, or `"one"`.
    pub repeat_mode: String,
    pub shuffle: bool,
}

/// One selectable media session. `id` is the stable platform handle (MPRIS bus
/// name on Linux, AUMID on Windows); `name` is the display fallback.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPlayer {
    pub id: String,
    pub name: String,
    pub is_playing: bool,
}

/// Removes duplicate ids and orders players the way the picker shows them:
/// playing first, then by display name.
#[allow(dead_code)]
pub(crate) fn order_players(players: Vec<MediaPlayer>) -> Vec<MediaPlayer> {
    let mut unique: Vec<MediaPlayer> = Vec::with_capacity(players.len());
    for player in players {
        if unique.iter().any(|existing| existing.id == player.id) {
            continue;
        }
        unique.push(player);
    }

    unique.sort_by(|left, right| {
        right
            .is_playing
            .cmp(&left.is_playing)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
            .then_with(|| left.id.cmp(&right.id))
    });
    unique
}

impl Default for MediaSnapshot {
    fn default() -> Self {
        Self {
            track: String::new(),
            artist: String::new(),
            album: String::new(),
            artwork_data_url: None,
            duration: 0.0,
            position: 0.0,
            is_playing: false,
            source_name: String::new(),
            source_id: String::new(),
            can_seek: false,
            can_skip: false,
            can_control: false,
            can_repeat: false,
            can_shuffle: false,
            repeat_mode: REPEAT_MODE_OFF.to_string(),
            shuffle: false,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MediaSemanticKey {
    track: String,
    artist: String,
    album: String,
    source_name: String,
    source_id: String,
    duration_millis: u64,
    is_playing: bool,
    can_seek: bool,
    can_skip: bool,
    can_control: bool,
    can_repeat: bool,
    can_shuffle: bool,
    repeat_mode: String,
    shuffle: bool,
    artwork_hash: Option<u64>,
}

/// Position-only payload for periodic resyncs; the full snapshot (and its
/// artwork) is only re-sent when the semantic key changes.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaPosition {
    pub position: f64,
}

impl MediaSnapshot {
    #[allow(dead_code)]
    pub(crate) fn semantic_key(&self) -> MediaSemanticKey {
        MediaSemanticKey {
            track: self.track.clone(),
            artist: self.artist.clone(),
            album: self.album.clone(),
            source_name: self.source_name.clone(),
            source_id: self.source_id.clone(),
            duration_millis: seconds_to_millis(self.duration),
            is_playing: self.is_playing,
            can_seek: self.can_seek,
            can_skip: self.can_skip,
            can_control: self.can_control,
            can_repeat: self.can_repeat,
            can_shuffle: self.can_shuffle,
            repeat_mode: self.repeat_mode.clone(),
            shuffle: self.shuffle,
            artwork_hash: self.artwork_data_url.as_deref().map(hash_str),
        }
    }

    pub(crate) fn media_position(&self) -> MediaPosition {
        MediaPosition {
            position: self.position,
        }
    }
}

fn hash_str(value: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    value.hash(&mut hasher);
    hasher.finish()
}

#[allow(dead_code)]
pub(crate) fn ticks_to_seconds(ticks: i64) -> f64 {
    if ticks <= 0 {
        return 0.0;
    }

    ticks as f64 / TICKS_PER_SECOND
}

#[allow(dead_code)]
pub(crate) fn friendly_source_name(app_id: &str) -> String {
    let lower = app_id.to_lowercase();
    if lower.contains("spotify") {
        return "Spotify".to_string();
    }
    if lower.contains("chrome") {
        return "Chrome".to_string();
    }
    if lower.contains("msedge") || lower.contains("edge") {
        return "Edge".to_string();
    }
    if lower.contains("firefox") {
        return "Firefox".to_string();
    }
    if lower.contains("vlc") {
        return "VLC".to_string();
    }
    if lower.contains("applemusicwin") {
        return "Apple Music".to_string();
    }

    app_id
        .rsplit('\\')
        .next()
        .unwrap_or(app_id)
        .trim_end_matches(".exe")
        .to_string()
}

#[allow(dead_code)]
fn seconds_to_millis(seconds: f64) -> u64 {
    if !seconds.is_finite() || seconds <= 0.0 {
        return 0;
    }

    (seconds * 1000.0).round() as u64
}

#[cfg(test)]
mod tests {
    use super::{
        friendly_source_name, mpris_loop_status, order_players, repeat_mode_from_mpris,
        repeat_mode_from_smtc_code, smtc_auto_repeat_code, ticks_to_seconds, MediaPlayer,
        MediaSnapshot,
    };

    #[test]
    fn empty_snapshot_matches_frontend_empty_contract() {
        let snapshot = MediaSnapshot::default();

        assert_eq!(snapshot.track, "");
        assert_eq!(snapshot.artist, "");
        assert_eq!(snapshot.album, "");
        assert_eq!(snapshot.artwork_data_url, None);
        assert_eq!(snapshot.duration, 0.0);
        assert_eq!(snapshot.position, 0.0);
        assert!(!snapshot.is_playing);
        assert_eq!(snapshot.source_name, "");
        assert_eq!(snapshot.source_id, "");
        assert!(!snapshot.can_seek);
        assert!(!snapshot.can_skip);
        assert!(!snapshot.can_control);
        assert!(!snapshot.can_repeat);
        assert!(!snapshot.can_shuffle);
        assert_eq!(snapshot.repeat_mode, "off");
        assert!(!snapshot.shuffle);
    }

    #[test]
    fn converts_windows_ticks_to_seconds() {
        assert_eq!(ticks_to_seconds(0), 0.0);
        assert_eq!(ticks_to_seconds(-10_000_000), 0.0);
        assert_eq!(ticks_to_seconds(10_000_000), 1.0);
        assert_eq!(ticks_to_seconds(35_450_000_000), 3545.0);
    }

    #[test]
    fn maps_common_source_names() {
        assert_eq!(friendly_source_name("Spotify.exe"), "Spotify");
        assert_eq!(friendly_source_name("chrome.exe"), "Chrome");
        assert_eq!(friendly_source_name("MSEdge.exe"), "Edge");
        assert_eq!(
            friendly_source_name("C:\\Program Files\\VideoLAN\\VLC.exe"),
            "VLC"
        );
        assert_eq!(friendly_source_name("UnknownPlayer.exe"), "UnknownPlayer");
    }

    #[test]
    fn semantic_key_ignores_position_drift() {
        let base = MediaSnapshot {
            track: "A".to_string(),
            artist: "B".to_string(),
            album: "C".to_string(),
            artwork_data_url: Some("data:image/png;base64,AAAA".to_string()),
            duration: 120.0,
            position: 10.0,
            is_playing: true,
            source_name: "Spotify".to_string(),
            source_id: "spotify".to_string(),
            can_seek: true,
            can_skip: true,
            can_control: true,
            can_repeat: true,
            can_shuffle: true,
            repeat_mode: "all".to_string(),
            shuffle: false,
        };
        let mut drifted = base.clone();
        drifted.position = 11.5;

        assert_eq!(base.semantic_key(), drifted.semantic_key());
    }

    #[test]
    fn semantic_key_changes_on_capability_or_track_change() {
        let base = MediaSnapshot {
            track: "A".to_string(),
            artist: "B".to_string(),
            album: "C".to_string(),
            artwork_data_url: None,
            duration: 120.0,
            position: 0.0,
            is_playing: true,
            source_name: "Spotify".to_string(),
            source_id: "spotify".to_string(),
            can_seek: true,
            can_skip: true,
            can_control: true,
            can_repeat: true,
            can_shuffle: true,
            repeat_mode: "off".to_string(),
            shuffle: false,
        };
        let mut next_track = base.clone();
        next_track.track = "D".to_string();
        let mut no_seek = base.clone();
        no_seek.can_seek = false;
        let mut repeat_changed = base.clone();
        repeat_changed.repeat_mode = "one".to_string();
        let mut shuffle_changed = base.clone();
        shuffle_changed.shuffle = true;

        assert_ne!(base.semantic_key(), next_track.semantic_key());
        assert_ne!(base.semantic_key(), no_seek.semantic_key());
        assert_ne!(base.semantic_key(), repeat_changed.semantic_key());
        assert_ne!(base.semantic_key(), shuffle_changed.semantic_key());
    }

    #[test]
    fn maps_repeat_modes_between_platform_values_and_the_ui_contract() {
        assert_eq!(repeat_mode_from_mpris("None"), "off");
        assert_eq!(repeat_mode_from_mpris("Playlist"), "all");
        assert_eq!(repeat_mode_from_mpris("Track"), "one");
        assert_eq!(repeat_mode_from_mpris("unexpected"), "off");

        assert_eq!(repeat_mode_from_smtc_code(0), "off");
        assert_eq!(repeat_mode_from_smtc_code(2), "all");
        assert_eq!(repeat_mode_from_smtc_code(1), "one");
        assert_eq!(repeat_mode_from_smtc_code(99), "off");

        assert_eq!(mpris_loop_status("off"), Some("None"));
        assert_eq!(mpris_loop_status("all"), Some("Playlist"));
        assert_eq!(mpris_loop_status("one"), Some("Track"));
        assert_eq!(mpris_loop_status("repeat"), None);

        assert_eq!(smtc_auto_repeat_code("off"), Some(0));
        assert_eq!(smtc_auto_repeat_code("all"), Some(2));
        assert_eq!(smtc_auto_repeat_code("one"), Some(1));
        assert_eq!(smtc_auto_repeat_code("repeat"), None);
    }

    #[test]
    fn players_are_deduped_and_playing_sessions_sort_first() {
        let players = order_players(vec![
            MediaPlayer {
                id: "vlc".to_string(),
                name: "VLC".to_string(),
                is_playing: false,
            },
            MediaPlayer {
                id: "spotify".to_string(),
                name: "Spotify".to_string(),
                is_playing: true,
            },
            MediaPlayer {
                id: "spotify".to_string(),
                name: "Spotify duplicate".to_string(),
                is_playing: false,
            },
            MediaPlayer {
                id: "chrome".to_string(),
                name: "Chrome".to_string(),
                is_playing: false,
            },
        ]);

        assert_eq!(players.len(), 3);
        assert_eq!(players[0].id, "spotify");
        assert_eq!(players[1].id, "chrome");
        assert_eq!(players[2].id, "vlc");
    }

    #[test]
    fn semantic_key_handles_empty_metadata_and_unknown_duration() {
        let empty_metadata = MediaSnapshot {
            source_name: "Spotify".to_string(),
            source_id: "Spotify.exe".to_string(),
            duration: f64::NAN,
            position: f64::NAN,
            ..MediaSnapshot::default()
        };
        let negative_duration = MediaSnapshot {
            duration: -1.0,
            position: 12.0,
            ..empty_metadata.clone()
        };
        let infinite_duration = MediaSnapshot {
            duration: f64::INFINITY,
            position: 24.0,
            ..empty_metadata.clone()
        };

        assert_eq!(empty_metadata.track, "");
        assert_eq!(empty_metadata.artist, "");
        assert_eq!(empty_metadata.album, "");
        assert_eq!(empty_metadata.artwork_data_url, None);
        assert_eq!(
            empty_metadata.semantic_key(),
            negative_duration.semantic_key()
        );
        assert_eq!(
            empty_metadata.semantic_key(),
            infinite_duration.semantic_key()
        );
    }
}

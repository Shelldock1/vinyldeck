use serde::{Deserialize, Serialize};

#[allow(dead_code)]
const TICKS_PER_SECOND: f64 = 10_000_000.0;

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
    has_artwork: bool,
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
            has_artwork: self.artwork_data_url.is_some(),
        }
    }
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
    use super::{friendly_source_name, ticks_to_seconds, MediaSnapshot};

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
        };
        let mut next_track = base.clone();
        next_track.track = "D".to_string();
        let mut no_seek = base.clone();
        no_seek.can_seek = false;

        assert_ne!(base.semantic_key(), next_track.semantic_key());
        assert_ne!(base.semantic_key(), no_seek.semantic_key());
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

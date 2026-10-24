//! Monthly "Crate Wrapped" statistics.
//!
//! Play counts on the records are cumulative, so the poller also appends a
//! small event per counted listen. This module validates that bounded history
//! and folds one calendar month of it into the numbers the Wrapped card shows.
//! Months are UTC: the app does not otherwise deal in time zones, and a play
//! at midnight on the 1st should never land in two different months depending
//! on where the machine is.

use std::collections::{BTreeSet, HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{clip, record_key, CollectedRecord};

pub const MAX_HISTORY: usize = 10_000;
const TOP_RECORDS: usize = 5;
const MAX_MONTHS: usize = 24;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PlayEvent {
    /// Unix epoch milliseconds.
    pub at: u64,
    pub artist: String,
    pub album: String,
    pub track: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WrappedAlbum {
    pub key: String,
    pub artist: String,
    pub album: String,
    pub plays: u32,
    pub pressing_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WrappedTrack {
    pub track: String,
    pub artist: String,
    pub plays: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WrappedArtist {
    pub artist: String,
    pub plays: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WrappedDay {
    /// YYYY-MM-DD (UTC).
    pub date: String,
    pub plays: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WrappedStats {
    /// YYYY-MM, UTC.
    pub month: String,
    /// Human label, e.g. "October 2026".
    pub label: String,
    pub total_plays: u32,
    pub unique_albums: u32,
    pub unique_artists: u32,
    pub unique_tracks: u32,
    pub top_records: Vec<WrappedAlbum>,
    pub top_track: Option<WrappedTrack>,
    pub top_artist: Option<WrappedArtist>,
    pub rarest: Option<WrappedAlbum>,
    pub busiest_day: Option<WrappedDay>,
    /// Months with at least one play, newest first (max 24).
    pub available_months: Vec<String>,
}

pub fn validate_history(value: Option<Value>) -> Vec<PlayEvent> {
    let Some(Value::Array(items)) = value else {
        return Vec::new();
    };

    let mut history = Vec::new();
    for item in items {
        let Ok(event) = serde_json::from_value::<PlayEvent>(item) else {
            continue;
        };
        if event.at == 0 || (event.album.trim().is_empty() && event.track.trim().is_empty()) {
            continue;
        }
        history.push(PlayEvent {
            at: event.at,
            artist: clip(event.artist.trim()),
            album: clip(event.album.trim()),
            track: clip(event.track.trim()),
        });
    }

    if history.len() > MAX_HISTORY {
        history.drain(..history.len() - MAX_HISTORY);
    }
    history
}

pub fn build_wrapped(
    records: &[CollectedRecord],
    history: &[PlayEvent],
    requested_month: Option<&str>,
    now: u64,
) -> WrappedStats {
    let mut available_months: Vec<String> = history
        .iter()
        .map(|event| month_key(event.at))
        .collect::<BTreeSet<_>>()
        .into_iter()
        .rev()
        .take(MAX_MONTHS)
        .collect();

    let month = requested_month
        .filter(|value| is_valid_month(value))
        .map(str::to_string)
        .or_else(|| available_months.first().cloned())
        .unwrap_or_else(|| month_key(now));

    // The requested month may be older than the trimmed list; still show it.
    if is_valid_month(&month)
        && !available_months.contains(&month)
        && (!history.is_empty() || requested_month.is_some())
    {
        available_months.push(month.clone());
        available_months.sort();
        available_months.reverse();
        available_months.truncate(MAX_MONTHS);
    }

    let events: Vec<&PlayEvent> = history
        .iter()
        .filter(|event| month_key(event.at) == month)
        .collect();

    let mut albums: HashMap<String, (String, String, u32)> = HashMap::new();
    let mut tracks: HashMap<String, (String, String, u32)> = HashMap::new();
    let mut artists: HashMap<String, (String, u32)> = HashMap::new();
    let mut days: HashMap<String, u32> = HashMap::new();
    let mut unique_album_keys: HashSet<String> = HashSet::new();
    let mut unique_artists: HashSet<String> = HashSet::new();
    let mut unique_tracks: HashSet<String> = HashSet::new();

    for event in &events {
        if let Some(key) = record_key(&event.artist, &event.album, &event.track) {
            unique_album_keys.insert(key.clone());
            let entry = albums
                .entry(key)
                .or_insert_with(|| (event.artist.clone(), event.album.clone(), 0));
            entry.2 = entry.2.saturating_add(1);
        }

        let artist_key = event.artist.trim().to_lowercase();
        if !artist_key.is_empty() {
            unique_artists.insert(artist_key.clone());
            let entry = artists
                .entry(artist_key)
                .or_insert_with(|| (event.artist.clone(), 0));
            entry.1 = entry.1.saturating_add(1);
        }

        if !event.track.trim().is_empty() {
            let track_key = format!(
                "{}|{}",
                event.artist.trim().to_lowercase(),
                event.track.trim().to_lowercase()
            );
            unique_tracks.insert(track_key.clone());
            let entry = tracks
                .entry(track_key)
                .or_insert_with(|| (event.track.clone(), event.artist.clone(), 0));
            entry.2 = entry.2.saturating_add(1);
        }

        *days.entry(day_key(event.at)).or_insert(0) += 1;
    }

    let pressing_numbers: HashMap<&str, u32> = records
        .iter()
        .map(|record| (record.key.as_str(), record.pressing_number))
        .collect();

    let mut top_records: Vec<WrappedAlbum> = albums
        .into_iter()
        .map(|(key, (artist, album, plays))| WrappedAlbum {
            pressing_number: pressing_numbers.get(key.as_str()).copied(),
            key,
            artist,
            album,
            plays,
        })
        .collect();
    top_records.sort_by(|left, right| {
        right
            .plays
            .cmp(&left.plays)
            .then_with(|| left.album.cmp(&right.album))
            .then_with(|| left.artist.cmp(&right.artist))
    });
    top_records.truncate(TOP_RECORDS);

    let rarest = top_records
        .iter()
        .filter(|record| record.pressing_number.is_some())
        .min_by_key(|record| record.pressing_number)
        .cloned();

    let top_track = tracks
        .into_values()
        .max_by(|left, right| left.2.cmp(&right.2))
        .map(|(track, artist, plays)| WrappedTrack {
            track,
            artist,
            plays,
        });

    let top_artist = artists
        .into_values()
        .max_by(|left, right| left.1.cmp(&right.1))
        .map(|(artist, plays)| WrappedArtist { artist, plays });

    let busiest_day = days
        .into_iter()
        .max_by(|left, right| left.1.cmp(&right.1).then_with(|| right.0.cmp(&left.0)))
        .map(|(date, plays)| WrappedDay { date, plays });

    WrappedStats {
        label: month_label(&month),
        month,
        total_plays: events.len() as u32,
        unique_albums: unique_album_keys.len() as u32,
        unique_artists: unique_artists.len() as u32,
        unique_tracks: unique_tracks.len() as u32,
        top_records,
        top_track,
        top_artist,
        rarest,
        busiest_day,
        available_months,
    }
}

pub fn month_key(milliseconds: u64) -> String {
    let (year, month, _) = civil_from_days((milliseconds / 86_400_000) as i64);
    format!("{year:04}-{month:02}")
}

fn day_key(milliseconds: u64) -> String {
    let (year, month, day) = civil_from_days((milliseconds / 86_400_000) as i64);
    format!("{year:04}-{month:02}-{day:02}")
}

fn month_label(month: &str) -> String {
    const NAMES: [&str; 12] = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    let Some((year, month_number)) = month.split_once('-') else {
        return month.to_string();
    };
    let Ok(index) = month_number.parse::<usize>() else {
        return month.to_string();
    };
    match NAMES.get(index.saturating_sub(1)) {
        Some(name) if is_valid_month(month) => format!("{name} {year}"),
        _ => month.to_string(),
    }
}

fn is_valid_month(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 7
        && bytes[4] == b'-'
        && bytes[..4].iter().all(u8::is_ascii_digit)
        && bytes[5..].iter().all(u8::is_ascii_digit)
        && matches!(value[5..].parse::<u8>(), Ok(1..=12))
}

/// Howard Hinnant's days-to-civil algorithm, adapted for UTC timestamps.
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = (z - era * 146_097) as u64;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era as i64 + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_prime + 2) / 5 + 1) as u32;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    } as u32;
    if month <= 2 {
        year += 1;
    }
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        build_wrapped, civil_from_days, month_key, month_label, validate_history, PlayEvent,
    };
    use crate::collection::{press, PressInput, PressingColors};

    fn record(artist: &str, album: &str) -> crate::collection::CollectedRecord {
        let mut records = Vec::new();
        press(
            &mut records,
            PressInput {
                artist: artist.to_string(),
                album: album.to_string(),
                recipe: "galaxy".to_string(),
                pressing_type: "splatter".to_string(),
                pressing_name: "Galaxy".to_string(),
                colors: PressingColors {
                    primary: "#000".into(),
                    secondary: "#111".into(),
                    accent: "#222".into(),
                },
                thumbnail: None,
            },
            month_start(2026, 10),
        )
        .expect("press")
        .record
    }

    fn event(artist: &str, album: &str, track: &str, at: u64) -> PlayEvent {
        PlayEvent {
            at,
            artist: artist.to_string(),
            album: album.to_string(),
            track: track.to_string(),
        }
    }

    fn month_start(year: i64, month: u32) -> u64 {
        // Enough for the tests: first day of the month, noon UTC.
        let days = days_from_civil(year, month, 1);
        (days as u64) * 86_400_000 + 12 * 3_600_000
    }

    fn days_from_civil(year: i64, month: u32, day: u32) -> i64 {
        let year = if month <= 2 { year - 1 } else { year };
        let era = if year >= 0 { year } else { year - 399 } / 400;
        let year_of_era = year - era * 400;
        let month_prime = if month > 2 { month - 3 } else { month + 9 } as i64;
        let day_of_year = (153 * month_prime + 2) / 5 + day as i64 - 1;
        let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
        era * 146_097 + day_of_era - 719_468
    }

    #[test]
    fn converts_epoch_days_and_labels_months() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(month_key(0), "1970-01");
        assert_eq!(month_label("2026-10"), "October 2026");
        assert_eq!(month_label("2026-13"), "2026-13");
    }

    #[test]
    fn validation_drops_garbage_and_trims_old_events() {
        let history = validate_history(Some(json!([
            { "at": 0, "artist": "A", "album": "B", "track": "C" },
            { "at": 5, "artist": " A ", "album": "B", "track": "C" },
            { "at": 6, "artist": "A", "album": "", "track": "" },
            42
        ])));
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].artist, "A");
        assert!(validate_history(Some(json!({"not": "a list"}))).is_empty());
    }

    #[test]
    fn folds_one_month_into_ranked_stats() {
        let records = vec![record("Kavinsky", "OutRun"), record("Bia", "Really Her")];
        let october = month_start(2026, 10);
        let history = vec![
            event("Kavinsky", "OutRun", "Nightcall", october + 1_000),
            event("Kavinsky", "OutRun", "Nightcall", october + 2_000),
            event("Kavinsky", "OutRun", "Blizzard", october + 3_000),
            event("Bia", "Really Her", "Fallback", october + 4_000),
            event(
                "Kavinsky",
                "OutRun",
                "Nightcall",
                month_start(2026, 9) + 1_000,
            ),
        ];

        let stats = build_wrapped(&records, &history, Some("2026-10"), october + 5_000);
        assert_eq!(stats.month, "2026-10");
        assert_eq!(stats.label, "October 2026");
        assert_eq!(stats.total_plays, 4);
        assert_eq!(stats.unique_albums, 2);
        assert_eq!(stats.unique_artists, 2);
        assert_eq!(stats.unique_tracks, 3);
        assert_eq!(stats.top_records[0].album, "OutRun");
        assert_eq!(stats.top_records[0].plays, 3);
        assert_eq!(stats.top_track.unwrap().track, "Nightcall");
        assert_eq!(stats.top_artist.unwrap().artist, "Kavinsky");
        assert_eq!(stats.rarest.unwrap().album, "OutRun");
        assert_eq!(stats.busiest_day.unwrap().date, "2026-10-01");
        assert_eq!(stats.available_months, vec!["2026-10", "2026-09"]);
    }

    #[test]
    fn defaults_to_the_newest_month_and_handles_empty_history() {
        let history = vec![event("A", "B", "C", month_start(2026, 9))];
        let stats = build_wrapped(&[], &history, None, month_start(2026, 10));
        assert_eq!(stats.month, "2026-09");
        assert_eq!(stats.total_plays, 1);

        let empty = build_wrapped(&[], &[], None, month_start(2026, 10));
        assert_eq!(empty.month, "2026-10");
        assert_eq!(empty.total_plays, 0);
        assert!(empty.top_records.is_empty());
        assert!(empty.busiest_day.is_none());
    }
}

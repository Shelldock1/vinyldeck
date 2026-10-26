use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};

use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager as SessionManager;

use super::model::{
    order_players, repeat_mode_from_smtc_code, smtc_auto_repeat_code, MediaPlayer, MediaSnapshot,
};

const TICKS_PER_SECOND: f64 = 10_000_000.0;
const WINDOWS_UNIX_EPOCH_DIFF_SECONDS: u64 = 11_644_473_600;

static MANAGER: OnceLock<SessionManager> = OnceLock::new();
static SUBSCRIBED_SESSIONS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

pub(crate) async fn current_media_snapshot_with_metadata(
    selected: Option<String>,
    fallback: Option<String>,
) -> anyhow::Result<Option<MediaSnapshot>> {
    let Some((session, source_key)) =
        current_session(selected.as_deref(), fallback.as_deref()).await?
    else {
        return Ok(None);
    };

    let mut snapshot = current_lightweight_snapshot_from_session(&session, &source_key);
    if let Ok(properties) = session.TryGetMediaPropertiesAsync()?.await {
        snapshot.track = properties
            .Title()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.artist = properties
            .Artist()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.album = properties
            .AlbumTitle()
            .map(|value| value.to_string())
            .unwrap_or_default();
    }

    Ok(Some(snapshot))
}

pub(crate) async fn current_media_snapshot_with_artwork(
    selected: Option<String>,
    fallback: Option<String>,
) -> anyhow::Result<Option<MediaSnapshot>> {
    let Some((session, source_key)) =
        current_session(selected.as_deref(), fallback.as_deref()).await?
    else {
        return Ok(None);
    };

    let mut snapshot = current_lightweight_snapshot_from_session(&session, &source_key);
    if let Ok(properties) = session.TryGetMediaPropertiesAsync()?.await {
        snapshot.track = properties
            .Title()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.artist = properties
            .Artist()
            .map(|value| value.to_string())
            .unwrap_or_default();
        snapshot.album = properties
            .AlbumTitle()
            .map(|value| value.to_string())
            .unwrap_or_default();

        if let Ok(thumbnail) = properties.Thumbnail() {
            snapshot.artwork_data_url = super::artwork::thumbnail_to_artwork_url(thumbnail).await?;
        }
    }

    Ok(Some(snapshot))
}

#[allow(dead_code)]
pub(crate) async fn current_lightweight_snapshot(
    selected: Option<&str>,
    fallback: Option<&str>,
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    let Some((session, source_key)) = current_session(selected, fallback).await? else {
        return Ok(None);
    };

    Ok(Some(current_lightweight_snapshot_from_session(
        &session,
        &source_key,
    )))
}

/// Enumerates every SMTC session for the Settings picker.
#[allow(dead_code)]
pub(crate) async fn list_players() -> anyhow::Result<Vec<MediaPlayer>> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    let mut players = Vec::new();

    for (session, source_key) in sessions_with_keys(&manager) {
        let name = {
            let (aumid, _) = parse_source_key(&source_key);
            if aumid.is_empty() {
                continue;
            }
            display_name_for_key(&super::model::friendly_source_name(aumid), &source_key)
        };
        players.push(MediaPlayer {
            name,
            id: source_key,
            is_playing: session_is_playing(&session),
        });
    }

    Ok(order_players(players))
}

async fn manager() -> anyhow::Result<SessionManager> {
    if let Some(manager) = MANAGER.get() {
        return Ok(manager.clone());
    }

    // RequestAsync performs a broker round trip; the manager lives for the
    // whole process, so ask for it once instead of every poll.
    let manager = SessionManager::RequestAsync()?.await?;
    let _ = MANAGER.set(manager.clone());
    Ok(manager)
}

/// Subscribes to change events for sessions we have not seen yet. Tokens are
/// dropped on purpose: the handlers live as long as the SMTC session does and
/// only wake the poller, so there is nothing to unregister per track.
fn ensure_session_subscriptions(manager: &SessionManager) {
    use windows::Foundation::TypedEventHandler;

    let mut subscribed = SUBSCRIBED_SESSIONS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if subscribed.len() > 64 {
        subscribed.clear();
    }

    for (session, source_key) in sessions_with_keys(manager) {
        if parse_source_key(&source_key).0.is_empty() || !subscribed.insert(source_key) {
            continue;
        }

        let _ = session.MediaPropertiesChanged(&TypedEventHandler::new(|_, _| {
            crate::media::poller::wake_poller();
            Ok(())
        }));
        let _ = session.PlaybackInfoChanged(&TypedEventHandler::new(|_, _| {
            crate::media::poller::wake_poller();
            Ok(())
        }));
        let _ = session.TimelinePropertiesChanged(&TypedEventHandler::new(|_, _| {
            crate::media::poller::wake_poller();
            Ok(())
        }));
    }
}

/// Subscribes to the manager-level session list. Individual session events are
/// attached lazily by `ensure_session_subscriptions` once the poller sees them.
pub(crate) fn spawn_event_watchers() {
    use windows::Foundation::TypedEventHandler;

    let _ = std::thread::Builder::new()
        .name("vinyldeck-smtc-events".to_string())
        .spawn(|| {
            let Ok(manager) = tauri::async_runtime::block_on(manager()) else {
                return;
            };
            let _ = manager.SessionsChanged(&TypedEventHandler::new(|_, _| {
                crate::media::poller::wake_poller();
                Ok(())
            }));

            // Hold the manager (and therefore the subscription) for the
            // lifetime of the process.
            loop {
                std::thread::sleep(std::time::Duration::from_secs(3_600));
            }
        });
}

async fn current_session(
    selected: Option<&str>,
    fallback: Option<&str>,
) -> anyhow::Result<
    Option<(
        windows::Media::Control::GlobalSystemMediaTransportControlsSession,
        String,
    )>,
> {
    let manager = manager().await?;
    ensure_session_subscriptions(&manager);

    if let Some(selected) = selected.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some(session) = session_by_source_id(&manager, selected) {
            return Ok(Some(session));
        }
    }

    if let Some(session) = first_playing_session(&manager) {
        return Ok(Some(session));
    }

    if let Some(fallback) = fallback.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some(session) = session_by_source_id(&manager, fallback) {
            return Ok(Some(session));
        }
    }

    if let Ok(session) = manager.GetCurrentSession() {
        let source_key = session_key_for_aumid(&manager, &session);
        return Ok(Some((session, source_key)));
    }

    Ok(first_paused_session(&manager))
}

/// Assigns every session a composite key. AUMIDs that appear once keep their
/// plain value (`Chrome`) so selections stored by older builds still resolve.
/// Repeated AUMIDs get a deterministic per-AUMID occurrence suffix
/// (`Chrome#1`, `Chrome#2`) in enumeration order, because WinRT exposes no
/// stable per-session id.
fn session_keys(aumids: &[&str]) -> Vec<String> {
    let mut totals: HashMap<&str, usize> = HashMap::new();
    for aumid in aumids {
        *totals.entry(*aumid).or_default() += 1;
    }

    let mut seen: HashMap<&str, usize> = HashMap::new();
    aumids
        .iter()
        .map(|aumid| {
            let occurrence = seen.entry(*aumid).or_default();
            *occurrence += 1;
            if totals.get(*aumid).copied().unwrap_or(1) > 1 {
                format!("{aumid}#{occurrence}")
            } else {
                (*aumid).to_string()
            }
        })
        .collect()
}

/// Splits a stored key into its AUMID and optional occurrence. A plain AUMID
/// (older settings) has no occurrence and selects the first session of that
/// app. AUMIDs that contain `#` are not mistaken for composites.
fn parse_source_key(key: &str) -> (&str, Option<usize>) {
    if let Some((aumid, suffix)) = key.rsplit_once('#') {
        if !aumid.is_empty() {
            if let Ok(occurrence) = suffix.parse::<usize>() {
                if occurrence > 0 {
                    return (aumid, Some(occurrence));
                }
            }
        }
    }
    (key, None)
}

/// Picker label for a keyed session. Unique sessions keep their old name;
/// duplicates gain the occurrence so the picker can tell them apart.
fn display_name_for_key(base_name: &str, key: &str) -> String {
    match parse_source_key(key) {
        (_, Some(occurrence)) => format!("{base_name} ({occurrence})"),
        _ => base_name.to_string(),
    }
}

/// Resolves a stored key against the current enumeration. Exact composite keys
/// win; a plain AUMID or an occurrence that disappeared after a refresh falls
/// back to the first session for that app instead of losing the source.
fn select_session_index(keys: &[String], requested: &str) -> Option<usize> {
    if let Some(index) = keys.iter().position(|key| key == requested) {
        return Some(index);
    }

    let (aumid, _) = parse_source_key(requested);
    keys.iter().position(|key| parse_source_key(key).0 == aumid)
}

/// Enumerates sessions together with their composite keys, preserving manager
/// order so listing, selection, and subscription all agree.
fn sessions_with_keys(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
) -> Vec<(
    windows::Media::Control::GlobalSystemMediaTransportControlsSession,
    String,
)> {
    let Ok(sessions) = manager.GetSessions() else {
        return Vec::new();
    };
    let Ok(size) = sessions.Size() else {
        return Vec::new();
    };

    let mut handles = Vec::new();
    for index in 0..size {
        if let Ok(session) = sessions.GetAt(index) {
            handles.push(session);
        }
    }

    let aumids: Vec<String> = handles.iter().map(session_source_id).collect();
    let aumid_refs: Vec<&str> = aumids.iter().map(String::as_str).collect();
    handles.into_iter().zip(session_keys(&aumid_refs)).collect()
}

fn session_source_id(
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
) -> String {
    session
        .SourceAppUserModelId()
        .map(|value| value.to_string())
        .unwrap_or_default()
}

fn session_is_playing(
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
) -> bool {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;

    session
        .GetPlaybackInfo()
        .ok()
        .and_then(|info| info.PlaybackStatus().ok())
        .is_some_and(|status| {
            status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing
        })
}

fn session_is_paused(
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
) -> bool {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;

    session
        .GetPlaybackInfo()
        .ok()
        .and_then(|info| info.PlaybackStatus().ok())
        .is_some_and(|status| {
            status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Paused
        })
}

/// Key of the first session for an AUMID. Used only for the manager's current
/// session, which has no enumeration position of its own.
fn session_key_for_aumid(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
) -> String {
    let aumid = session_source_id(session);
    sessions_with_keys(manager)
        .into_iter()
        .map(|(_, key)| key)
        .find(|key| parse_source_key(key).0 == aumid)
        .unwrap_or(aumid)
}

fn session_by_source_id(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
    source_id: &str,
) -> Option<(
    windows::Media::Control::GlobalSystemMediaTransportControlsSession,
    String,
)> {
    let sessions = sessions_with_keys(manager);
    let keys: Vec<String> = sessions.iter().map(|(_, key)| key.clone()).collect();
    let index = select_session_index(&keys, source_id)?;
    sessions.into_iter().nth(index)
}

fn first_playing_session(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
) -> Option<(
    windows::Media::Control::GlobalSystemMediaTransportControlsSession,
    String,
)> {
    sessions_with_keys(manager)
        .into_iter()
        .find(|(session, _)| session_is_playing(session))
}

fn first_paused_session(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
) -> Option<(
    windows::Media::Control::GlobalSystemMediaTransportControlsSession,
    String,
)> {
    sessions_with_keys(manager)
        .into_iter()
        .find(|(session, _)| session_is_paused(session))
}

fn current_lightweight_snapshot_from_session(
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
    source_key: &str,
) -> super::model::MediaSnapshot {
    use super::model::friendly_source_name;
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;

    let (aumid, _) = parse_source_key(source_key);
    let source_name = display_name_for_key(&friendly_source_name(aumid), source_key);
    let mut snapshot = super::model::MediaSnapshot {
        source_id: source_key.to_string(),
        source_name,
        ..super::model::MediaSnapshot::default()
    };

    if let Ok(playback_info) = session.GetPlaybackInfo() {
        if let Ok(status) = playback_info.PlaybackStatus() {
            snapshot.is_playing =
                status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
        }

        if let Ok(controls) = playback_info.Controls() {
            snapshot.can_seek = controls.IsPlaybackPositionEnabled().unwrap_or(false);
            snapshot.can_skip = controls.IsNextEnabled().unwrap_or(false)
                || controls.IsPreviousEnabled().unwrap_or(false);
            snapshot.can_control = controls.IsPlayEnabled().unwrap_or(false)
                || controls.IsPauseEnabled().unwrap_or(false);
        }

        // Playback info is the SMTC capability surface for these two modes:
        // a readable repeat/shuffle value means the session exposes it.
        if let Ok(repeat_mode) = playback_info.AutoRepeatMode() {
            snapshot.can_repeat = true;
            if let Ok(mode) = repeat_mode.Value() {
                snapshot.repeat_mode = repeat_mode_from_smtc_code(mode.0).to_string();
            }
        }
        if let Ok(shuffle) = playback_info.IsShuffleActive() {
            snapshot.can_shuffle = true;
            snapshot.shuffle = shuffle.Value().unwrap_or(false);
        }
    }

    if let Ok(timeline) = session.GetTimelineProperties() {
        let start_ticks = timeline
            .StartTime()
            .map(|value| value.Duration)
            .unwrap_or(0);
        let last_updated_ticks = timeline
            .LastUpdatedTime()
            .ok()
            .map(|value| value.UniversalTime);

        if let (Ok(end), Ok(position)) = (timeline.EndTime(), timeline.Position()) {
            let values = timeline_seconds(
                start_ticks,
                end.Duration,
                position.Duration,
                snapshot.is_playing,
                last_updated_ticks,
                std::time::SystemTime::now(),
            );
            snapshot.duration = values.duration;
            snapshot.position = values.position;
        }
    }

    snapshot
}

#[allow(dead_code)]
pub(crate) async fn play(source_id: Option<&str>) -> anyhow::Result<()> {
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(session.TryPlayAsync()?.await?, "play")
}

#[allow(dead_code)]
pub(crate) async fn pause(source_id: Option<&str>) -> anyhow::Result<()> {
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(session.TryPauseAsync()?.await?, "pause")
}

#[allow(dead_code)]
pub(crate) async fn toggle_play_pause(source_id: Option<&str>) -> anyhow::Result<()> {
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(
        session.TryTogglePlayPauseAsync()?.await?,
        "toggle play/pause",
    )
}

#[allow(dead_code)]
pub(crate) async fn next(source_id: Option<&str>) -> anyhow::Result<()> {
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(session.TrySkipNextAsync()?.await?, "next")
}

#[allow(dead_code)]
pub(crate) async fn previous(source_id: Option<&str>) -> anyhow::Result<()> {
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(session.TrySkipPreviousAsync()?.await?, "previous")
}

#[allow(dead_code)]
pub(crate) async fn seek(position_seconds: f64, source_id: Option<&str>) -> anyhow::Result<()> {
    let ticks = seconds_to_ticks(position_seconds)?;
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(
        session.TryChangePlaybackPositionAsync(ticks)?.await?,
        "seek",
    )
}

#[allow(dead_code)]
pub(crate) async fn set_repeat(mode: &str, source_id: Option<&str>) -> anyhow::Result<()> {
    use windows::Media::MediaPlaybackAutoRepeatMode;

    let code = smtc_auto_repeat_code(mode)
        .ok_or_else(|| anyhow::anyhow!("invalid repeat mode: {mode}; expected off, all, or one"))?;
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(
        session
            .TryChangeAutoRepeatModeAsync(MediaPlaybackAutoRepeatMode(code))?
            .await?,
        "repeat",
    )
}

#[allow(dead_code)]
pub(crate) async fn set_shuffle(enabled: bool, source_id: Option<&str>) -> anyhow::Result<()> {
    let session = current_session_for_command(source_id).await?;
    require_command_accepted(
        session.TryChangeShuffleActiveAsync(enabled)?.await?,
        "shuffle",
    )
}

async fn current_session_for_command(
    source_id: Option<&str>,
) -> anyhow::Result<windows::Media::Control::GlobalSystemMediaTransportControlsSession> {
    current_session(source_id, None)
        .await?
        .map(|(session, _)| session)
        .ok_or_else(|| anyhow::anyhow!("No active media session"))
}

fn require_command_accepted(accepted: bool, action: &'static str) -> anyhow::Result<()> {
    if accepted {
        Ok(())
    } else {
        Err(anyhow::anyhow!("Media source rejected {action} command"))
    }
}

pub(crate) fn seconds_to_ticks(seconds: f64) -> anyhow::Result<i64> {
    if !seconds.is_finite() || seconds < 0.0 {
        return Err(anyhow::anyhow!(
            "Seek position must be finite and non-negative"
        ));
    }

    let ticks = seconds * TICKS_PER_SECOND;
    if ticks > i64::MAX as f64 {
        return Err(anyhow::anyhow!("Seek position is too large"));
    }

    Ok(ticks.round() as i64)
}

#[cfg(test)]
fn projected_position_seconds(
    position_ticks: i64,
    duration_seconds: f64,
    is_playing: bool,
    last_updated_windows_ticks: i64,
    now: std::time::SystemTime,
) -> Option<f64> {
    project_position_seconds(
        super::model::ticks_to_seconds(position_ticks),
        duration_seconds,
        is_playing,
        last_updated_windows_ticks,
        now,
    )
}

fn project_position_seconds(
    base_seconds: f64,
    duration_seconds: f64,
    is_playing: bool,
    last_updated_windows_ticks: i64,
    now: std::time::SystemTime,
) -> Option<f64> {
    if !is_playing {
        return Some(clamp_position(base_seconds, duration_seconds));
    }

    let now_ticks = system_time_to_windows_ticks(now)?;
    let elapsed_ticks = now_ticks.checked_sub(last_updated_windows_ticks)?;
    if elapsed_ticks <= 0 {
        return Some(clamp_position(base_seconds, duration_seconds));
    }

    let projected = base_seconds + super::model::ticks_to_seconds(elapsed_ticks);
    Some(clamp_position(projected, duration_seconds))
}

fn system_time_to_windows_ticks(time: std::time::SystemTime) -> Option<i64> {
    let unix_duration = time.duration_since(std::time::UNIX_EPOCH).ok()?;
    let seconds = unix_duration
        .as_secs()
        .checked_add(WINDOWS_UNIX_EPOCH_DIFF_SECONDS)?;
    let ticks = seconds
        .checked_mul(TICKS_PER_SECOND as u64)?
        .checked_add((unix_duration.subsec_nanos() / 100) as u64)?;
    i64::try_from(ticks).ok()
}

fn clamp_position(position: f64, duration_seconds: f64) -> f64 {
    if !position.is_finite() || position <= 0.0 {
        return 0.0;
    }
    if duration_seconds.is_finite() && duration_seconds > 0.0 {
        return position.min(duration_seconds);
    }

    position
}

/// Track-relative duration and position for one SMTC timeline snapshot.
#[derive(Debug, Clone, Copy, PartialEq)]
struct SmtcTimeline {
    duration: f64,
    position: f64,
}

/// Normalizes raw SMTC timeline ticks into track-relative seconds.
///
/// SMTC timelines are absolute: `EndTime - StartTime` is the duration and
/// `Position` is offset by `StartTime`. A zero start (normal tracks) is a
/// no-op. Playing sessions project the position forward from
/// `LastUpdatedTime`, then clamp to the track-relative duration.
fn timeline_seconds(
    start_ticks: i64,
    end_ticks: i64,
    position_ticks: i64,
    is_playing: bool,
    last_updated_windows_ticks: Option<i64>,
    now: std::time::SystemTime,
) -> SmtcTimeline {
    use super::model::ticks_to_seconds;

    let start = ticks_to_seconds(start_ticks);
    let duration = (ticks_to_seconds(end_ticks) - start).max(0.0);
    let base = ticks_to_seconds(position_ticks) - start;

    let position = last_updated_windows_ticks
        .and_then(|last_updated| {
            project_position_seconds(base, duration, is_playing, last_updated, now)
        })
        .unwrap_or_else(|| clamp_position(base, duration));

    SmtcTimeline { duration, position }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, UNIX_EPOCH};

    use super::{
        display_name_for_key, parse_source_key, projected_position_seconds,
        require_command_accepted, seconds_to_ticks, select_session_index, session_keys,
        system_time_to_windows_ticks, timeline_seconds,
    };

    #[test]
    fn converts_seek_seconds_to_windows_ticks() {
        assert_eq!(seconds_to_ticks(0.0).unwrap(), 0);
        assert_eq!(seconds_to_ticks(1.0).unwrap(), 10_000_000);
        assert_eq!(seconds_to_ticks(12.345_678_9).unwrap(), 123_456_789);
    }

    #[test]
    fn rejects_invalid_seek_seconds() {
        assert!(seconds_to_ticks(f64::NAN).is_err());
        assert!(seconds_to_ticks(f64::INFINITY).is_err());
        assert!(seconds_to_ticks(-0.001).is_err());
        assert!(seconds_to_ticks(i64::MAX as f64).is_err());
    }

    #[test]
    fn command_rejection_becomes_error() {
        assert!(require_command_accepted(true, "play").is_ok());

        let error = require_command_accepted(false, "play")
            .expect_err("false command result must become an error")
            .to_string();
        assert_eq!(error, "Media source rejected play command");
    }

    #[test]
    fn command_rejection_messages_keep_action_context() {
        for (action, expected) in [
            ("pause", "Media source rejected pause command"),
            ("next", "Media source rejected next command"),
            ("seek", "Media source rejected seek command"),
        ] {
            let error = require_command_accepted(false, action)
                .expect_err("false command result must become an error")
                .to_string();
            assert_eq!(error, expected);
        }
    }

    #[test]
    fn smtc_sessions_are_keyed_by_aumid_and_occurrence() {
        assert_eq!(parse_source_key("Chrome#2"), ("Chrome", Some(2)));
        assert_eq!(parse_source_key("Chrome"), ("Chrome", None));
        assert_eq!(
            parse_source_key("App#WithHash"),
            ("App#WithHash", None),
            "an AUMID containing # is not a composite key"
        );

        // Two Chrome windows share one AUMID; the composite keys make them
        // distinguishable and the picker labels follow the occurrence.
        let same_app = session_keys(&["Chrome", "Chrome"]);
        assert_eq!(same_app, ["Chrome#1", "Chrome#2"]);
        assert_eq!(display_name_for_key("Chrome", &same_app[0]), "Chrome (1)");
        assert_eq!(display_name_for_key("Chrome", &same_app[1]), "Chrome (2)");

        // A unique session keeps its plain AUMID, so selections stored by
        // older builds still resolve.
        let mixed = session_keys(&["Spotify.exe", "Chrome"]);
        assert_eq!(mixed, ["Spotify.exe", "Chrome"]);
        assert_eq!(display_name_for_key("Spotify", &mixed[0]), "Spotify");

        // Selection by composite key picks the requested occurrence.
        assert_eq!(select_session_index(&same_app, "Chrome#1"), Some(0));
        assert_eq!(select_session_index(&same_app, "Chrome#2"), Some(1));

        // Backward compatibility: a stored plain AUMID selects the first
        // session of that app.
        assert_eq!(select_session_index(&same_app, "Chrome"), Some(0));

        // A refresh that leaves one Chrome session still resolves the stored
        // composite key instead of dropping the selection.
        let refreshed = session_keys(&["Chrome"]);
        assert_eq!(refreshed, ["Chrome"]);
        assert_eq!(select_session_index(&refreshed, "Chrome#2"), Some(0));

        // Unknown sources resolve to nothing.
        assert_eq!(select_session_index(&same_app, "Spotify.exe"), None);
    }

    #[test]
    fn projects_playing_timeline_position_from_last_updated_time() {
        let now = UNIX_EPOCH + Duration::from_secs(1_000);
        let now_ticks = system_time_to_windows_ticks(now).unwrap();
        let last_updated = now_ticks - 2 * 10_000_000;

        assert_eq!(
            projected_position_seconds(30 * 10_000_000, 120.0, true, last_updated, now),
            Some(32.0)
        );
    }

    #[test]
    fn timeline_projection_clamps_and_does_not_advance_paused_media() {
        let now = UNIX_EPOCH + Duration::from_secs(1_000);
        let now_ticks = system_time_to_windows_ticks(now).unwrap();
        let last_updated = now_ticks - 10 * 10_000_000;

        assert_eq!(
            projected_position_seconds(30 * 10_000_000, 120.0, false, last_updated, now),
            Some(30.0)
        );
        assert_eq!(
            projected_position_seconds(119 * 10_000_000, 120.0, true, last_updated, now),
            Some(120.0)
        );
    }

    const TICKS: i64 = 10_000_000;

    #[test]
    fn smtc_timeline_subtracts_start_time_from_duration_and_position() {
        // Regression: a normal track has StartTime = 0, so the values are
        // already track-relative and must not change.
        let zero_start = timeline_seconds(0, 140 * TICKS, 20 * TICKS, false, None, UNIX_EPOCH);
        assert_eq!(zero_start.duration, 140.0);
        assert_eq!(zero_start.position, 20.0);

        // A timeline that starts at 100 s reports an absolute position and an
        // end-relative duration: 100..140 with position 120 means 40 s long
        // and 20 s into the track.
        let offset_start = timeline_seconds(
            100 * TICKS,
            140 * TICKS,
            120 * TICKS,
            false,
            None,
            UNIX_EPOCH,
        );
        assert_eq!(offset_start.duration, 40.0);
        assert_eq!(offset_start.position, 20.0);
    }

    #[test]
    fn smtc_timeline_projects_playing_position_from_relative_base() {
        let now = UNIX_EPOCH + Duration::from_secs(1_000);
        let now_ticks = system_time_to_windows_ticks(now).unwrap();
        // Five seconds elapsed since the position was reported.
        let last_updated = now_ticks - 5 * TICKS;

        let values = timeline_seconds(
            100 * TICKS,
            140 * TICKS,
            110 * TICKS,
            true,
            Some(last_updated),
            now,
        );
        assert_eq!(values.duration, 40.0);
        assert_eq!(values.position, 15.0, "10 s relative + 5 s elapsed");
    }

    #[test]
    fn smtc_timeline_position_clamps_to_relative_duration() {
        let now = UNIX_EPOCH + Duration::from_secs(1_000);
        let now_ticks = system_time_to_windows_ticks(now).unwrap();
        let last_updated = now_ticks - 60 * TICKS;

        // Projection would run past the 40 s track; clamp at duration.
        let past_end = timeline_seconds(
            100 * TICKS,
            140 * TICKS,
            130 * TICKS,
            true,
            Some(last_updated),
            now,
        );
        assert_eq!(past_end.duration, 40.0);
        assert_eq!(past_end.position, 40.0);

        // A position before StartTime must not go negative.
        let before_start = timeline_seconds(
            100 * TICKS,
            140 * TICKS,
            90 * TICKS,
            false,
            None,
            UNIX_EPOCH,
        );
        assert_eq!(before_start.duration, 40.0);
        assert_eq!(before_start.position, 0.0);
    }
}

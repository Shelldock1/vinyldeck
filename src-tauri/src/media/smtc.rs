#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SmtcSessionMetadata {
    pub source_id: String,
    pub source_name: String,
}

use super::model::{
    order_players, repeat_mode_from_smtc_code, smtc_auto_repeat_code, MediaPlayer, MediaSnapshot,
};

const TICKS_PER_SECOND: f64 = 10_000_000.0;
const WINDOWS_UNIX_EPOCH_DIFF_SECONDS: u64 = 11_644_473_600;

#[allow(dead_code)]
pub(crate) async fn current_session_metadata() -> anyhow::Result<Option<SmtcSessionMetadata>> {
    Ok(current_media_snapshot_with_metadata(None, None)
        .await?
        .map(|snapshot| SmtcSessionMetadata {
            source_id: snapshot.source_id,
            source_name: snapshot.source_name,
        }))
}

#[allow(dead_code)]
pub(crate) async fn current_media_snapshot_with_metadata(
    selected: Option<&str>,
    fallback: Option<&str>,
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    let Some(session) = current_session(selected, fallback).await? else {
        return Ok(None);
    };

    let mut snapshot = current_lightweight_snapshot_from_session(&session);
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

#[allow(dead_code)]
pub(crate) async fn current_media_snapshot_with_artwork(
    selected: Option<&str>,
    fallback: Option<&str>,
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    let Some(session) = current_session(selected, fallback).await? else {
        return Ok(None);
    };

    let mut snapshot = current_lightweight_snapshot_from_session(&session);
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
            snapshot.artwork_data_url = super::artwork::thumbnail_to_data_url(thumbnail).await?;
        }
    }

    Ok(Some(snapshot))
}

#[allow(dead_code)]
pub(crate) async fn current_lightweight_snapshot(
    selected: Option<&str>,
    fallback: Option<&str>,
) -> anyhow::Result<Option<super::model::MediaSnapshot>> {
    let Some(session) = current_session(selected, fallback).await? else {
        return Ok(None);
    };

    Ok(Some(current_lightweight_snapshot_from_session(&session)))
}

/// Enumerates every SMTC session for the Settings picker.
#[allow(dead_code)]
pub(crate) async fn list_players() -> anyhow::Result<Vec<MediaPlayer>> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?;
    let sessions = manager.GetSessions()?;
    let mut players = Vec::new();

    for index in 0..sessions.Size()? {
        let Ok(session) = sessions.GetAt(index) else {
            continue;
        };
        let source_id = session
            .SourceAppUserModelId()
            .map(|value| value.to_string())
            .unwrap_or_default();
        if source_id.is_empty() {
            continue;
        }
        players.push(MediaPlayer {
            name: super::model::friendly_source_name(&source_id),
            id: source_id,
            is_playing: session_is_playing(&session),
        });
    }

    Ok(order_players(players))
}

async fn manager(
) -> anyhow::Result<windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    Ok(GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.await?)
}

async fn current_session(
    selected: Option<&str>,
    fallback: Option<&str>,
) -> anyhow::Result<Option<windows::Media::Control::GlobalSystemMediaTransportControlsSession>> {
    let manager = manager().await?;

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
        return Ok(Some(session));
    }

    Ok(first_paused_session(&manager))
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

fn session_by_source_id(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
    source_id: &str,
) -> Option<windows::Media::Control::GlobalSystemMediaTransportControlsSession> {
    let sessions = manager.GetSessions().ok()?;
    for index in 0..sessions.Size().ok()? {
        let Ok(session) = sessions.GetAt(index) else {
            continue;
        };
        if session_source_id(&session) == source_id {
            return Some(session);
        }
    }
    None
}

fn first_playing_session(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
) -> Option<windows::Media::Control::GlobalSystemMediaTransportControlsSession> {
    let sessions = manager.GetSessions().ok()?;
    for index in 0..sessions.Size().ok()? {
        let Ok(session) = sessions.GetAt(index) else {
            continue;
        };
        if session_is_playing(&session) {
            return Some(session);
        }
    }
    None
}

fn first_paused_session(
    manager: &windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager,
) -> Option<windows::Media::Control::GlobalSystemMediaTransportControlsSession> {
    let sessions = manager.GetSessions().ok()?;
    for index in 0..sessions.Size().ok()? {
        let Ok(session) = sessions.GetAt(index) else {
            continue;
        };
        if session_is_paused(&session) {
            return Some(session);
        }
    }
    None
}

fn current_lightweight_snapshot_from_session(
    session: &windows::Media::Control::GlobalSystemMediaTransportControlsSession,
) -> super::model::MediaSnapshot {
    use super::model::{friendly_source_name, ticks_to_seconds};
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;

    let source_id = session
        .SourceAppUserModelId()
        .map(|value| value.to_string())
        .unwrap_or_default();
    let source_name = friendly_source_name(&source_id);
    let mut snapshot = super::model::MediaSnapshot {
        source_id,
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
        if let Ok(duration) = timeline.EndTime() {
            snapshot.duration = ticks_to_seconds(duration.Duration);
        }
        if let Ok(position) = timeline.Position() {
            snapshot.position = timeline
                .LastUpdatedTime()
                .ok()
                .and_then(|last_updated| {
                    projected_position_seconds(
                        position.Duration,
                        snapshot.duration,
                        snapshot.is_playing,
                        last_updated.UniversalTime,
                        std::time::SystemTime::now(),
                    )
                })
                .unwrap_or_else(|| ticks_to_seconds(position.Duration));
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

fn projected_position_seconds(
    position_ticks: i64,
    duration_seconds: f64,
    is_playing: bool,
    last_updated_windows_ticks: i64,
    now: std::time::SystemTime,
) -> Option<f64> {
    let base = super::model::ticks_to_seconds(position_ticks);
    if !is_playing {
        return Some(clamp_position(base, duration_seconds));
    }

    let now_ticks = system_time_to_windows_ticks(now)?;
    let elapsed_ticks = now_ticks.checked_sub(last_updated_windows_ticks)?;
    if elapsed_ticks <= 0 {
        return Some(clamp_position(base, duration_seconds));
    }

    let projected = base + super::model::ticks_to_seconds(elapsed_ticks);
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

#[cfg(test)]
mod tests {
    use std::time::{Duration, UNIX_EPOCH};

    use super::{
        projected_position_seconds, require_command_accepted, seconds_to_ticks,
        system_time_to_windows_ticks,
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
}

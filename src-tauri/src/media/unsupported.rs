// Neutral media bridge for targets without a native backend (macOS, BSD, ...).
// Mirrors the SMTC/MPRIS surface: snapshots report "nothing playing" and
// commands fail with a clear error.

use anyhow::{anyhow, Result};

use super::model::{MediaPlayer, MediaSnapshot};

const UNSUPPORTED: &str = "Media controls are not supported on this platform";

pub(crate) async fn list_players() -> Result<Vec<MediaPlayer>> {
    Ok(Vec::new())
}

pub(crate) async fn current_media_snapshot_with_metadata(
    _selected: Option<String>,
    _fallback: Option<String>,
) -> Result<Option<MediaSnapshot>> {
    Ok(None)
}

pub(crate) async fn current_media_snapshot_with_artwork(
    _selected: Option<String>,
    _fallback: Option<String>,
) -> Result<Option<MediaSnapshot>> {
    Ok(None)
}

pub(crate) async fn play(_source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn pause(_source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn toggle_play_pause(_source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn next(_source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn previous(_source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn seek(_position_seconds: f64, _source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn set_repeat(_mode: &str, _source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn set_shuffle(_enabled: bool, _source_id: Option<&str>) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) fn spawn_event_watchers() {}

// Neutral media bridge for targets without a native backend (macOS, BSD, ...).
// Mirrors the SMTC/MPRIS surface: snapshots report "nothing playing" and
// commands fail with a clear error.

use anyhow::{anyhow, Result};

use super::model::MediaSnapshot;

const UNSUPPORTED: &str = "Media controls are not supported on this platform";

pub(crate) async fn current_media_snapshot_with_metadata() -> Result<Option<MediaSnapshot>> {
    Ok(None)
}

pub(crate) async fn current_media_snapshot_with_artwork() -> Result<Option<MediaSnapshot>> {
    Ok(None)
}

pub(crate) async fn play() -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn pause() -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn toggle_play_pause() -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn next() -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn previous() -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

pub(crate) async fn seek(_position_seconds: f64) -> Result<()> {
    Err(anyhow!(UNSUPPORTED))
}

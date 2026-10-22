use tauri::{AppHandle, Emitter};

pub mod artwork;
pub mod authority;
pub mod commands;
#[cfg(target_os = "linux")]
pub mod linux;
pub mod model;
pub mod platform;
pub mod poller;
pub mod smtc;

use model::MediaSnapshot;

pub const MEDIA_SNAPSHOT_EVENT: &str = "media-state-changed";

pub fn emit_media_snapshot(app: &AppHandle, snapshot: &MediaSnapshot) {
    if let Err(error) = app.emit(MEDIA_SNAPSHOT_EVENT, snapshot) {
        eprintln!("[VinylDeck media] failed to emit snapshot: {error}");
    }
}

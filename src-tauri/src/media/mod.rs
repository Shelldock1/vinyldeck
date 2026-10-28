use tauri::{AppHandle, Emitter};

pub mod artwork;
pub mod authority;
pub mod commands;
#[cfg(target_os = "linux")]
pub mod linux;
pub mod model;
pub mod platform;
pub mod poller;
#[cfg(windows)]
pub mod smtc;
#[cfg(not(any(windows, target_os = "linux")))]
pub mod unsupported;
pub mod vinyl_loop;

use model::{MediaPosition, MediaSnapshot};

pub const MEDIA_SNAPSHOT_EVENT: &str = "media-state-changed";
pub const MEDIA_POSITION_EVENT: &str = "media-position-changed";

pub fn emit_media_snapshot(app: &AppHandle, snapshot: &MediaSnapshot) {
    if let Err(error) = app.emit(MEDIA_SNAPSHOT_EVENT, snapshot) {
        eprintln!("[VinylDeck media] failed to emit snapshot: {error}");
    }
}

pub fn emit_media_position(app: &AppHandle, position: MediaPosition) {
    if let Err(error) = app.emit(MEDIA_POSITION_EVENT, position) {
        eprintln!("[VinylDeck media] failed to emit position: {error}");
    }
}

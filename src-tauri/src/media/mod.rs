use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

pub mod artwork;
pub mod commands;
mod mock;
pub mod model;
pub mod poller;
pub mod smtc;

use mock::MockMediaAuthority;
use model::MediaSnapshot;

pub const MEDIA_SNAPSHOT_EVENT: &str = "media-state-changed";

pub struct MediaState {
    authority: Mutex<MockMediaAuthority>,
}

impl MediaState {
    pub fn new() -> Self {
        Self {
            authority: Mutex::new(MockMediaAuthority::new()),
        }
    }

    pub async fn snapshot(&self) -> MediaSnapshot {
        self.authority.lock().await.snapshot()
    }

    pub async fn play(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.play();
        authority.snapshot()
    }

    pub async fn pause(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.pause();
        authority.snapshot()
    }

    pub async fn toggle_play_pause(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.toggle_play_pause();
        authority.snapshot()
    }

    pub async fn next(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.next();
        authority.snapshot()
    }

    pub async fn previous(&self) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.previous();
        authority.snapshot()
    }

    pub async fn seek_to(&self, seconds: f64) -> MediaSnapshot {
        let mut authority = self.authority.lock().await;
        authority.seek_to(seconds);
        authority.snapshot()
    }
}

pub fn emit_media_snapshot(app: &AppHandle, snapshot: &MediaSnapshot) {
    if let Err(error) = app.emit(MEDIA_SNAPSHOT_EVENT, snapshot) {
        eprintln!("[VinylDeck media] failed to emit snapshot: {error}");
    }
}

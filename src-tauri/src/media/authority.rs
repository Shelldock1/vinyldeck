// Single backend playback authority.
//
// Holds the last real snapshot read from the platform bridge (SMTC on
// Windows, MPRIS on Linux). The poller is the only writer; tray, commands,
// and any future reader take the value from here instead of asking the
// platform again.
use std::sync::RwLock;

use tokio::sync::watch;

use super::model::MediaSnapshot;

pub struct PlaybackAuthority {
    current: RwLock<Option<MediaSnapshot>>,
    selection: RwLock<Option<String>>,
    notifier: watch::Sender<Option<MediaSnapshot>>,
}

impl PlaybackAuthority {
    pub fn new() -> Self {
        let (notifier, _) = watch::channel(None);
        Self {
            current: RwLock::new(None),
            selection: RwLock::new(None),
            notifier,
        }
    }

    /// Persisted player choice. `None` means Auto (follow the last playing
    /// session, falling back to the current/paused one).
    pub fn selection(&self) -> Option<String> {
        self.selection
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    pub fn set_selection(&self, selection: Option<String>) {
        let selection = selection
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        *self
            .selection
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner()) = selection;
    }

    /// Source used by transport commands: the explicit choice when set,
    /// otherwise the source of the current snapshot.
    pub fn selected_source_id(&self) -> Option<String> {
        self.selection().or_else(|| {
            self.snapshot()
                .map(|snapshot| snapshot.source_id)
                .filter(|source_id| !source_id.is_empty())
        })
    }

    /// Last real snapshot, or `None` when no media session is active.
    // One-shot read API; current readers (tray) use `subscribe`.
    #[allow(dead_code)]
    pub fn snapshot(&self) -> Option<MediaSnapshot> {
        self.current
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone()
    }

    /// Stores a polled snapshot. Subscribers are notified only when the value
    /// actually changed. Returns whether it changed.
    pub fn update(&self, snapshot: Option<MediaSnapshot>) -> bool {
        {
            let mut current = self
                .current
                .write()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if *current == snapshot {
                return false;
            }
            *current = snapshot.clone();
        }
        self.notifier.send_replace(snapshot);
        true
    }

    pub fn subscribe(&self) -> watch::Receiver<Option<MediaSnapshot>> {
        self.notifier.subscribe()
    }
}

impl Default for PlaybackAuthority {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(track: &str, position: f64) -> MediaSnapshot {
        MediaSnapshot {
            track: track.to_string(),
            position,
            ..MediaSnapshot::default()
        }
    }

    #[test]
    fn starts_empty() {
        assert_eq!(PlaybackAuthority::new().snapshot(), None);
    }

    #[test]
    fn update_stores_last_snapshot() {
        let authority = PlaybackAuthority::new();
        assert!(authority.update(Some(snapshot("A", 1.0))));
        assert_eq!(authority.snapshot(), Some(snapshot("A", 1.0)));
        assert!(authority.update(None));
        assert_eq!(authority.snapshot(), None);
    }

    #[test]
    fn identical_update_is_not_a_change() {
        let authority = PlaybackAuthority::new();
        authority.update(Some(snapshot("A", 1.0)));
        assert!(!authority.update(Some(snapshot("A", 1.0))));
    }

    #[test]
    fn selection_defaults_to_auto_and_normalizes_blank_ids() {
        let authority = PlaybackAuthority::new();
        assert_eq!(authority.selection(), None);

        authority.set_selection(Some("  org.mpris.MediaPlayer2.spotify  ".to_string()));
        assert_eq!(
            authority.selection(),
            Some("org.mpris.MediaPlayer2.spotify".to_string())
        );

        authority.set_selection(Some("   ".to_string()));
        assert_eq!(authority.selection(), None);
    }

    #[test]
    fn transport_source_prefers_selection_then_snapshot() {
        let authority = PlaybackAuthority::new();
        authority.update(Some(MediaSnapshot {
            source_id: "chrome".to_string(),
            ..snapshot("A", 1.0)
        }));

        assert_eq!(authority.selected_source_id(), Some("chrome".to_string()));

        authority.set_selection(Some("spotify".to_string()));
        assert_eq!(authority.selected_source_id(), Some("spotify".to_string()));

        authority.set_selection(None);
        authority.update(None);
        assert_eq!(authority.selected_source_id(), None);
    }

    #[test]
    fn subscribers_see_changes_only() {
        let authority = PlaybackAuthority::new();
        let mut receiver = authority.subscribe();
        assert!(!receiver.has_changed().unwrap());

        authority.update(Some(snapshot("A", 1.0)));
        assert!(receiver.has_changed().unwrap());
        assert_eq!(*receiver.borrow_and_update(), Some(snapshot("A", 1.0)));

        authority.update(Some(snapshot("A", 1.0)));
        assert!(!receiver.has_changed().unwrap());

        authority.update(Some(snapshot("B", 0.0)));
        assert_eq!(*receiver.borrow_and_update(), Some(snapshot("B", 0.0)));
    }
}

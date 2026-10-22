use std::time::Instant;

use super::model::MediaSnapshot;

#[derive(Debug, Clone)]
struct MockTrack {
    track: &'static str,
    artist: &'static str,
    album: &'static str,
    artwork_data_url: Option<&'static str>,
    duration: f64,
}

const MOCK_TRACKS: &[MockTrack] = &[
    MockTrack {
        track: "We On Go",
        artist: "BIA",
        album: "We On Go",
        artwork_data_url: Some("/art-1.jpg"),
        duration: 247.0,
    },
    MockTrack {
        track: "The Revenge",
        artist: "Shashwat Sachdev",
        album: "Dhurandhar",
        artwork_data_url: Some("/art-2.jpg"),
        duration: 312.0,
    },
    MockTrack {
        track: "Neon Requiem",
        artist: "Synth Replicant",
        album: "Grid Collapse",
        artwork_data_url: None,
        duration: 198.0,
    },
    MockTrack {
        track: "Warm Static",
        artist: "Analog Ritual",
        album: "Acetate Dreams",
        artwork_data_url: None,
        duration: 354.0,
    },
];

pub struct MockMediaAuthority {
    current_index: usize,
    is_playing: bool,
    position: f64,
    last_tick: Instant,
}

impl MockMediaAuthority {
    pub fn new() -> Self {
        Self {
            current_index: 0,
            is_playing: true,
            position: 0.0,
            last_tick: Instant::now(),
        }
    }

    pub fn snapshot(&self) -> MediaSnapshot {
        let track = self.current_track();
        MediaSnapshot {
            track: track.track.to_string(),
            artist: track.artist.to_string(),
            album: track.album.to_string(),
            artwork_data_url: track.artwork_data_url.map(str::to_string),
            duration: track.duration,
            position: self.position,
            is_playing: self.is_playing,
            source_name: "Backend Mock".to_string(),
            source_id: "backend-mock-01".to_string(),
            can_seek: true,
            can_skip: true,
            can_control: true,
        }
    }

    pub fn play(&mut self) {
        self.is_playing = true;
        self.last_tick = Instant::now();
    }

    pub fn pause(&mut self) {
        self.advance_position();
        self.is_playing = false;
    }

    pub fn toggle_play_pause(&mut self) {
        if self.is_playing {
            self.pause();
        } else {
            self.play();
        }
    }

    pub fn next(&mut self) {
        self.current_index = (self.current_index + 1) % MOCK_TRACKS.len();
        self.position = 0.0;
        self.last_tick = Instant::now();
    }

    pub fn previous(&mut self) {
        if self.position > 3.0 {
            self.position = 0.0;
        } else {
            self.current_index = (self.current_index + MOCK_TRACKS.len() - 1) % MOCK_TRACKS.len();
            self.position = 0.0;
        }
        self.last_tick = Instant::now();
    }

    pub fn seek_to(&mut self, seconds: f64) {
        if !seconds.is_finite() {
            return;
        }
        self.position = seconds.clamp(0.0, self.current_track().duration);
        self.last_tick = Instant::now();
    }

    fn advance_position(&mut self) {
        if !self.is_playing {
            self.last_tick = Instant::now();
            return;
        }

        let elapsed = self.last_tick.elapsed().as_secs_f64();
        self.last_tick = Instant::now();
        self.position += elapsed;

        if self.position >= self.current_track().duration {
            self.current_index = (self.current_index + 1) % MOCK_TRACKS.len();
            self.position = 0.0;
        }
    }

    fn current_track(&self) -> &MockTrack {
        &MOCK_TRACKS[self.current_index % MOCK_TRACKS.len()]
    }
}

#[cfg(test)]
mod tests {
    use super::MockMediaAuthority;

    #[test]
    fn commands_mutate_single_authority_state() {
        let mut authority = MockMediaAuthority::new();
        let first = authority.snapshot();

        authority.pause();
        assert!(!authority.snapshot().is_playing);

        authority.play();
        assert!(authority.snapshot().is_playing);

        authority.next();
        let next = authority.snapshot();
        assert_ne!(first.track, next.track);
        assert_eq!(next.position, 0.0);

        authority.previous();
        assert_eq!(authority.snapshot().track, first.track);
    }

    #[test]
    fn seek_clamps_to_track_bounds() {
        let mut authority = MockMediaAuthority::new();
        authority.seek_to(-10.0);
        assert_eq!(authority.snapshot().position, 0.0);

        authority.seek_to(9999.0);
        let snapshot = authority.snapshot();
        assert_eq!(snapshot.position, snapshot.duration);
    }
}

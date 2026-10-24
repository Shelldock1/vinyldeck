//! System-audio reactivity.
//!
//! While something is playing, a capture thread listens to the output device
//! (WASAPI loopback on Windows, the PipeWire/Pulse monitor source on Linux)
//! and emits smoothed level / bass / mid / treble values at ~30 Hz. The
//! frontend turns those into the VU meter, tonearm jitter, and groove glow.
//!
//! Capture starts and stops with playback so an idle deck does not hold the
//! audio device open, and every failure is non-fatal: the deck simply stays
//! still.

mod dsp;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(windows)]
mod windows;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

pub(crate) use dsp::Levels;

pub const AUDIO_REACTIVITY_EVENT: &str = "audio-reactivity";

const RETRY_AFTER: Duration = Duration::from_secs(30);
const SUPERVISOR_TICK: Duration = Duration::from_millis(400);

static PLAYING: AtomicBool = AtomicBool::new(false);
static CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);
static RETRY_AT: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();

/// Starts the supervisor once. Safe to call from `setup`.
pub fn start(app: AppHandle) {
    let spawned = thread::Builder::new()
        .name("vinyldeck-audio-supervisor".to_string())
        .spawn(move || supervise(app));

    if let Err(error) = spawned {
        eprintln!("[VinylDeck audio] failed to start supervisor: {error}");
    }
}

/// Called by the poller whenever playback starts or stops.
pub(crate) fn set_playing(playing: bool) {
    PLAYING.store(playing, Ordering::Relaxed);
}

fn supervise(app: AppHandle) {
    loop {
        let playing = PLAYING.load(Ordering::Relaxed);
        let retry_ready = retry_at()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .is_none_or(|retry| Instant::now() >= retry);

        if playing && retry_ready && !CAPTURE_ACTIVE.load(Ordering::Acquire) {
            CAPTURE_ACTIVE.store(true, Ordering::Release);
            let capture_app = app.clone();
            let spawned = thread::Builder::new()
                .name("vinyldeck-audio-capture".to_string())
                .spawn(move || {
                    let result = capture(&capture_app);
                    CAPTURE_ACTIVE.store(false, Ordering::Release);
                    emit(&capture_app, Levels::SILENT);

                    if let Err(error) = result {
                        eprintln!("[VinylDeck audio] capture stopped: {error}");
                        *retry_at()
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner()) =
                            Some(Instant::now() + RETRY_AFTER);
                    }
                });

            if let Err(error) = spawned {
                CAPTURE_ACTIVE.store(false, Ordering::Release);
                eprintln!("[VinylDeck audio] failed to start capture: {error}");
            }
        }

        thread::sleep(SUPERVISOR_TICK);
    }
}

fn retry_at() -> &'static Mutex<Option<Instant>> {
    RETRY_AT.get_or_init(|| Mutex::new(None))
}

#[cfg(target_os = "linux")]
fn capture(app: &AppHandle) -> anyhow::Result<()> {
    linux::capture(app)
}

#[cfg(windows)]
fn capture(app: &AppHandle) -> anyhow::Result<()> {
    windows::capture(app)
}

#[cfg(not(any(windows, target_os = "linux")))]
fn capture(_app: &AppHandle) -> anyhow::Result<()> {
    Ok(())
}

fn playing() -> bool {
    PLAYING.load(Ordering::Relaxed)
}

fn emit(app: &AppHandle, levels: Levels) {
    if let Err(error) = app.emit(AUDIO_REACTIVITY_EVENT, levels) {
        eprintln!("[VinylDeck audio] failed to emit levels: {error}");
    }
}

//! Discord Rich Presence.
//!
//! Disabled until the user pastes their own Discord application client id in
//! Settings -> Other (Discord requires the id of an application you own; there
//! is no generic one to ship). Once configured, a small worker keeps a local
//! IPC connection and mirrors the current track.
//!
//! The wire format is Discord's documented IPC framing: op (u32 LE), length
//! (u32 LE), then a JSON payload. Nothing leaves the machine except through
//! the Discord client itself.

use std::io::{Read, Write};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::media::{authority::PlaybackAuthority, model::MediaSnapshot};
use crate::settings::SettingsState;

const POLL_INTERVAL: Duration = Duration::from_secs(2);
const RETRY_INTERVAL: Duration = Duration::from_secs(10);
const MAX_TEXT_CHARS: usize = 128;

pub fn start(app: AppHandle) {
    let spawned = std::thread::Builder::new()
        .name("vinyldeck-discord".to_string())
        .spawn(move || run(app));

    if let Err(error) = spawned {
        eprintln!("[VinylDeck discord] failed to start worker: {error}");
    }
}

fn run(app: AppHandle) {
    let mut connection: Option<Ipc> = None;
    let mut active_client_id = String::new();
    let mut last_key: Option<String> = None;

    loop {
        let settings = tauri::async_runtime::block_on(app.state::<SettingsState>().snapshot());
        let client_id = settings.discord_client_id.trim().to_string();

        if !is_valid_client_id(&client_id) {
            connection = None;
            active_client_id.clear();
            last_key = None;
            std::thread::sleep(RETRY_INTERVAL);
            continue;
        }

        if client_id != active_client_id {
            connection = Ipc::connect(&client_id);
            active_client_id = client_id;
            last_key = None;
        }

        if connection.is_none() {
            connection = Ipc::connect(&active_client_id);
            if connection.is_none() {
                std::thread::sleep(RETRY_INTERVAL);
                continue;
            }
        }

        let snapshot = app
            .try_state::<PlaybackAuthority>()
            .and_then(|authority| authority.snapshot());
        let (key, activity) = activity_for(snapshot.as_ref());

        if last_key.as_deref() != Some(key.as_str()) {
            let Some(ipc) = connection.as_mut() else {
                continue;
            };
            let payload = json!({
                "cmd": "SET_ACTIVITY",
                "args": { "pid": std::process::id(), "activity": activity },
                "nonce": format!("{}", now_millis()),
            });

            if ipc.send(1, &payload).is_ok() {
                last_key = Some(key);
            } else {
                // Discord restarted or the pipe closed; reconnect next tick.
                connection = None;
            }
        }

        std::thread::sleep(POLL_INTERVAL);
    }
}

fn is_valid_client_id(value: &str) -> bool {
    (6..=32).contains(&value.len()) && value.chars().all(|character| character.is_ascii_digit())
}

/// The change key ignores elapsed time; `activity_for` adds timestamps only
/// when they are sent, so a playing track does not resend twice a second.
fn activity_for(snapshot: Option<&MediaSnapshot>) -> (String, Value) {
    let Some(snapshot) = snapshot.filter(|snapshot| !snapshot.track.trim().is_empty()) else {
        return ("idle".to_string(), Value::Null);
    };

    let key = format!(
        "{}|{}|{}|{}",
        snapshot.track, snapshot.artist, snapshot.album, snapshot.is_playing
    );

    let mut activity = json!({
        "details": truncate(&snapshot.track),
        "instance": false,
    });

    let state = match (snapshot.artist.trim(), snapshot.album.trim()) {
        ("", "") => None,
        ("", album) => Some(album.to_string()),
        (artist, "") => Some(artist.to_string()),
        (artist, album) if artist == album => Some(artist.to_string()),
        (artist, album) => Some(format!("{artist} - {album}")),
    };
    if let Some(state) = state {
        activity["state"] = json!(truncate(&state));
    }

    if snapshot.is_playing {
        let position = snapshot.position.max(0.0);
        let start = now_millis() as i64 - (position * 1000.0) as i64;
        activity["timestamps"] = json!({ "start": start });
    }

    (key, activity)
}

fn truncate(value: &str) -> String {
    let trimmed = value.trim();
    trimmed.chars().take(MAX_TEXT_CHARS).collect()
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

enum Ipc {
    #[cfg(unix)]
    Unix(std::os::unix::net::UnixStream),
    #[cfg(windows)]
    Pipe(std::fs::File),
}

impl Ipc {
    fn connect(client_id: &str) -> Option<Self> {
        let mut ipc = Self::open()?;
        let handshake = json!({ "v": 1, "client_id": client_id });
        ipc.send(0, &handshake).ok()?;
        Some(ipc)
    }

    #[cfg(unix)]
    fn open() -> Option<Self> {
        use std::os::unix::net::UnixStream;

        let runtime_dir = std::env::var_os("XDG_RUNTIME_DIR");
        let temp_dir = std::env::var_os("TMPDIR");

        for index in 0..10 {
            let socket = format!("discord-ipc-{index}");
            let mut candidates = Vec::new();
            if let Some(dir) = runtime_dir.as_ref() {
                candidates.push(std::path::PathBuf::from(dir).join(&socket));
            }
            if let Some(dir) = temp_dir.as_ref() {
                candidates.push(std::path::PathBuf::from(dir).join(&socket));
            }
            candidates.push(std::path::PathBuf::from("/tmp").join(&socket));

            for path in candidates {
                if let Ok(stream) = UnixStream::connect(path) {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                    return Some(Self::Unix(stream));
                }
            }
        }

        // Flatpak Discord keeps its sockets under the app id.
        let flatpak = runtime_dir.map(|dir| {
            std::path::PathBuf::from(dir).join("app/com.discordapp.Discord/discord-ipc-0")
        })?;
        UnixStream::connect(flatpak).ok().map(Self::Unix)
    }

    #[cfg(windows)]
    fn open() -> Option<Self> {
        for index in 0..10 {
            let path = format!(r"\\.\pipe\discord-ipc-{index}");
            if let Ok(file) = std::fs::OpenOptions::new()
                .read(true)
                .write(true)
                .open(path)
            {
                return Some(Self::Pipe(file));
            }
        }
        None
    }

    #[cfg(not(any(unix, windows)))]
    fn open() -> Option<Self> {
        None
    }

    fn send(&mut self, op: u32, payload: &Value) -> std::io::Result<()> {
        let body = serde_json::to_vec(payload)
            .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error))?;
        let mut frame = Vec::with_capacity(body.len() + 8);
        frame.extend_from_slice(&op.to_le_bytes());
        frame.extend_from_slice(&(body.len() as u32).to_le_bytes());
        frame.extend_from_slice(&body);

        match self {
            #[cfg(unix)]
            Self::Unix(stream) => stream.write_all(&frame),
            #[cfg(windows)]
            Self::Pipe(file) => file.write_all(&frame),
            #[cfg(not(any(unix, windows)))]
            _ => Ok(()),
        }
    }
}

// Discord answers each frame. The responses are not needed, but draining them
// keeps the socket from filling if the client becomes chatty.
#[allow(dead_code)]
fn read_frame(stream: &mut impl Read) -> std::io::Result<Value> {
    let mut header = [0_u8; 8];
    stream.read_exact(&mut header)?;
    let length = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
    let mut body = vec![0_u8; length.min(64 * 1024)];
    stream.read_exact(&mut body)?;
    Ok(serde_json::from_slice(&body).unwrap_or(Value::Null))
}

#[cfg(test)]
mod tests {
    use super::{activity_for, is_valid_client_id};
    use crate::media::model::MediaSnapshot;

    #[test]
    fn client_ids_are_digit_snowflakes() {
        assert!(is_valid_client_id("123456789012345678"));
        assert!(!is_valid_client_id(""));
        assert!(!is_valid_client_id("not-a-snowflake"));
        assert!(!is_valid_client_id("123"));
    }

    #[test]
    fn idle_clears_the_activity() {
        let (key, activity) = activity_for(None);
        assert_eq!(key, "idle");
        assert!(activity.is_null());
    }

    #[test]
    fn playing_activity_has_track_artist_and_timestamp() {
        let snapshot = MediaSnapshot {
            track: "Nightcall".to_string(),
            artist: "Kavinsky".to_string(),
            album: "OutRun".to_string(),
            is_playing: true,
            position: 30.0,
            ..MediaSnapshot::default()
        };

        let (key, activity) = activity_for(Some(&snapshot));
        assert!(key.contains("Nightcall"));
        assert_eq!(activity["details"], "Nightcall");
        assert_eq!(activity["state"], "Kavinsky - OutRun");
        assert!(activity["timestamps"]["start"].as_i64().is_some());
    }

    #[test]
    fn paused_activity_omits_timestamps() {
        let snapshot = MediaSnapshot {
            track: "Nightcall".to_string(),
            is_playing: false,
            ..MediaSnapshot::default()
        };

        let (_, activity) = activity_for(Some(&snapshot));
        assert!(activity.get("timestamps").is_none());
    }
}

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
const MAX_FRAME_BYTES: usize = 64 * 1024;

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
                last_key = None;
            }
        }

        // Discord replies to the handshake and to every SET_ACTIVITY. The
        // replies are not needed, but leaving them unread would eventually
        // fill the pipe buffer, so take them off each tick.
        if let Some(ipc) = connection.as_mut() {
            if ipc.drain().is_err() {
                // The pipe is gone; reconnect and resend the activity.
                connection = None;
                last_key = None;
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
    Unix {
        stream: std::os::unix::net::UnixStream,
        responses: ResponseBuffer,
    },
    #[cfg(windows)]
    Pipe {
        file: std::fs::File,
        responses: ResponseBuffer,
    },
}

impl Ipc {
    fn connect(client_id: &str) -> Option<Self> {
        let mut ipc = Self::open()?;
        let handshake = json!({ "v": 1, "client_id": client_id });
        ipc.send(0, &handshake).ok()?;
        // Discord answers the handshake right away; take the reply off the pipe.
        ipc.drain().ok()?;
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
                    return Some(Self::Unix {
                        stream,
                        responses: ResponseBuffer::default(),
                    });
                }
            }
        }

        // Flatpak Discord keeps its sockets under the app id.
        let flatpak = runtime_dir.map(|dir| {
            std::path::PathBuf::from(dir).join("app/com.discordapp.Discord/discord-ipc-0")
        })?;
        UnixStream::connect(flatpak).ok().map(|stream| Self::Unix {
            stream,
            responses: ResponseBuffer::default(),
        })
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
                return Some(Self::Pipe {
                    file,
                    responses: ResponseBuffer::default(),
                });
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
            Self::Unix { stream, .. } => stream.write_all(&frame),
            #[cfg(windows)]
            Self::Pipe { file, .. } => file.write_all(&frame),
            #[cfg(not(any(unix, windows)))]
            _ => Ok(()),
        }
    }

    /// Reads and parses every response Discord has already sent, without
    /// waiting for more bytes, so a chatty client cannot fill the pipe.
    fn drain(&mut self) -> std::io::Result<Vec<Value>> {
        match self {
            #[cfg(unix)]
            Self::Unix { stream, responses } => {
                stream.set_nonblocking(true)?;
                let drained = drain_stream(stream, responses);
                let _ = stream.set_nonblocking(false);
                drained
            }
            #[cfg(windows)]
            Self::Pipe { file, responses } => {
                let available = bytes_available(file)?;
                if available == 0 {
                    return Ok(Vec::new());
                }
                // Bound the read to bytes the pipe already holds so it cannot
                // block if the rest of a frame has not arrived yet.
                let mut bounded = (&mut *file).take(available as u64);
                drain_stream(&mut bounded, responses)
            }
            #[cfg(not(any(unix, windows)))]
            _ => Ok(Vec::new()),
        }
    }
}

/// Raw bytes read from Discord that do not yet form a complete frame.
#[derive(Default)]
struct ResponseBuffer {
    pending: Vec<u8>,
}

impl ResponseBuffer {
    fn push(&mut self, bytes: &[u8]) {
        self.pending.extend_from_slice(bytes);
    }

    /// Parses every complete frame in the buffer. An incomplete trailing frame
    /// is kept for the next read; garbage ends the connection.
    fn drain_frames(&mut self) -> std::io::Result<Vec<Value>> {
        let mut frames = Vec::new();
        let mut consumed = 0;

        loop {
            let mut cursor: &[u8] = &self.pending[consumed..];
            match read_frame(&mut cursor) {
                Ok(frame) => {
                    frames.push(frame);
                    consumed = self.pending.len() - cursor.len();
                }
                Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => break,
                Err(error) => {
                    self.pending.clear();
                    return Err(error);
                }
            }
        }

        if consumed > 0 {
            self.pending.drain(..consumed);
        }

        Ok(frames)
    }
}

/// Reads until the reader is empty without waiting for another byte: EOF,
/// `WouldBlock` or the end of a bounded reader all stop the loop.
fn drain_stream(
    reader: &mut impl Read,
    buffer: &mut ResponseBuffer,
) -> std::io::Result<Vec<Value>> {
    let mut chunk = [0_u8; 4096];

    loop {
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(count) => buffer.push(&chunk[..count]),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => break,
            Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error),
        }
    }

    buffer.drain_frames()
}

#[cfg(windows)]
fn bytes_available(file: &std::fs::File) -> std::io::Result<u32> {
    use std::os::windows::io::AsRawHandle;

    #[link(name = "kernel32")]
    extern "system" {
        fn PeekNamedPipe(
            pipe: *mut std::ffi::c_void,
            buffer: *mut std::ffi::c_void,
            size: u32,
            bytes_read: *mut u32,
            total_bytes_available: *mut u32,
            bytes_left_this_message: *mut u32,
        ) -> i32;
    }

    let mut available = 0_u32;
    let ok = unsafe {
        PeekNamedPipe(
            file.as_raw_handle(),
            std::ptr::null_mut(),
            0,
            std::ptr::null_mut(),
            &mut available,
            std::ptr::null_mut(),
        )
    };

    if ok == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(available)
    }
}

// Discord answers each frame. The responses are not needed, but draining them
// keeps the socket from filling if the client becomes chatty.
fn read_frame(reader: &mut impl Read) -> std::io::Result<Value> {
    let mut header = [0_u8; 8];
    reader.read_exact(&mut header)?;
    let length = u32::from_le_bytes([header[4], header[5], header[6], header[7]]) as usize;
    if length > MAX_FRAME_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "discord response frame is too large",
        ));
    }
    let mut body = vec![0_u8; length];
    reader.read_exact(&mut body)?;
    Ok(serde_json::from_slice(&body).unwrap_or(Value::Null))
}

#[cfg(test)]
mod tests {
    use super::{activity_for, drain_stream, is_valid_client_id, ResponseBuffer};
    use crate::media::model::MediaSnapshot;

    fn frame(op: u32, payload: &serde_json::Value) -> Vec<u8> {
        let body = serde_json::to_vec(payload).expect("frame body");
        let mut frame = Vec::with_capacity(body.len() + 8);
        frame.extend_from_slice(&op.to_le_bytes());
        frame.extend_from_slice(&(body.len() as u32).to_le_bytes());
        frame.extend_from_slice(&body);
        frame
    }

    /// Emits prepared chunks, then behaves like a non-blocking socket with no
    /// more data: `WouldBlock` instead of EOF, and never a blocking wait.
    struct ChunksThenIdle {
        chunks: Vec<Vec<u8>>,
    }

    impl std::io::Read for ChunksThenIdle {
        fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
            if self.chunks.is_empty() {
                return Err(std::io::Error::from(std::io::ErrorKind::WouldBlock));
            }
            let mut chunk = self.chunks.remove(0);
            let count = chunk.len().min(buffer.len());
            buffer[..count].copy_from_slice(&chunk[..count]);
            if count < chunk.len() {
                chunk.drain(..count);
                self.chunks.insert(0, chunk);
            }
            Ok(count)
        }
    }

    #[test]
    fn drain_consumes_every_response_frame() {
        let payloads = [
            serde_json::json!({ "cmd": "DISPATCH", "evt": "READY", "data": { "v": 1 } }),
            serde_json::json!({ "cmd": "SET_ACTIVITY", "data": null, "nonce": "1" }),
            serde_json::json!({ "cmd": "DISPATCH", "evt": "ACTIVITY_JOIN", "data": {} }),
        ];
        let mut wire = Vec::new();
        for (index, payload) in payloads.iter().enumerate() {
            wire.extend_from_slice(&frame(index as u32, payload));
        }
        let wire_len = wire.len() as u64;

        let mut reader = std::io::Cursor::new(wire);
        let mut buffer = ResponseBuffer::default();
        let frames = drain_stream(&mut reader, &mut buffer).expect("drain");

        assert_eq!(frames.len(), payloads.len(), "every frame must be consumed");
        assert_eq!(frames[0]["evt"], "READY");
        assert_eq!(frames[1]["cmd"], "SET_ACTIVITY");
        assert_eq!(frames[2]["evt"], "ACTIVITY_JOIN");
        assert_eq!(reader.position(), wire_len, "nothing may be left unread");
        assert!(buffer.pending.is_empty(), "no bytes may be left pending");
    }

    #[test]
    fn drain_stops_at_would_block_and_keeps_partial_frames() {
        let first = serde_json::json!({ "cmd": "DISPATCH", "evt": "READY" });
        let second = serde_json::json!({ "cmd": "DISPATCH", "evt": "READY", "nonce": "42" });
        let second_frame = frame(1, &second);
        let split = 11;

        let mut reader = ChunksThenIdle {
            chunks: vec![frame(1, &first), second_frame[..split].to_vec()],
        };
        let mut buffer = ResponseBuffer::default();

        let frames = drain_stream(&mut reader, &mut buffer).expect("drain");
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["evt"], "READY");
        assert_eq!(buffer.pending.len(), split, "partial frame must be kept");

        buffer.push(&second_frame[split..]);
        let frames = buffer.drain_frames().expect("drain buffered");
        assert_eq!(frames.len(), 1);
        assert_eq!(frames[0]["nonce"], "42");
        assert!(buffer.pending.is_empty());
    }

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

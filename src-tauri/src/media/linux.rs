// Linux media integration over MPRIS (org.mpris.MediaPlayer2.*) on the session
// D-Bus. Mirrors the Windows SMTC surface so the rest of the app (poller,
// commands, frontend contract) stays platform-agnostic.

use std::collections::HashMap;
use std::io::Read;
use std::time::Duration;

use anyhow::{anyhow, Result};
use zbus::blocking::{Connection, Proxy};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};

use super::artwork::bytes_to_data_url;
use super::model::MediaSnapshot;

const MPRIS_PREFIX: &str = "org.mpris.MediaPlayer2.";
const MPRIS_ROOT_IFACE: &str = "org.mpris.MediaPlayer2";
const MPRIS_PLAYER_IFACE: &str = "org.mpris.MediaPlayer2.Player";
const MPRIS_PATH: &str = "/org/mpris/MediaPlayer2";
const MICROS_PER_SECOND: f64 = 1_000_000.0;
const MAX_ARTWORK_BYTES: u64 = 5 * 1024 * 1024;
const ARTWORK_TIMEOUT: Duration = Duration::from_secs(6);

struct PlayerSession {
    bus_name: String,
    identity: String,
}

fn session_bus() -> Result<Connection> {
    Connection::session().map_err(|error| anyhow!("cannot connect to session bus: {error}"))
}

fn player_proxy<'a>(connection: &'a Connection, bus_name: &'a str) -> Result<Proxy<'a>> {
    Proxy::new(connection, bus_name, MPRIS_PATH, MPRIS_PLAYER_IFACE)
        .map_err(|error| anyhow!("cannot build MPRIS proxy for {bus_name}: {error}"))
}

fn root_proxy<'a>(connection: &'a Connection, bus_name: &'a str) -> Result<Proxy<'a>> {
    Proxy::new(connection, bus_name, MPRIS_PATH, MPRIS_ROOT_IFACE)
        .map_err(|error| anyhow!("cannot build MPRIS root proxy for {bus_name}: {error}"))
}

fn bus_names(connection: &Connection) -> Result<Vec<String>> {
    let reply = connection.call_method(
        Some("org.freedesktop.DBus"),
        "/org/freedesktop/DBus",
        Some("org.freedesktop.DBus"),
        "ListNames",
        &(),
    )?;

    let names: Vec<String> = reply.body().deserialize()?;
    Ok(names
        .into_iter()
        .filter(|name| name.starts_with(MPRIS_PREFIX) && name.len() > MPRIS_PREFIX.len())
        .collect())
}

fn playback_status(proxy: &Proxy<'_>) -> String {
    proxy
        .get_property::<String>("PlaybackStatus")
        .unwrap_or_else(|_| "Stopped".to_string())
}

fn identity_for(connection: &Connection, bus_name: &str) -> String {
    root_proxy(connection, bus_name)
        .and_then(|proxy| {
            proxy
                .get_property::<String>("Identity")
                .map_err(|error| anyhow!(error.to_string()))
        })
        .map(|identity| identity.trim().to_string())
        .ok()
        .filter(|identity| !identity.is_empty())
        .unwrap_or_else(|| {
            super::model::friendly_source_name(
                bus_name
                    .trim_start_matches(MPRIS_PREFIX)
                    .split('.')
                    .next()
                    .unwrap_or(bus_name),
            )
        })
}

/// Picks the session we should treat as "the deck": the one that is playing,
/// else the one that is paused, else nothing.
fn active_session(connection: &Connection) -> Result<Option<PlayerSession>> {
    let mut paused: Option<PlayerSession> = None;

    for bus_name in bus_names(connection)? {
        let status = {
            let Ok(proxy) = player_proxy(connection, &bus_name) else {
                continue;
            };
            playback_status(&proxy)
        };
        let identity = identity_for(connection, &bus_name);
        let session = PlayerSession { bus_name, identity };

        match status.as_str() {
            "Playing" => return Ok(Some(session)),
            "Paused" if paused.is_none() => paused = Some(session),
            _ => {}
        }
    }

    Ok(paused)
}

fn micros_to_seconds(micros: i64) -> f64 {
    if micros <= 0 {
        return 0.0;
    }
    micros as f64 / MICROS_PER_SECOND
}

fn metadata_map(proxy: &Proxy<'_>) -> HashMap<String, OwnedValue> {
    proxy
        .get_property::<HashMap<String, OwnedValue>>("Metadata")
        .unwrap_or_default()
}

fn metadata_string(metadata: &HashMap<String, OwnedValue>, key: &str) -> Option<String> {
    let value = metadata.get(key)?.try_clone().ok()?;
    let text = String::try_from(value).ok()?;
    if text.trim().is_empty() {
        None
    } else {
        Some(text)
    }
}

fn metadata_string_list(metadata: &HashMap<String, OwnedValue>, key: &str) -> Vec<String> {
    let Some(value) = metadata.get(key).and_then(|value| value.try_clone().ok()) else {
        return Vec::new();
    };

    if let Ok(items) = Vec::<String>::try_from(value.clone()) {
        return items;
    }
    if let Ok(item) = String::try_from(value) {
        return vec![item];
    }

    Vec::new()
}

fn metadata_micros(metadata: &HashMap<String, OwnedValue>, key: &str) -> i64 {
    metadata
        .get(key)
        .and_then(|value| value.try_clone().ok())
        .and_then(|value| i64::try_from(value).ok())
        .unwrap_or(0)
}

fn metadata_track_id(metadata: &HashMap<String, OwnedValue>) -> Option<OwnedObjectPath> {
    let value = metadata.get("mpris:trackid")?.try_clone().ok()?;
    OwnedObjectPath::try_from(value).ok()
}

fn snapshot_from(proxy: &Proxy<'_>, session: &PlayerSession) -> Option<MediaSnapshot> {
    let metadata = metadata_map(proxy);
    let status = playback_status(proxy);
    if status == "Stopped" {
        return None;
    }

    let can_control = proxy
        .get_property::<bool>("CanControl")
        .unwrap_or(false);
    let can_seek = proxy.get_property::<bool>("CanSeek").unwrap_or(false);
    let can_next = proxy.get_property::<bool>("CanGoNext").unwrap_or(false);
    let can_previous = proxy
        .get_property::<bool>("CanGoPrevious")
        .unwrap_or(false);

    Some(MediaSnapshot {
        track: metadata_string(&metadata, "xesam:title").unwrap_or_default(),
        artist: metadata_string_list(&metadata, "xesam:artist").join(", "),
        album: metadata_string(&metadata, "xesam:album").unwrap_or_default(),
        artwork_data_url: None,
        duration: micros_to_seconds(metadata_micros(&metadata, "mpris:length")),
        position: proxy
            .get_property::<i64>("Position")
            .map(micros_to_seconds)
            .unwrap_or(0.0),
        is_playing: status == "Playing",
        source_name: session.identity.clone(),
        source_id: session.bus_name.clone(),
        can_seek,
        can_skip: can_next || can_previous,
        can_control,
    })
}

fn read_artwork(uri: &str) -> Option<String> {
    if uri.is_empty() {
        return None;
    }
    if uri.starts_with("data:") {
        return Some(uri.to_string());
    }

    if let Some(path) = uri.strip_prefix("file://") {
        let decoded = percent_decode(path);
        let bytes = std::fs::read(decoded).ok()?;
        return bytes_to_data_url(&bytes);
    }

    if uri.starts_with("http://") || uri.starts_with("https://") {
        let response = ureq::get(uri).timeout(ARTWORK_TIMEOUT).call().ok()?;
        let mut bytes = Vec::new();
        response
            .into_reader()
            .take(MAX_ARTWORK_BYTES)
            .read_to_end(&mut bytes)
            .ok()?;
        return bytes_to_data_url(&bytes);
    }

    None
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).ok();
            if let Some(byte) = hex.and_then(|hex| u8::from_str_radix(hex, 16).ok()) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }

    String::from_utf8_lossy(&out).into_owned()
}

pub(crate) async fn current_media_snapshot_with_metadata() -> Result<Option<MediaSnapshot>> {
    tokio::task::spawn_blocking(|| {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection)? else {
            return Ok(None);
        };
        let proxy = player_proxy(&connection, &session.bus_name)?;

        Ok(snapshot_from(&proxy, &session))
    })
    .await?
}

pub(crate) async fn current_media_snapshot_with_artwork() -> Result<Option<MediaSnapshot>> {
    tokio::task::spawn_blocking(|| {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection)? else {
            return Ok(None);
        };
        let proxy = player_proxy(&connection, &session.bus_name)?;
        let Some(mut snapshot) = snapshot_from(&proxy, &session) else {
            return Ok(None);
        };

        let metadata = metadata_map(&proxy);
        if let Some(url) = metadata_string(&metadata, "mpris:artUrl") {
            snapshot.artwork_data_url = read_artwork(&url);
        }

        Ok(Some(snapshot))
    })
    .await?
}

fn call_player_method(method: &str, body: &(impl serde::Serialize + zbus::zvariant::DynamicType)) -> Result<()> {
    let connection = session_bus()?;
    let Some(session) = active_session(&connection)? else {
        return Err(anyhow!("no active MPRIS media session"));
    };
    let proxy = player_proxy(&connection, &session.bus_name)?;
    proxy
        .call_method(method, body)
        .map_err(|error| anyhow!("MPRIS {method} failed: {error}"))?;

    Ok(())
}

pub(crate) async fn play() -> Result<()> {
    tokio::task::spawn_blocking(|| call_player_method("Play", &()))
        .await?
}

pub(crate) async fn pause() -> Result<()> {
    tokio::task::spawn_blocking(|| call_player_method("Pause", &()))
        .await?
}

pub(crate) async fn toggle_play_pause() -> Result<()> {
    tokio::task::spawn_blocking(|| call_player_method("PlayPause", &()))
        .await?
}

pub(crate) async fn next() -> Result<()> {
    tokio::task::spawn_blocking(|| call_player_method("Next", &()))
        .await?
}

pub(crate) async fn previous() -> Result<()> {
    tokio::task::spawn_blocking(|| call_player_method("Previous", &()))
        .await?
}

pub(crate) async fn seek(seconds: f64) -> Result<()> {
    if !seconds.is_finite() || seconds < 0.0 {
        return Err(anyhow!("invalid seek target: {seconds}"));
    }

    tokio::task::spawn_blocking(move || {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection)? else {
            return Err(anyhow!("no active MPRIS media session"));
        };
        let proxy = player_proxy(&connection, &session.bus_name)?;
        let metadata = metadata_map(&proxy);
        let track_id = metadata_track_id(&metadata)
            .ok_or_else(|| anyhow!("active session does not expose a track id for seeking"))?;
        let position = (seconds * MICROS_PER_SECOND).round() as i64;

        proxy
            .call_method("SetPosition", &(track_id, position))
            .map_err(|error| anyhow!("MPRIS SetPosition failed: {error}"))?;

        Ok(())
    })
    .await?
}

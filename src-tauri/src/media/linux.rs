// Linux media integration over MPRIS (org.mpris.MediaPlayer2.*) on the session
// D-Bus. Mirrors the Windows SMTC surface so the rest of the app (poller,
// commands, frontend contract) stays platform-agnostic.

use std::collections::{HashMap, HashSet};
use std::io::Read;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use anyhow::{anyhow, Result};
use zbus::blocking::{Connection, MessageIterator, Proxy};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::{fdo::NameOwnerChanged, MatchRule};

use super::artwork::{store_artwork, store_data_uri, MAX_ARTWORK_BYTES};
use super::model::{
    mpris_loop_status, order_players, repeat_mode_from_mpris, MediaPlayer, MediaSnapshot,
    REPEAT_MODE_OFF,
};

const MPRIS_PREFIX: &str = "org.mpris.MediaPlayer2.";
const MPRIS_ROOT_IFACE: &str = "org.mpris.MediaPlayer2";
const MPRIS_PLAYER_IFACE: &str = "org.mpris.MediaPlayer2.Player";
const MPRIS_PATH: &str = "/org/mpris/MediaPlayer2";
const MICROS_PER_SECOND: f64 = 1_000_000.0;
const ARTWORK_TIMEOUT: Duration = Duration::from_secs(6);

#[derive(Debug, Clone)]
struct PlayerSession {
    bus_name: String,
    identity: String,
}

static SESSION_BUS: OnceLock<Connection> = OnceLock::new();
static IDENTITIES: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

/// One shared session-bus connection for the whole app. D-Bus connections are
/// thread-safe and cheap to clone, and reconnecting per poll costs a full
/// handshake several times a second.
fn session_bus() -> Result<Connection> {
    if let Some(connection) = SESSION_BUS.get() {
        return Ok(connection.clone());
    }

    let connection =
        Connection::session().map_err(|error| anyhow!("cannot connect to session bus: {error}"))?;
    let _ = SESSION_BUS.set(connection.clone());
    Ok(connection)
}

fn identity_cache() -> &'static Mutex<HashMap<String, String>> {
    IDENTITIES.get_or_init(|| Mutex::new(HashMap::new()))
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
    {
        let cache = identity_cache()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if let Some(identity) = cache.get(bus_name) {
            return identity.clone();
        }
    }

    let identity = root_proxy(connection, bus_name)
        .and_then(|proxy| {
            proxy
                .get_property::<String>("Identity")
                .map_err(|error| anyhow!(error.to_string()))
        })
        .map(|identity| super::model::display_source_name(identity.trim()))
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
        });

    let mut cache = identity_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if cache.len() > 128 {
        cache.clear();
    }
    cache.insert(bus_name.to_string(), identity.clone());
    identity
}

fn forget_identity(bus_name: &str) {
    identity_cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .remove(bus_name);
}

/// Picks the session we should treat as "the deck". An explicit selection wins
/// when its bus name is still on the bus; otherwise Auto follows the playing
/// session, then the poller's last playing session, then the first paused one.
fn active_session(
    connection: &Connection,
    selected: Option<&str>,
    fallback: Option<&str>,
) -> Result<Option<PlayerSession>> {
    let sessions = sessions_with_status(connection)?;

    if let Some(selected) = selected.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some((session, _)) = sessions
            .iter()
            .find(|(session, _)| session.bus_name == selected)
        {
            return Ok(Some(session.clone()));
        }
    }

    if let Some((session, _)) = sessions
        .iter()
        .find(|(_, status)| status.as_str() == "Playing")
    {
        return Ok(Some(session.clone()));
    }

    if let Some(fallback) = fallback.map(str::trim).filter(|value| !value.is_empty()) {
        if let Some((session, _)) = sessions
            .iter()
            .find(|(session, _)| session.bus_name == fallback)
        {
            return Ok(Some(session.clone()));
        }
    }

    Ok(sessions
        .into_iter()
        .find(|(_, status)| status.as_str() == "Paused")
        .map(|(session, _)| session))
}

fn sessions_with_status(connection: &Connection) -> Result<Vec<(PlayerSession, String)>> {
    let mut sessions = Vec::new();
    let mut seen = HashSet::new();

    for bus_name in bus_names(connection)? {
        if !seen.insert(bus_name.clone()) {
            continue;
        }
        let status = {
            let Ok(proxy) = player_proxy(connection, &bus_name) else {
                continue;
            };
            playback_status(&proxy)
        };
        let identity = identity_for(connection, &bus_name);
        sessions.push((PlayerSession { bus_name, identity }, status));
    }

    Ok(sessions)
}

/// Enumerates every live MPRIS player for the Settings picker.
pub(crate) async fn list_players() -> Result<Vec<MediaPlayer>> {
    tokio::task::spawn_blocking(|| {
        let connection = session_bus()?;
        let players = sessions_with_status(&connection)?
            .into_iter()
            .map(|(session, status)| MediaPlayer {
                id: session.bus_name,
                name: session.identity,
                is_playing: status == "Playing",
            })
            .collect();

        Ok(order_players(players))
    })
    .await?
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

    let can_control = proxy.get_property::<bool>("CanControl").unwrap_or(false);
    let can_seek = proxy.get_property::<bool>("CanSeek").unwrap_or(false);
    let can_next = proxy.get_property::<bool>("CanGoNext").unwrap_or(false);
    let can_previous = proxy.get_property::<bool>("CanGoPrevious").unwrap_or(false);

    // LoopStatus/Shuffle are readable on most MPRIS players. Readability plus
    // CanControl is our capability signal; CanControl false forces both off.
    let loop_status = proxy.get_property::<String>("LoopStatus").ok();
    let shuffle = proxy.get_property::<bool>("Shuffle").ok();
    let repeat_mode = loop_status
        .as_deref()
        .map(repeat_mode_from_mpris)
        .unwrap_or(REPEAT_MODE_OFF);

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
        can_repeat: can_control && loop_status.is_some(),
        can_shuffle: can_control && shuffle.is_some(),
        repeat_mode: repeat_mode.to_string(),
        shuffle: shuffle.unwrap_or(false),
    })
}

fn read_artwork(uri: &str) -> Option<String> {
    if uri.is_empty() {
        return None;
    }
    if uri.starts_with("data:") {
        return store_data_uri(uri).or_else(|| Some(uri.to_string()));
    }

    if let Some(path) = uri.strip_prefix("file://") {
        let decoded = percent_decode(path);
        // Check the size before reading: cover files can be tens of megabytes.
        let metadata = std::fs::metadata(&decoded).ok()?;
        if metadata.len() == 0 || metadata.len() > MAX_ARTWORK_BYTES as u64 {
            return None;
        }
        let bytes = std::fs::read(decoded).ok()?;
        return store_artwork(&bytes);
    }

    if uri.starts_with("http://") || uri.starts_with("https://") {
        let response = ureq::get(uri).timeout(ARTWORK_TIMEOUT).call().ok()?;
        let mut bytes = Vec::new();
        response
            .into_reader()
            .take(MAX_ARTWORK_BYTES as u64 + 1)
            .read_to_end(&mut bytes)
            .ok()?;
        if bytes.len() > MAX_ARTWORK_BYTES {
            return None;
        }
        return store_artwork(&bytes);
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

pub(crate) async fn current_media_snapshot_with_metadata(
    selected: Option<String>,
    fallback: Option<String>,
) -> Result<Option<MediaSnapshot>> {
    tokio::task::spawn_blocking(move || {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection, selected.as_deref(), fallback.as_deref())?
        else {
            return Ok(None);
        };
        let proxy = player_proxy(&connection, &session.bus_name)?;

        Ok(snapshot_from(&proxy, &session))
    })
    .await?
}

pub(crate) async fn current_media_snapshot_with_artwork(
    selected: Option<String>,
    fallback: Option<String>,
) -> Result<Option<MediaSnapshot>> {
    tokio::task::spawn_blocking(move || {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection, selected.as_deref(), fallback.as_deref())?
        else {
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

fn properties_changed_rule() -> Option<zbus::MatchRule<'static>> {
    let rule = MatchRule::builder()
        .msg_type(zbus::message::Type::Signal)
        .interface("org.freedesktop.DBus.Properties")
        .ok()?
        .member("PropertiesChanged")
        .ok()?
        .path(MPRIS_PATH)
        .ok()?;
    Some(rule.build())
}

fn name_owner_changed_rule() -> Option<zbus::MatchRule<'static>> {
    let rule = MatchRule::builder()
        .msg_type(zbus::message::Type::Signal)
        .interface("org.freedesktop.DBus")
        .ok()?
        .member("NameOwnerChanged")
        .ok()?;
    Some(rule.build())
}

pub(crate) fn spawn_event_watchers() {
    let _ = std::thread::Builder::new()
        .name("vinyldeck-mpris-props".to_string())
        .spawn(|| {
            let Ok(connection) = session_bus() else {
                return;
            };
            let Some(rule) = properties_changed_rule() else {
                return;
            };
            let Ok(mut events) = MessageIterator::for_match_rule(rule, &connection, Some(64))
            else {
                return;
            };

            for _ in events.by_ref() {
                crate::media::poller::wake_poller();
            }
        });

    let _ = std::thread::Builder::new()
        .name("vinyldeck-mpris-names".to_string())
        .spawn(|| {
            let Ok(connection) = session_bus() else {
                return;
            };
            let Some(rule) = name_owner_changed_rule() else {
                return;
            };
            let Ok(events) = MessageIterator::for_match_rule(rule, &connection, Some(64)) else {
                return;
            };

            for message in events {
                let Ok(message) = message else {
                    continue;
                };
                let Some(signal) = NameOwnerChanged::from_message(message) else {
                    continue;
                };
                let Ok(args) = signal.args() else {
                    continue;
                };
                let name = args.name().as_str();
                if !name.starts_with(MPRIS_PREFIX) {
                    continue;
                }
                forget_identity(name);
                crate::media::poller::wake_poller();
            }
        });
}

fn call_player_method(
    method: &str,
    body: &(impl serde::Serialize + zbus::zvariant::DynamicType),
    source_id: Option<&str>,
) -> Result<()> {
    let connection = session_bus()?;
    let Some(session) = active_session(&connection, source_id, None)? else {
        return Err(anyhow!("no active MPRIS media session"));
    };
    let proxy = player_proxy(&connection, &session.bus_name)?;
    proxy
        .call_method(method, body)
        .map_err(|error| anyhow!("MPRIS {method} failed: {error}"))?;

    Ok(())
}

pub(crate) async fn play(source_id: Option<&str>) -> Result<()> {
    let source_id = source_id.map(str::to_string);
    tokio::task::spawn_blocking(move || call_player_method("Play", &(), source_id.as_deref()))
        .await?
}

pub(crate) async fn pause(source_id: Option<&str>) -> Result<()> {
    let source_id = source_id.map(str::to_string);
    tokio::task::spawn_blocking(move || call_player_method("Pause", &(), source_id.as_deref()))
        .await?
}

pub(crate) async fn toggle_play_pause(source_id: Option<&str>) -> Result<()> {
    let source_id = source_id.map(str::to_string);
    tokio::task::spawn_blocking(move || call_player_method("PlayPause", &(), source_id.as_deref()))
        .await?
}

pub(crate) async fn next(source_id: Option<&str>) -> Result<()> {
    let source_id = source_id.map(str::to_string);
    tokio::task::spawn_blocking(move || call_player_method("Next", &(), source_id.as_deref()))
        .await?
}

pub(crate) async fn previous(source_id: Option<&str>) -> Result<()> {
    let source_id = source_id.map(str::to_string);
    tokio::task::spawn_blocking(move || call_player_method("Previous", &(), source_id.as_deref()))
        .await?
}

pub(crate) async fn seek(seconds: f64, source_id: Option<&str>) -> Result<()> {
    if !seconds.is_finite() || seconds < 0.0 {
        return Err(anyhow!("invalid seek target: {seconds}"));
    }

    let source_id = source_id.map(str::to_string);
    tokio::task::spawn_blocking(move || {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection, source_id.as_deref(), None)? else {
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

/// Writes MPRIS `LoopStatus`. Accepts only `off`, `all`, or `one`; any other
/// value is rejected before touching D-Bus.
pub(crate) async fn set_repeat(mode: &str, source_id: Option<&str>) -> Result<()> {
    let loop_status = mpris_loop_status(mode)
        .ok_or_else(|| anyhow!("invalid repeat mode: {mode}; expected off, all, or one"))?;
    let source_id = source_id.map(str::to_string);

    tokio::task::spawn_blocking(move || {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection, source_id.as_deref(), None)? else {
            return Err(anyhow!("no active MPRIS media session"));
        };
        let proxy = player_proxy(&connection, &session.bus_name)?;
        proxy
            .set_property("LoopStatus", loop_status)
            .map_err(|error| {
                anyhow!(
                    "MPRIS LoopStatus set failed for {}: {error}",
                    session.bus_name
                )
            })
    })
    .await?
}

/// Writes MPRIS `Shuffle`.
pub(crate) async fn set_shuffle(enabled: bool, source_id: Option<&str>) -> Result<()> {
    let source_id = source_id.map(str::to_string);

    tokio::task::spawn_blocking(move || {
        let connection = session_bus()?;
        let Some(session) = active_session(&connection, source_id.as_deref(), None)? else {
            return Err(anyhow!("no active MPRIS media session"));
        };
        let proxy = player_proxy(&connection, &session.bus_name)?;
        proxy
            .set_property("Shuffle", enabled)
            .map_err(|error| anyhow!("MPRIS Shuffle set failed for {}: {error}", session.bus_name))
    })
    .await?
}

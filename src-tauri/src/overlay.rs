//! Local OBS overlay.
//!
//! A tiny read-only HTTP server bound to localhost. OBS (or any browser
//! source) loads `/overlay`; `/state` exposes the current snapshot as JSON for
//! custom integrations, and `/artwork` serves the cached cover bytes because a
//! browser source cannot resolve the `vinyldeck:` scheme.
//!
//! There are no write endpoints and the socket is bound to 127.0.0.1, so the
//! only thing a page on the machine can do is read what is already public on
//! the user's screen.

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::media::{artwork, authority::PlaybackAuthority};

pub const OVERLAY_ADDR: &str = "127.0.0.1:43110";
const MAX_REQUEST_BYTES: usize = 8 * 1024;

pub fn start(app: AppHandle) {
    let spawned = std::thread::Builder::new()
        .name("vinyldeck-overlay".to_string())
        .spawn(move || {
            let listener = match TcpListener::bind(OVERLAY_ADDR) {
                Ok(listener) => listener,
                Err(error) => {
                    eprintln!("[VinylDeck overlay] cannot bind {OVERLAY_ADDR}: {error}");
                    return;
                }
            };

            for stream in listener.incoming() {
                let Ok(stream) = stream else {
                    continue;
                };
                let app = app.clone();
                let _ = std::thread::Builder::new()
                    .name("vinyldeck-overlay-request".to_string())
                    .spawn(move || serve(&app, stream));
            }
        });

    if let Err(error) = spawned {
        eprintln!("[VinylDeck overlay] failed to start server: {error}");
    }
}

fn serve(app: &AppHandle, mut stream: TcpStream) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let mut request = [0_u8; MAX_REQUEST_BYTES];
    let read = stream.read(&mut request).unwrap_or(0);
    let request = String::from_utf8_lossy(&request[..read]);
    let path = request
        .split_whitespace()
        .nth(1)
        .unwrap_or("/")
        .split('?')
        .next()
        .unwrap_or("/");

    let (status, content_type, body) = match path {
        "/" | "/overlay" => (
            "200 OK",
            "text/html; charset=utf-8",
            OVERLAY_HTML.as_bytes().to_vec(),
        ),
        "/state" => (
            "200 OK",
            "application/json",
            serde_json::to_vec(&state_json(app)).unwrap_or_else(|_| b"{}".to_vec()),
        ),
        "/artwork" => match current_artwork(app) {
            Some((bytes, mime)) => ("200 OK", mime, bytes),
            None => ("404 Not Found", "text/plain; charset=utf-8", Vec::new()),
        },
        "/favicon.ico" => ("204 No Content", "image/x-icon", Vec::new()),
        _ => (
            "404 Not Found",
            "text/plain; charset=utf-8",
            b"not found".to_vec(),
        ),
    };

    let header = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(&body);
    let _ = stream.flush();
}

fn state_json(app: &AppHandle) -> serde_json::Value {
    let snapshot = app
        .try_state::<PlaybackAuthority>()
        .and_then(|authority| authority.snapshot());
    let Some(snapshot) = snapshot else {
        return serde_json::json!({
            "active": false,
            "isPlaying": false,
            "position": 0,
            "duration": 0,
            "updatedAt": now_millis(),
        });
    };

    let artwork_url = snapshot.artwork_data_url.as_deref().map(|uri| {
        if uri.starts_with("vinyldeck://art/") {
            "/artwork".to_string()
        } else {
            uri.to_string()
        }
    });

    serde_json::json!({
        "active": true,
        "track": snapshot.track,
        "artist": snapshot.artist,
        "album": snapshot.album,
        "sourceName": snapshot.source_name,
        "isPlaying": snapshot.is_playing,
        "position": snapshot.position,
        "duration": snapshot.duration,
        "artworkUrl": artwork_url,
        "updatedAt": now_millis(),
    })
}

fn current_artwork(app: &AppHandle) -> Option<(Vec<u8>, &'static str)> {
    let snapshot = app
        .try_state::<PlaybackAuthority>()
        .and_then(|authority| authority.snapshot())?;
    let uri = snapshot.artwork_data_url?;
    artwork::bytes_for_uri(&uri)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

const OVERLAY_HTML: &str = r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VinylDeck Overlay</title>
<style>
  :root { color-scheme: dark; --accent: #d9b45c; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: transparent; }
  body {
    display: flex; align-items: center; justify-content: center;
    font-family: "Inter", "Segoe UI", system-ui, sans-serif; color: #f4f1ea;
  }
  .deck {
    display: flex; align-items: center; gap: 22px; width: min(760px, 100%);
    padding: 18px 26px 18px 18px; border-radius: 26px;
    background: rgba(10, 10, 12, 0.62);
    border: 1px solid rgba(255, 255, 255, 0.09);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
  }
  .art {
    width: 128px; height: 128px; flex: 0 0 128px; border-radius: 14px;
    object-fit: cover; background: radial-gradient(circle at 50% 50%, #2b2b30, #0c0c0f);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }
  .meta { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .track {
    font-family: "Sora", "Inter", sans-serif; font-size: 26px; font-weight: 600;
    line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .artist { font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.62; }
  .album { font-size: 13px; opacity: 0.4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar { position: relative; height: 4px; margin-top: 14px; border-radius: 999px; background: rgba(255,255,255,0.1); overflow: hidden; }
  .bar > i { position: absolute; inset: 0 auto 0 0; width: 0; background: linear-gradient(90deg, var(--accent), #fff); border-radius: inherit; }
  .time { display: flex; justify-content: space-between; margin-top: 7px; font-size: 11px; opacity: 0.45; font-variant-numeric: tabular-nums; }
  body[data-active="false"] .deck { opacity: 0.45; }
  body[data-active="false"] .art { filter: grayscale(1) brightness(0.6); }
</style>
</head>
<body data-active="false">
  <div class="deck">
    <img class="art" id="art" alt="">
    <div class="meta">
      <div class="track" id="track">Nothing playing</div>
      <div class="artist" id="artist"></div>
      <div class="album" id="album"></div>
      <div class="bar"><i id="fill"></i></div>
      <div class="time"><span id="elapsed">0:00</span><span id="total">0:00</span></div>
    </div>
  </div>
<script>
(() => {
  let state = { active: false, isPlaying: false, position: 0, duration: 0 };
  let fetchedAt = performance.now();
  let artUrl = null;
  const el = (id) => document.getElementById(id);

  function clock(seconds) {
    const whole = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  async function poll() {
    try {
      const response = await fetch("/state", { cache: "no-store" });
      if (!response.ok) return;
      state = await response.json();
      fetchedAt = performance.now();
      document.body.dataset.active = String(Boolean(state.active));
      el("track").textContent = state.track || "Nothing playing";
      el("artist").textContent = state.artist || "";
      el("album").textContent = state.album || "";
      el("total").textContent = clock(state.duration);
      if (state.artworkUrl && state.artworkUrl !== artUrl) {
        artUrl = state.artworkUrl;
        el("art").src = artUrl;
      } else if (!state.artworkUrl) {
        artUrl = null;
        el("art").removeAttribute("src");
      }
    } catch (_) {
      document.body.dataset.active = "false";
    }
  }

  function frame() {
    const elapsedSeconds = (performance.now() - fetchedAt) / 1000;
    const position = state.isPlaying
      ? Math.min(state.duration || Infinity, (state.position || 0) + elapsedSeconds)
      : state.position || 0;
    const progress = state.duration > 0 ? Math.min(1, position / state.duration) : 0;
    el("fill").style.width = `${progress * 100}%`;
    el("elapsed").textContent = clock(position);
    requestAnimationFrame(frame);
  }

  poll();
  setInterval(poll, 1000);
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>
"#;

#[cfg(test)]
mod tests {
    use super::now_millis;

    #[test]
    fn clock_source_is_sane() {
        // 2020-01-01; guards against a broken epoch conversion.
        assert!(now_millis() > 1_577_836_800_000);
    }
}

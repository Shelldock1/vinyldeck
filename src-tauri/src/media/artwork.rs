//! Artwork byte cache and the `vinyldeck://art/<hash>` scheme.
//!
//! Snapshots carry a short URL instead of a multi-megabyte base64 payload.
//! The bytes stay in this process-wide cache and are served on demand by the
//! `vinyldeck` URI scheme registered in `lib.rs`.

use std::collections::{HashMap, VecDeque};
use std::hash::{Hash, Hasher};
use std::sync::{Mutex, OnceLock};

use base64::{engine::general_purpose, Engine as _};

pub(crate) const MAX_ARTWORK_BYTES: usize = 5 * 1024 * 1024;
const MAX_CACHED_ARTWORKS: usize = 8;
const MAX_CACHE_BYTES: usize = 24 * 1024 * 1024;
const URI_PREFIX: &str = "vinyldeck://art/";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ArtworkMime {
    Jpeg,
    Png,
    WebP,
    Gif,
}

impl ArtworkMime {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Jpeg => "image/jpeg",
            Self::Png => "image/png",
            Self::WebP => "image/webp",
            Self::Gif => "image/gif",
        }
    }
}

pub(crate) fn detect_artwork_mime(bytes: &[u8]) -> Option<ArtworkMime> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(ArtworkMime::Jpeg);
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(ArtworkMime::Png);
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some(ArtworkMime::WebP);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(ArtworkMime::Gif);
    }

    None
}

struct CachedArtwork {
    bytes: Vec<u8>,
    mime: &'static str,
}

struct ArtworkCache {
    entries: HashMap<u64, CachedArtwork>,
    order: VecDeque<u64>,
    total_bytes: usize,
}

fn cache() -> &'static Mutex<ArtworkCache> {
    static CACHE: OnceLock<Mutex<ArtworkCache>> = OnceLock::new();
    CACHE.get_or_init(|| {
        Mutex::new(ArtworkCache {
            entries: HashMap::new(),
            order: VecDeque::new(),
            total_bytes: 0,
        })
    })
}

fn hash_bytes(bytes: &[u8]) -> u64 {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    hasher.finish()
}

/// Stores validated image bytes and returns the URI that serves them.
pub(crate) fn store_artwork(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() || bytes.len() > MAX_ARTWORK_BYTES {
        return None;
    }

    let mime = detect_artwork_mime(bytes)?.as_str();
    let hash = hash_bytes(bytes);
    let mut cache = cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());

    if !cache.entries.contains_key(&hash) {
        cache.total_bytes += bytes.len();
        cache.entries.insert(
            hash,
            CachedArtwork {
                bytes: bytes.to_vec(),
                mime,
            },
        );
        cache.order.push_back(hash);

        while cache.entries.len() > MAX_CACHED_ARTWORKS
            || (cache.total_bytes > MAX_CACHE_BYTES && cache.entries.len() > 1)
        {
            let Some(oldest) = cache.order.pop_front() else {
                break;
            };
            if let Some(entry) = cache.entries.remove(&oldest) {
                cache.total_bytes = cache.total_bytes.saturating_sub(entry.bytes.len());
            }
        }
    }

    Some(format!("{URI_PREFIX}{hash:016x}"))
}

/// Some players hand MPRIS a `data:` URL instead of a file or HTTP one.
/// Decode and cache it so those do not bypass the URI scheme either.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
pub(crate) fn store_data_uri(uri: &str) -> Option<String> {
    let (header, payload) = uri.split_once(',')?;
    if !header.starts_with("data:image/") || !header.contains(";base64") {
        return None;
    }
    let bytes = general_purpose::STANDARD.decode(payload.trim()).ok()?;
    store_artwork(&bytes)
}

/// Removes one artwork from the cache (used by tests).
#[cfg(test)]
pub(crate) fn clear_cache() {
    let mut cache = cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    cache.entries.clear();
    cache.order.clear();
    cache.total_bytes = 0;
}

fn decode_percent(value: &str) -> String {
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

fn request_hash(path: &str) -> Option<u64> {
    let decoded = decode_percent(path);
    let trimmed = decoded.trim_start_matches('/');
    let hash = trimmed.strip_prefix("art/").unwrap_or(trimmed);
    let hash = hash.trim_matches('/');
    u64::from_str_radix(hash, 16).ok()
}

fn cached_artwork(hash: u64) -> Option<(Vec<u8>, &'static str)> {
    let mut cache = cache()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(position) = cache.order.iter().position(|entry| *entry == hash) {
        cache.order.remove(position);
        cache.order.push_back(hash);
    }
    let entry = cache.entries.get(&hash)?;
    Some((entry.bytes.clone(), entry.mime))
}

/// Resolves the internal artwork URI carried by snapshots. Used by the OBS
/// overlay, which cannot load the `vinyldeck:` scheme in its own webview.
pub(crate) fn bytes_for_uri(uri: &str) -> Option<(Vec<u8>, &'static str)> {
    let hash = uri.strip_prefix(URI_PREFIX)?;
    let hash = u64::from_str_radix(hash, 16).ok()?;
    cached_artwork(hash)
}

fn artwork_response(hash: u64) -> Option<tauri::http::Response<Vec<u8>>> {
    let (bytes, mime) = cached_artwork(hash)?;

    tauri::http::Response::builder()
        .status(200)
        .header("Content-Type", mime)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        // The WebGL renderer loads this cross-origin into a texture.
        .header("Access-Control-Allow-Origin", "*")
        .body(bytes)
        .ok()
}

/// Handler for the registered `vinyldeck` URI scheme.
pub(crate) fn protocol_response(path: &str) -> tauri::http::Response<Vec<u8>> {
    if let Some(response) = request_hash(path).and_then(artwork_response) {
        return response;
    }

    tauri::http::Response::builder()
        .status(404)
        .header("Access-Control-Allow-Origin", "*")
        .body(Vec::new())
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

#[cfg(windows)]
pub(crate) async fn thumbnail_to_artwork_url(
    thumbnail: windows::Storage::Streams::IRandomAccessStreamReference,
) -> anyhow::Result<Option<String>> {
    use windows::Storage::Streams::DataReader;

    let stream = thumbnail.OpenReadAsync()?.await?;
    let size = stream.Size()? as usize;
    if size == 0 || size > MAX_ARTWORK_BYTES {
        return Ok(None);
    }

    let reader = DataReader::CreateDataReader(&stream)?;
    reader.LoadAsync(size as u32)?.await?;

    let mut bytes = vec![0_u8; size];
    reader.ReadBytes(&mut bytes)?;

    Ok(store_artwork(&bytes))
}

#[cfg(test)]
mod tests {
    use super::{
        clear_cache, detect_artwork_mime, protocol_response, store_artwork, ArtworkMime,
        MAX_ARTWORK_BYTES,
    };

    #[test]
    fn detects_supported_image_magic_bytes() {
        assert_eq!(
            detect_artwork_mime(&[0xFF, 0xD8, 0xFF, 0xE0]),
            Some(ArtworkMime::Jpeg)
        );
        assert_eq!(
            detect_artwork_mime(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]),
            Some(ArtworkMime::Png)
        );
        assert_eq!(
            detect_artwork_mime(b"RIFF\x24\x00\x00\x00WEBPVP8 "),
            Some(ArtworkMime::WebP)
        );
        assert_eq!(
            detect_artwork_mime(b"GIF89a\x01\x00"),
            Some(ArtworkMime::Gif)
        );
        assert_eq!(detect_artwork_mime(b"not image"), None);
    }

    #[test]
    fn stores_valid_bytes_and_serves_them_by_uri() {
        clear_cache();
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let url = store_artwork(&jpeg).expect("stored");
        assert!(url.starts_with("vinyldeck://art/"));

        let hash = url.trim_start_matches("vinyldeck://art/");
        let response = protocol_response(&format!("/art/{hash}"));
        assert_eq!(response.status(), 200);
        assert_eq!(response.body(), &jpeg);
        assert_eq!(
            response.headers().get("Content-Type").unwrap(),
            "image/jpeg"
        );

        // Both the encoded and the direct path shapes resolve.
        let encoded = protocol_response(&format!("/art%2F{hash}"));
        assert_eq!(encoded.status(), 200);
    }

    #[test]
    fn rejects_empty_unknown_oversized_and_unknown_hashes() {
        clear_cache();
        assert_eq!(store_artwork(&[]), None);
        assert_eq!(store_artwork(b"not image"), None);

        let oversized = vec![0_u8; MAX_ARTWORK_BYTES + 1];
        assert_eq!(store_artwork(&oversized), None);

        assert_eq!(protocol_response("/art/deadbeef").status(), 404);
    }
}

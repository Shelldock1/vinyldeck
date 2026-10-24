//! Manual update check.
//
// The app never downloads or installs an update on its own: signing keys for
// the Tauri updater are not part of the release pipeline yet. Instead the
// About tab asks this module for the newest published GitHub release, compares
// its tag with the running build and offers to open the release page. The HTTP
// request runs in Rust so the webview CSP stays closed to third-party origins.

use std::{io::Read, process::Command, time::Duration};

use serde::{Deserialize, Serialize};

const RELEASE_API: &str = "https://api.github.com/repos/Shelldock1/vinyldeck/releases/latest";
const RELEASE_PREFIX: &str = "https://github.com/Shelldock1/vinyldeck/releases";
const USER_AGENT: &str = concat!("VinylDeck/", env!("CARGO_PKG_VERSION"));
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_RESPONSE_BYTES: u64 = 256 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_url: String,
    pub published_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReleaseResponse {
    tag_name: String,
    html_url: String,
    published_at: Option<String>,
}

/// Parse a release tag such as `v0.2.0` or `0.2.0` into its numeric core.
/// Pre-release/build suffixes are ignored for the comparison; a release that
/// only differs by suffix is not advertised as newer.
fn parse_version(value: &str) -> Option<(u64, u64, u64)> {
    let trimmed = value.trim().trim_start_matches(['v', 'V']);
    let core = trimmed.split(['-', '+']).next()?;
    let mut parts = core.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next().unwrap_or("0").parse().ok()?;
    let patch = parts.next().unwrap_or("0").parse().ok()?;
    Some((major, minor, patch))
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(latest), Some(current)) => latest > current,
        _ => false,
    }
}

fn status_from_release(current_version: &str, release: ReleaseResponse) -> UpdateStatus {
    UpdateStatus {
        current_version: current_version.to_string(),
        latest_version: release.tag_name.clone(),
        update_available: is_newer(&release.tag_name, current_version),
        release_url: release.html_url,
        published_at: release.published_at,
    }
}

fn fetch_latest_release() -> Result<UpdateStatus, String> {
    let response = ureq::get(RELEASE_API)
        .set("User-Agent", USER_AGENT)
        .set("Accept", "application/vnd.github+json")
        .timeout(REQUEST_TIMEOUT)
        .call()
        .map_err(|error| format!("release request failed: {error}"))?;

    let mut body = String::new();
    response
        .into_reader()
        .take(MAX_RESPONSE_BYTES)
        .read_to_string(&mut body)
        .map_err(|error| format!("release response could not be read: {error}"))?;

    let release: ReleaseResponse = serde_json::from_str(&body)
        .map_err(|error| format!("release response was not valid JSON: {error}"))?;

    Ok(status_from_release(env!("CARGO_PKG_VERSION"), release))
}

#[tauri::command]
pub async fn cmd_update_check() -> Result<UpdateStatus, String> {
    tauri::async_runtime::spawn_blocking(fetch_latest_release)
        .await
        .map_err(|error| format!("update check task failed: {error}"))?
}

/// Open the release page in the user's browser. Only URLs under the project's
/// GitHub releases path are accepted so the webview cannot use this command as
/// a generic launcher.
#[tauri::command]
pub fn cmd_open_release(url: String) -> Result<(), String> {
    if !url.starts_with(RELEASE_PREFIX) {
        return Err("refusing to open a URL outside the VinylDeck releases".into());
    }
    open_external(&url)
}

#[cfg(target_os = "linux")]
fn open_external(url: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the release page: {error}"))
}

#[cfg(target_os = "macos")]
fn open_external(url: &str) -> Result<(), String> {
    Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the release page: {error}"))
}

#[cfg(windows)]
fn open_external(url: &str) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    Command::new("cmd")
        .args(["/C", "start", "", url])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("could not open the release page: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release(tag: &str) -> ReleaseResponse {
        ReleaseResponse {
            tag_name: tag.to_string(),
            html_url: format!("{RELEASE_PREFIX}/tag/{tag}"),
            published_at: Some("2026-10-24T12:00:00Z".into()),
        }
    }

    #[test]
    fn parses_versions_with_and_without_prefixes() {
        assert_eq!(parse_version("v0.2.0"), Some((0, 2, 0)));
        assert_eq!(parse_version("0.2"), Some((0, 2, 0)));
        assert_eq!(parse_version("V1.4.12"), Some((1, 4, 12)));
        assert_eq!(parse_version("v0.2.0-beta.1"), Some((0, 2, 0)));
        assert_eq!(parse_version("nightly"), None);
    }

    #[test]
    fn compares_numeric_versions() {
        assert!(is_newer("v0.2.0", "0.1.1"));
        assert!(is_newer("0.10.0", "0.9.9"));
        assert!(!is_newer("v0.1.1", "0.1.1"));
        assert!(!is_newer("v0.1.0", "0.1.1"));
        assert!(!is_newer("v0.2.0-beta.1", "0.2.0"));
        assert!(!is_newer("unknown", "0.1.1"));
    }

    #[test]
    fn builds_status_from_release_tag() {
        let status = status_from_release("0.1.1", release("v0.2.0"));
        assert_eq!(status.current_version, "0.1.1");
        assert_eq!(status.latest_version, "v0.2.0");
        assert!(status.update_available);
        assert_eq!(status.release_url, format!("{RELEASE_PREFIX}/tag/v0.2.0"));
        assert_eq!(status.published_at.as_deref(), Some("2026-10-24T12:00:00Z"));

        let current = status_from_release("0.2.0", release("v0.2.0"));
        assert!(!current.update_available);
    }
}

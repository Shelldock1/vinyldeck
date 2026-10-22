use tauri::State;

use super::authority::PlaybackAuthority;
use super::model::{MediaPlayer, MediaSnapshot};

fn snapshot_fallback(authority: &PlaybackAuthority) -> Option<String> {
    authority
        .snapshot()
        .map(|snapshot| snapshot.source_id)
        .filter(|source_id| !source_id.is_empty())
}

#[tauri::command]
pub async fn cmd_media_players() -> Result<Vec<MediaPlayer>, String> {
    super::platform::list_players()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cmd_smtc_snapshot(
    authority: State<'_, PlaybackAuthority>,
) -> Result<Option<MediaSnapshot>, String> {
    super::platform::current_media_snapshot_with_metadata(
        authority.selection(),
        snapshot_fallback(&authority),
    )
    .await
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cmd_smtc_play(
    authority: State<'_, PlaybackAuthority>,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::play(source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_smtc_pause(
    authority: State<'_, PlaybackAuthority>,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::pause(source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_smtc_toggle_play_pause(
    authority: State<'_, PlaybackAuthority>,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::toggle_play_pause(source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_smtc_next(
    authority: State<'_, PlaybackAuthority>,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::next(source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_smtc_previous(
    authority: State<'_, PlaybackAuthority>,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::previous(source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_smtc_seek(
    authority: State<'_, PlaybackAuthority>,
    seconds: f64,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::seek(seconds, source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_media_set_repeat(
    authority: State<'_, PlaybackAuthority>,
    mode: String,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::set_repeat(&mode, source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

#[tauri::command]
pub async fn cmd_media_set_shuffle(
    authority: State<'_, PlaybackAuthority>,
    enabled: bool,
) -> Result<Option<MediaSnapshot>, String> {
    let source_id = authority.selected_source_id();
    super::platform::set_shuffle(enabled, source_id.as_deref())
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot(authority).await
}

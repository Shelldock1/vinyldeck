use tauri::{AppHandle, State};

use super::{emit_media_snapshot, model::MediaSnapshot, MediaState};

#[tauri::command]
pub async fn cmd_media_snapshot(state: State<'_, MediaState>) -> Result<MediaSnapshot, String> {
    Ok(state.snapshot().await)
}

#[tauri::command]
pub async fn cmd_media_play(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_play(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_pause(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_pause(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_toggle_play_pause(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_toggle_play_pause(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_next(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_next(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_previous(
    app: AppHandle,
    state: State<'_, MediaState>,
) -> Result<MediaSnapshot, String> {
    Ok(media_previous(&app, &state).await)
}

#[tauri::command]
pub async fn cmd_media_seek(
    app: AppHandle,
    state: State<'_, MediaState>,
    seconds: f64,
) -> Result<MediaSnapshot, String> {
    let snapshot = state.seek_to(seconds).await;
    emit_media_snapshot(&app, &snapshot);
    Ok(snapshot)
}

#[tauri::command]
pub async fn cmd_smtc_snapshot() -> Result<Option<MediaSnapshot>, String> {
    super::smtc::current_media_snapshot_with_metadata()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cmd_smtc_play() -> Result<Option<MediaSnapshot>, String> {
    super::smtc::play()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_pause() -> Result<Option<MediaSnapshot>, String> {
    super::smtc::pause()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_toggle_play_pause() -> Result<Option<MediaSnapshot>, String> {
    super::smtc::toggle_play_pause()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_next() -> Result<Option<MediaSnapshot>, String> {
    super::smtc::next()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_previous() -> Result<Option<MediaSnapshot>, String> {
    super::smtc::previous()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_seek(seconds: f64) -> Result<Option<MediaSnapshot>, String> {
    super::smtc::seek(seconds)
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

pub async fn media_play(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.play().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_pause(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.pause().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_toggle_play_pause(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.toggle_play_pause().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_next(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.next().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

pub async fn media_previous(app: &AppHandle, state: &MediaState) -> MediaSnapshot {
    let snapshot = state.previous().await;
    emit_media_snapshot(app, &snapshot);
    snapshot
}

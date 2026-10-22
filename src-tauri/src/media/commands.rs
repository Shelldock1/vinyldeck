use super::model::MediaSnapshot;

#[tauri::command]
pub async fn cmd_smtc_snapshot() -> Result<Option<MediaSnapshot>, String> {
    super::platform::current_media_snapshot_with_metadata()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cmd_smtc_play() -> Result<Option<MediaSnapshot>, String> {
    super::platform::play()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_pause() -> Result<Option<MediaSnapshot>, String> {
    super::platform::pause()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_toggle_play_pause() -> Result<Option<MediaSnapshot>, String> {
    super::platform::toggle_play_pause()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_next() -> Result<Option<MediaSnapshot>, String> {
    super::platform::next()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_previous() -> Result<Option<MediaSnapshot>, String> {
    super::platform::previous()
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

#[tauri::command]
pub async fn cmd_smtc_seek(seconds: f64) -> Result<Option<MediaSnapshot>, String> {
    super::platform::seek(seconds)
        .await
        .map_err(|error| error.to_string())?;
    cmd_smtc_snapshot().await
}

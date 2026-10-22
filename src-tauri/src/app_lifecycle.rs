use tauri::{AppHandle, Manager};

use crate::window::{MAIN_LABEL, MINI_LABEL};

#[tauri::command]
pub fn cmd_quit(app: AppHandle) {
    quit(&app);
}

pub(crate) fn quit(app: &AppHandle) {
    for label in quit_destroy_order() {
        if let Some(window) = app.get_webview_window(label) {
            if let Err(error) = window.destroy() {
                eprintln!("[VinylDeck lifecycle] failed to destroy {label}: {error}");
            }
        }
    }

    app.exit(0);
}

fn quit_destroy_order() -> [&'static str; 2] {
    [MINI_LABEL, MAIN_LABEL]
}

#[cfg(test)]
mod tests {
    use super::quit_destroy_order;
    use crate::window::{MAIN_LABEL, MINI_LABEL};

    #[test]
    fn explicit_quit_destroys_mini_before_main() {
        assert_eq!(quit_destroy_order(), [MINI_LABEL, MAIN_LABEL]);
    }
}

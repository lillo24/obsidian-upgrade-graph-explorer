use tauri::Manager;
use tauri_plugin_fs::FsExt;

fn allow_private_state_scope<R: tauri::Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let private_state_directory = app.path().app_local_data_dir()?;
    std::fs::create_dir_all(&private_state_directory)?;

    // Windows app containers can virtualize files below APPLOCALDATA while the
    // JavaScript bridge continues to address the logical application path.
    let scope_anchor =
        private_state_directory.join(format!(".icarus-scope-anchor-{}.tmp", std::process::id()));
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&scope_anchor)?;
    let effective_scope_anchor = std::fs::canonicalize(&scope_anchor);
    std::fs::remove_file(&scope_anchor)?;
    let effective_private_state_directory = effective_scope_anchor?
        .parent()
        .ok_or_else(|| std::io::Error::other("private scope anchor has no parent directory"))?
        .to_path_buf();

    let scope = app.fs_scope();
    scope.allow_directory(private_state_directory, true)?;
    scope.allow_directory(effective_private_state_directory, true)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            allow_private_state_scope(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run the Icarus Graph Explorer desktop shell");
}

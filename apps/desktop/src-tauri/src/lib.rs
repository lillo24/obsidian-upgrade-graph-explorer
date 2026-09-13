use tauri::Manager;
use tauri_plugin_fs::FsExt;

mod openai_agents;
mod review_source;

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
        .manage(review_source::ReviewSourceState::default())
        .manage(openai_agents::OpenAiAgentsState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            allow_private_state_scope(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            openai_agents::openai_agents_availability,
            openai_agents::start_openai_agent,
            openai_agents::submit_openai_agent_tool_result,
            openai_agents::cancel_openai_agent,
            review_source::open_review_source_session,
            review_source::prepare_review_source_history,
            review_source::list_review_source_files,
            review_source::capture_review_source,
            review_source::cancel_review_source_capture,
            review_source::dispose_review_source_session,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run the Icarus Graph Explorer desktop shell");
}

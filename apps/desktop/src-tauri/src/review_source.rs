use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::ffi::{OsStr, OsString};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_fs::FsExt;
use uuid::Uuid;

const SCHEMA_VERSION: u8 = 1;
const MAX_SESSIONS: usize = 4;
const MAX_PREPARATIONS: usize = 4;
const MAX_COMMITS: usize = 10;
const MAX_SELECTED_FILES: usize = 32;
const MAX_INVENTORY_FILES: usize = 20_000;
const MAX_PAGE_SIZE: usize = 200;
const MAX_BLOB_BYTES: usize = 512 * 1024;
const MAX_PATCH_BYTES: usize = 512 * 1024;
const MAX_CAPTURE_BYTES: usize = 900 * 1024;
const MAX_GIT_OUTPUT_BYTES: usize = 8 * 1024 * 1024;
const COMMAND_TIMEOUT: Duration = Duration::from_secs(10);
const OPERATION_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSourceError {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    available_count: Option<usize>,
}

impl ReviewSourceError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_owned(),
            message: message.into(),
            available_count: None,
        }
    }

    fn available(code: &str, message: impl Into<String>, count: usize) -> Self {
        Self {
            code: code.to_owned(),
            message: message.into(),
            available_count: Some(count),
        }
    }
}

type ReviewResult<T> = Result<T, ReviewSourceError>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewSourceLimits {
    max_commits: usize,
    max_selected_files: usize,
    max_inventory_files: usize,
    max_page_size: usize,
    max_blob_bytes: usize,
    max_patch_bytes: usize,
    max_capture_bytes: usize,
    command_timeout_ms: u64,
    operation_timeout_ms: u64,
}

impl Default for ReviewSourceLimits {
    fn default() -> Self {
        Self {
            max_commits: MAX_COMMITS,
            max_selected_files: MAX_SELECTED_FILES,
            max_inventory_files: MAX_INVENTORY_FILES,
            max_page_size: MAX_PAGE_SIZE,
            max_blob_bytes: MAX_BLOB_BYTES,
            max_patch_bytes: MAX_PATCH_BYTES,
            max_capture_bytes: MAX_CAPTURE_BYTES,
            command_timeout_ms: COMMAND_TIMEOUT.as_millis() as u64,
            operation_timeout_ms: OPERATION_TIMEOUT.as_millis() as u64,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
enum WorktreeLayout {
    Main,
    Linked,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDescriptor {
    schema_version: u8,
    session_id: String,
    workspace_id: String,
    display_name: String,
    worktree_layout: WorktreeLayout,
    vault_prefix: String,
    limits: ReviewSourceLimits,
    limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDescriptor {
    commit_id: String,
    parent_ids: Vec<String>,
    first_parent_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
enum ChangeStatus {
    Added,
    Modified,
    Deleted,
    TypeChanged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PathChange {
    commit_id: String,
    parent_commit_id: String,
    status: ChangeStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    old_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    new_path: Option<String>,
    #[serde(skip_serializing)]
    old_oid: Option<String>,
    #[serde(skip_serializing)]
    new_oid: Option<String>,
    #[serde(skip_serializing)]
    old_mode: String,
    #[serde(skip_serializing)]
    new_mode: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
enum FileAvailability {
    Available,
    DeletedAtHead,
    UnsupportedSymlink,
    UnsupportedSubmodule,
    Excluded,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
enum FileRole {
    Changed,
    Context,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDescriptor {
    path: String,
    role: FileRole,
    eligible: bool,
    availability: FileAvailability,
    #[serde(skip_serializing_if = "Option::is_none")]
    byte_length: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    exclusion_reason: Option<String>,
    changes: Vec<PathChange>,
}

#[derive(Debug, Clone)]
struct TreeEntry {
    path: String,
    mode: String,
    object_type: String,
    oid: String,
    size: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparationDescriptor {
    schema_version: u8,
    session_id: String,
    preparation_id: String,
    requested_count: usize,
    history_policy: String,
    commit_order: String,
    base_commit_id: String,
    head_commit_id: String,
    commits: Vec<CommitDescriptor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch_name: Option<String>,
    changed_files: Vec<FileDescriptor>,
    additional_eligible_file_count: usize,
    excluded_path_count: usize,
    exclusion_reasons: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    working_tree_warning: Option<String>,
    limitations: Vec<String>,
}

#[derive(Debug, Clone)]
struct Preparation {
    descriptor: PreparationDescriptor,
    head_entries: BTreeMap<String, TreeEntry>,
    changed: BTreeMap<String, Vec<PathChange>>,
}

#[derive(Debug, Clone)]
struct Session {
    descriptor: SessionDescriptor,
    // Retained as the native authorization binding even though later requests
    // can address the session only through opaque IDs.
    #[allow(dead_code)]
    vault_root: PathBuf,
    repo_root: PathBuf,
    #[allow(dead_code)]
    git_dir: PathBuf,
    #[allow(dead_code)]
    common_dir: PathBuf,
    git_executable: PathBuf,
    preparations: BTreeMap<String, Preparation>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FilePage {
    schema_version: u8,
    session_id: String,
    preparation_id: String,
    files: Vec<FileDescriptor>,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_cursor: Option<String>,
    total_matching: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedBlob {
    commit_id: String,
    object_id: String,
    byte_length: usize,
    content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedFile {
    path: String,
    role: FileRole,
    availability: FileAvailability,
    #[serde(skip_serializing_if = "Option::is_none")]
    head_blob: Option<CapturedBlob>,
    changes: Vec<PathChange>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedPatch {
    id: String,
    path: String,
    commit_id: String,
    parent_commit_id: String,
    status: ChangeStatus,
    byte_length: usize,
    content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestBlob {
    commit_id: String,
    object_id: String,
    byte_length: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    path: String,
    role: FileRole,
    availability: FileAvailability,
    #[serde(skip_serializing_if = "Option::is_none")]
    head_blob: Option<ManifestBlob>,
    changes: Vec<PathChange>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureManifest {
    schema_version: u8,
    history_policy: String,
    commit_order: String,
    base_commit_id: String,
    head_commit_id: String,
    commits: Vec<CommitDescriptor>,
    files: Vec<ManifestFile>,
    captured_byte_count: usize,
    limits: ReviewSourceLimits,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResult {
    schema_version: u8,
    session_id: String,
    preparation_id: String,
    request_id: String,
    workspace_id: String,
    selected_paths: Vec<String>,
    head_advanced: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    working_tree_warning: Option<String>,
    completeness: String,
    missing_material: Vec<String>,
    omissions: Vec<String>,
    files: Vec<CapturedFile>,
    patches: Vec<CapturedPatch>,
    manifest: CaptureManifest,
}

#[derive(Debug)]
struct ActiveRequest {
    session_id: String,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default)]
struct ManagerInner {
    sessions: HashMap<String, Session>,
    active_requests: HashMap<String, ActiveRequest>,
}

#[derive(Default)]
pub struct ReviewSourceState {
    inner: Mutex<ManagerInner>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSessionInput {
    root_path: String,
    workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrepareInput {
    session_id: String,
    commit_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListFilesInput {
    session_id: String,
    preparation_id: String,
    #[serde(default)]
    query: String,
    #[serde(default)]
    cursor: Option<String>,
    limit: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureInput {
    session_id: String,
    preparation_id: String,
    request_id: String,
    selected_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestIdentityInput {
    session_id: String,
    request_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionIdentityInput {
    session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Registry {
    schema_version: u8,
    workspaces: Vec<RegistryWorkspace>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryWorkspace {
    root_path: String,
    workspace_id: String,
}

fn lock_inner(state: &ReviewSourceState) -> ReviewResult<std::sync::MutexGuard<'_, ManagerInner>> {
    state.inner.lock().map_err(|_| {
        ReviewSourceError::new(
            "native-failure",
            "The local review-source session state is unavailable.",
        )
    })
}

fn null_device() -> &'static str {
    if cfg!(windows) {
        "NUL"
    } else {
        "/dev/null"
    }
}

fn is_within(path: &Path, root: &Path) -> bool {
    path == root || path.starts_with(root)
}

fn canonical_directory(path: &str) -> ReviewResult<PathBuf> {
    let candidate = Path::new(path);
    if !candidate.is_absolute() {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "The authorized vault path must be absolute.",
        ));
    }
    let canonical = fs::canonicalize(candidate).map_err(|_| {
        ReviewSourceError::new(
            "permission-needed",
            "The authorized vault is unavailable; select it again.",
        )
    })?;
    if !canonical.is_dir() {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "The authorized vault must be a directory.",
        ));
    }
    Ok(canonical)
}

fn display_name(root: &Path) -> ReviewResult<String> {
    root.file_name()
        .and_then(OsStr::to_str)
        .filter(|name| !name.trim().is_empty())
        .map(str::to_owned)
        .ok_or_else(|| {
            ReviewSourceError::new("invalid-selection", "The vault has no usable display name.")
        })
}

fn resolve_git_executable(vault_root: &Path) -> ReviewResult<PathBuf> {
    let search_path = std::env::var_os("PATH").ok_or_else(|| {
        ReviewSourceError::new(
            "git-unavailable",
            "Git is not available in the desktop environment.",
        )
    })?;
    let names: &[&str] = if cfg!(windows) {
        &["git.exe"]
    } else {
        &["git"]
    };
    for directory in std::env::split_paths(&search_path).filter(|path| path.is_absolute()) {
        for name in names {
            let candidate = directory.join(name);
            let Ok(canonical) = fs::canonicalize(&candidate) else {
                continue;
            };
            if candidate.is_file()
                && !is_within(&candidate, vault_root)
                && !is_within(&canonical, vault_root)
            {
                return Ok(canonical);
            }
        }
    }
    Err(ReviewSourceError::new(
        "git-unavailable",
        "No trusted Git executable was found outside the authorized vault.",
    ))
}

#[derive(Debug)]
struct CommandOutput {
    status: ExitStatus,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

fn read_bounded(
    mut reader: impl Read,
    limit: usize,
    overflow: Arc<AtomicBool>,
) -> std::io::Result<Vec<u8>> {
    let mut output = Vec::new();
    let mut buffer = [0_u8; 8192];
    loop {
        match reader.read(&mut buffer) {
            Ok(0) => break,
            Err(error) => return Err(error),
            Ok(count) => {
                let retained = limit.saturating_sub(output.len()).min(count);
                output.extend_from_slice(&buffer[..retained]);
                if retained < count {
                    overflow.store(true, Ordering::SeqCst);
                    break;
                }
            }
        }
    }
    Ok(output)
}

fn hardened_environment(command: &mut Command) {
    command.env_clear();
    for key in ["SystemRoot", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL"] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    command
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_SYSTEM", null_device())
        .env("GIT_CONFIG_GLOBAL", null_device())
        .env("GIT_ATTR_NOSYSTEM", "1")
        .env("GIT_NO_REPLACE_OBJECTS", "1")
        .env("GIT_LITERAL_PATHSPECS", "1")
        .env("GIT_NO_LAZY_FETCH", "1")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never");
}

fn run_git_at(
    executable: &Path,
    cwd: &Path,
    args: &[OsString],
    output_limit: usize,
    timeout: Duration,
    cancelled: &AtomicBool,
) -> ReviewResult<CommandOutput> {
    if cancelled.load(Ordering::SeqCst) {
        return Err(ReviewSourceError::new(
            "cancelled",
            "The review-source operation was cancelled.",
        ));
    }
    let mut command = Command::new(executable);
    hardened_environment(&mut command);
    command
        .current_dir(cwd)
        .arg("--no-pager")
        .arg("--no-replace-objects")
        .args(["-c", "core.fsmonitor=false"])
        .args(["-c", "core.untrackedCache=false"])
        .args(["-c", "submodule.recurse=false"])
        .args(["-c", "core.quotePath=false"])
        .args(["-c", "color.ui=false"])
        .args(["-c", "diff.external="])
        .args(["-c", "diff.trustExitCode=false"])
        .args(["-c", &format!("core.hooksPath={}", null_device())])
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command.spawn().map_err(|_| {
        ReviewSourceError::new(
            "git-unavailable",
            "The trusted Git executable could not be started.",
        )
    })?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| ReviewSourceError::new("native-failure", "Git stdout was not captured."))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| ReviewSourceError::new("native-failure", "Git stderr was not captured."))?;
    let overflow = Arc::new(AtomicBool::new(false));
    let stdout_flag = Arc::clone(&overflow);
    let stderr_flag = Arc::clone(&overflow);
    let stdout_thread = thread::spawn(move || read_bounded(stdout, output_limit, stdout_flag));
    let stderr_thread = thread::spawn(move || read_bounded(stderr, 32 * 1024, stderr_flag));
    let started = Instant::now();
    let status = loop {
        let stop = cancelled.load(Ordering::SeqCst)
            || overflow.load(Ordering::SeqCst)
            || started.elapsed() >= timeout;
        if stop {
            let _ = child.kill();
            let _ = child.wait();
            let _ = stdout_thread.join();
            let _ = stderr_thread.join();
            let (code, message) = if cancelled.load(Ordering::SeqCst) {
                ("cancelled", "The review-source operation was cancelled.")
            } else if overflow.load(Ordering::SeqCst) {
                (
                    "size-limit",
                    "Git produced more data than the operation permits.",
                )
            } else {
                (
                    "time-limit",
                    "Git did not finish within the operation time limit.",
                )
            };
            return Err(ReviewSourceError::new(code, message));
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(Duration::from_millis(10)),
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_thread.join();
                let _ = stderr_thread.join();
                return Err(ReviewSourceError::new(
                    "native-failure",
                    "The Git process status could not be read.",
                ));
            }
        }
    };
    let stdout = stdout_thread
        .join()
        .map_err(|_| ReviewSourceError::new("native-failure", "Git stdout collection failed."))?
        .map_err(|_| ReviewSourceError::new("native-failure", "Git stdout could not be read."))?;
    let stderr = stderr_thread
        .join()
        .map_err(|_| ReviewSourceError::new("native-failure", "Git stderr collection failed."))?
        .map_err(|_| ReviewSourceError::new("native-failure", "Git stderr could not be read."))?;
    if overflow.load(Ordering::SeqCst) {
        return Err(ReviewSourceError::new(
            "size-limit",
            "Git produced more data than the operation permits.",
        ));
    }
    Ok(CommandOutput {
        status,
        stdout,
        stderr,
    })
}

fn os_args(values: &[&str]) -> Vec<OsString> {
    values.iter().map(OsString::from).collect()
}

fn git_output(
    session: &Session,
    args: &[&str],
    limit: usize,
    deadline: Instant,
    cancelled: &AtomicBool,
) -> ReviewResult<Vec<u8>> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err(ReviewSourceError::new(
            "time-limit",
            "The review-source operation exceeded its time limit.",
        ));
    }
    let output = run_git_at(
        &session.git_executable,
        &session.repo_root,
        &os_args(args),
        limit,
        COMMAND_TIMEOUT.min(remaining),
        cancelled,
    )?;
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr);
    let lowered = stderr.to_ascii_lowercase();
    let code = if lowered.contains("missing")
        || lowered.contains("bad object")
        || lowered.contains("not a valid object")
        || lowered.contains("could not fetch")
    {
        "missing-object"
    } else if stderr.contains("dubious ownership") {
        "permission-needed"
    } else {
        "git-command-failed"
    };
    Err(ReviewSourceError::new(
        code,
        format!(
            "A read-only Git inspection failed: {}",
            stderr.lines().next().unwrap_or("unknown Git error")
        ),
    ))
}

fn git_text(
    session: &Session,
    args: &[&str],
    limit: usize,
    deadline: Instant,
    cancelled: &AtomicBool,
) -> ReviewResult<String> {
    String::from_utf8(git_output(session, args, limit, deadline, cancelled)?).map_err(|_| {
        ReviewSourceError::new("invalid-utf8", "Git returned text that is not valid UTF-8.")
    })
}

fn one_line(bytes: Vec<u8>, code: &str, message: &str) -> ReviewResult<String> {
    let text = String::from_utf8(bytes).map_err(|_| ReviewSourceError::new(code, message))?;
    let value = text.trim_end_matches(['\r', '\n']);
    if value.is_empty() || value.contains(['\r', '\n']) {
        return Err(ReviewSourceError::new(code, message));
    }
    Ok(value.to_owned())
}

fn discovery_exclusion(path: &str) -> Option<String> {
    for segment in path.split('/') {
        if segment.starts_with('.') {
            return Some("hidden path segments are excluded".to_owned());
        }
        if segment == "node_modules" {
            return Some("node_modules directories are excluded".to_owned());
        }
    }
    None
}

fn is_markdown(path: &str) -> bool {
    path.to_ascii_lowercase().ends_with(".md")
}

fn validate_relative_path(path: &str) -> ReviewResult<()> {
    if path.is_empty()
        || path.contains('\0')
        || path.starts_with('/')
        || path.starts_with('\\')
        || path.contains('\\')
        || path.as_bytes().get(1) == Some(&b':')
        || path
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "Selected paths must be normalized and relative to the authorized vault.",
        ));
    }
    Ok(())
}

fn slash_path(path: &Path) -> ReviewResult<String> {
    let mut parts = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => parts.push(
                value
                    .to_str()
                    .ok_or_else(|| {
                        ReviewSourceError::new(
                            "unsupported-path-encoding",
                            "The vault path cannot be represented as UTF-8.",
                        )
                    })?
                    .to_owned(),
            ),
            Component::CurDir => {}
            _ => {
                return Err(ReviewSourceError::new(
                    "invalid-selection",
                    "The vault is not a contained repository path.",
                ))
            }
        }
    }
    Ok(parts.join("/"))
}

fn open_session_core(
    root_path: &str,
    workspace_id: &str,
    authorized: bool,
) -> ReviewResult<Session> {
    if !authorized {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The vault is not authorized for this desktop process; select it again.",
        ));
    }
    if workspace_id.trim().is_empty()
        || workspace_id.starts_with('/')
        || workspace_id.starts_with('\\')
        || workspace_id.as_bytes().get(1) == Some(&b':')
    {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The workspace identity is not a valid private registry identity.",
        ));
    }
    let vault_root = canonical_directory(root_path)?;
    let git_executable = resolve_git_executable(&vault_root)?;
    let cancelled = AtomicBool::new(false);
    let bootstrap = |args: &[&str]| -> ReviewResult<Vec<u8>> {
        let output = run_git_at(
            &git_executable,
            &vault_root,
            &os_args(args),
            64 * 1024,
            COMMAND_TIMEOUT,
            &cancelled,
        )?;
        if output.status.success() {
            Ok(output.stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let code = if stderr.contains("dubious ownership") {
                "permission-needed"
            } else {
                "not-a-repository"
            };
            Err(ReviewSourceError::new(
                code,
                "The authorized vault is not inside an accessible local Git worktree.",
            ))
        }
    };
    let repo_root = fs::canonicalize(one_line(
        bootstrap(&["rev-parse", "--show-toplevel"])?,
        "not-a-repository",
        "Git did not return a valid repository root.",
    )?)
    .map_err(|_| {
        ReviewSourceError::new(
            "permission-needed",
            "The associated Git worktree root is unavailable.",
        )
    })?;
    if !is_within(&vault_root, &repo_root) {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The selected vault is not contained by its reported Git worktree.",
        ));
    }
    let git_dir = fs::canonicalize(one_line(
        bootstrap(&["rev-parse", "--absolute-git-dir"])?,
        "permission-needed",
        "Git did not return usable worktree metadata.",
    )?)
    .map_err(|_| {
        ReviewSourceError::new(
            "permission-needed",
            "The associated Git worktree metadata is unavailable.",
        )
    })?;
    let common_dir = fs::canonicalize(one_line(
        bootstrap(&["rev-parse", "--path-format=absolute", "--git-common-dir"])?,
        "permission-needed",
        "Git did not return usable common metadata.",
    )?)
    .map_err(|_| {
        ReviewSourceError::new(
            "permission-needed",
            "The associated Git common metadata is unavailable.",
        )
    })?;

    let dot_git = repo_root.join(".git");
    let dot_git_is_symlink = fs::symlink_metadata(&dot_git)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false);
    let main_layout = !dot_git_is_symlink
        && dot_git.is_dir()
        && fs::canonicalize(&dot_git)
            .map(|path| path == git_dir && path == common_dir)
            .unwrap_or(false);
    let linked_layout = !dot_git_is_symlink
        && dot_git.is_file()
        && git_dir
            .parent()
            .and_then(Path::parent)
            .map(|path| path == common_dir)
            .unwrap_or(false)
        && git_dir
            .parent()
            .and_then(Path::file_name)
            .and_then(OsStr::to_str)
            == Some("worktrees")
        && common_dir.file_name().and_then(OsStr::to_str) == Some(".git");
    let worktree_layout = if main_layout {
        WorktreeLayout::Main
    } else if linked_layout {
        WorktreeLayout::Linked
    } else {
        return Err(ReviewSourceError::new(
            "permission-needed",
            "The repository uses metadata redirection outside supported main/linked-worktree layouts.",
        ));
    };
    for alternate in ["objects/info/alternates", "objects/info/http-alternates"] {
        if common_dir.join(alternate).exists() {
            return Err(ReviewSourceError::new(
                "permission-needed",
                "The repository uses an alternate object store outside this source policy.",
            ));
        }
    }
    let vault_prefix = slash_path(vault_root.strip_prefix(&repo_root).map_err(|_| {
        ReviewSourceError::new(
            "unauthorized",
            "The vault is outside the associated Git worktree.",
        )
    })?)?;
    let session_id = Uuid::new_v4().to_string();
    let descriptor = SessionDescriptor {
        schema_version: SCHEMA_VERSION,
        session_id,
        workspace_id: workspace_id.to_owned(),
        display_name: display_name(&vault_root)?,
        worktree_layout,
        vault_prefix,
        limits: ReviewSourceLimits::default(),
        limitations: vec![
            "Committed Markdown at a pinned local HEAD only; working-tree and untracked contents are excluded.".to_owned(),
            "History follows first parents; merge changes are compared with the merge commit's first parent.".to_owned(),
            "Root ranges, alternate object stores, symlinks, submodules, binary data, and invalid UTF-8 are unsupported.".to_owned(),
            "Renames are deterministic delete/add changes so capture never expands across the vault boundary.".to_owned(),
        ],
    };
    Ok(Session {
        descriptor,
        vault_root,
        repo_root,
        git_dir,
        common_dir,
        git_executable,
        preparations: BTreeMap::new(),
    })
}

fn repo_path(session: &Session, relative: &str) -> String {
    if session.descriptor.vault_prefix.is_empty() {
        relative.to_owned()
    } else {
        format!("{}/{}", session.descriptor.vault_prefix, relative)
    }
}

fn relative_path(session: &Session, repository_path: &str) -> Option<String> {
    if session.descriptor.vault_prefix.is_empty() {
        return Some(repository_path.to_owned());
    }
    repository_path
        .strip_prefix(&session.descriptor.vault_prefix)
        .and_then(|path| path.strip_prefix('/'))
        .map(str::to_owned)
}

fn parse_tree(
    session: &Session,
    bytes: &[u8],
) -> ReviewResult<(BTreeMap<String, TreeEntry>, usize)> {
    let mut entries = BTreeMap::new();
    let mut unsupported_encoding = 0;
    for record in bytes
        .split(|byte| *byte == 0)
        .filter(|record| !record.is_empty())
    {
        let Some(tab) = record.iter().position(|byte| *byte == b'\t') else {
            return Err(ReviewSourceError::new(
                "git-command-failed",
                "Git returned a malformed tree record.",
            ));
        };
        let metadata = std::str::from_utf8(&record[..tab]).map_err(|_| {
            ReviewSourceError::new(
                "git-command-failed",
                "Git returned malformed tree metadata.",
            )
        })?;
        let Ok(repository_path) = std::str::from_utf8(&record[tab + 1..]) else {
            unsupported_encoding += 1;
            continue;
        };
        let Some(path) = relative_path(session, repository_path) else {
            return Err(ReviewSourceError::new(
                "unauthorized",
                "Git returned a path outside the authorized vault.",
            ));
        };
        let fields: Vec<&str> = metadata.split_ascii_whitespace().collect();
        if fields.len() != 4 {
            return Err(ReviewSourceError::new(
                "git-command-failed",
                "Git returned unexpected tree metadata.",
            ));
        }
        let size = if fields[3] == "-" {
            None
        } else {
            Some(fields[3].parse::<usize>().map_err(|_| {
                ReviewSourceError::new("git-command-failed", "Git returned an invalid blob size.")
            })?)
        };
        entries.insert(
            path.clone(),
            TreeEntry {
                path,
                mode: fields[0].to_owned(),
                object_type: fields[1].to_owned(),
                oid: fields[2].to_owned(),
                size,
            },
        );
    }
    if entries.len() > MAX_INVENTORY_FILES {
        return Err(ReviewSourceError::new(
            "size-limit",
            "The pinned tree contains more files than the review-source inventory limit.",
        ));
    }
    Ok((entries, unsupported_encoding))
}

fn mode_availability(mode: &str, object_type: &str, at_head: bool) -> FileAvailability {
    if mode == "120000" {
        FileAvailability::UnsupportedSymlink
    } else if mode == "160000" || object_type == "commit" {
        FileAvailability::UnsupportedSubmodule
    } else if at_head {
        FileAvailability::Available
    } else {
        FileAvailability::DeletedAtHead
    }
}

fn eligible_tree_entry(entry: &TreeEntry) -> (bool, FileAvailability, Option<String>) {
    if let Some(reason) = discovery_exclusion(&entry.path) {
        return (false, FileAvailability::Excluded, Some(reason));
    }
    if !is_markdown(&entry.path) {
        return (
            false,
            FileAvailability::Excluded,
            Some("only Markdown .md paths are eligible".to_owned()),
        );
    }
    let availability = mode_availability(&entry.mode, &entry.object_type, true);
    match availability {
        FileAvailability::Available if entry.object_type == "blob" => (true, availability, None),
        FileAvailability::UnsupportedSymlink => (
            false,
            availability,
            Some("Git symlink entries are not followed".to_owned()),
        ),
        FileAvailability::UnsupportedSubmodule => (
            false,
            availability,
            Some("Git submodule entries are not traversed".to_owned()),
        ),
        _ => (
            false,
            FileAvailability::Excluded,
            Some("unsupported Git tree entry".to_owned()),
        ),
    }
}

fn parse_raw_changes(
    session: &Session,
    bytes: &[u8],
    commit_id: &str,
    parent_commit_id: &str,
) -> ReviewResult<Vec<(String, PathChange)>> {
    let records: Vec<&[u8]> = bytes.split(|byte| *byte == 0).collect();
    let mut index = 0;
    let mut result = Vec::new();
    while index < records.len() {
        if records[index].is_empty() {
            index += 1;
            continue;
        }
        let header = std::str::from_utf8(records[index]).map_err(|_| {
            ReviewSourceError::new(
                "git-command-failed",
                "Git returned malformed change metadata.",
            )
        })?;
        index += 1;
        let path_bytes = records.get(index).ok_or_else(|| {
            ReviewSourceError::new("git-command-failed", "Git omitted a changed path.")
        })?;
        index += 1;
        let Ok(repository_path) = std::str::from_utf8(path_bytes) else {
            continue;
        };
        let Some(path) = relative_path(session, repository_path) else {
            return Err(ReviewSourceError::new(
                "unauthorized",
                "Git returned a change outside the authorized vault.",
            ));
        };
        let fields: Vec<&str> = header
            .trim_start_matches(':')
            .split_ascii_whitespace()
            .collect();
        if fields.len() != 5 {
            return Err(ReviewSourceError::new(
                "git-command-failed",
                "Git returned unexpected raw change metadata.",
            ));
        }
        let status = match fields[4].chars().next() {
            Some('A') => ChangeStatus::Added,
            Some('M') => ChangeStatus::Modified,
            Some('D') => ChangeStatus::Deleted,
            Some('T') => ChangeStatus::TypeChanged,
            _ => {
                return Err(ReviewSourceError::new(
                    "git-command-failed",
                    "Git returned an unsupported change status.",
                ))
            }
        };
        let old_present = fields[0] != "000000" && fields[2].chars().any(|value| value != '0');
        let new_present = fields[1] != "000000" && fields[3].chars().any(|value| value != '0');
        result.push((
            path.clone(),
            PathChange {
                commit_id: commit_id.to_owned(),
                parent_commit_id: parent_commit_id.to_owned(),
                status,
                old_path: old_present.then(|| path.clone()),
                new_path: new_present.then(|| path.clone()),
                old_oid: old_present.then(|| fields[2].to_owned()),
                new_oid: new_present.then(|| fields[3].to_owned()),
                old_mode: fields[0].to_owned(),
                new_mode: fields[1].to_owned(),
            },
        ));
    }
    Ok(result)
}

fn owned_refs(values: &[String]) -> Vec<&str> {
    values.iter().map(String::as_str).collect()
}

fn tree_command(session: &Session, head: &str) -> Vec<String> {
    let mut args = vec![
        "ls-tree".to_owned(),
        "-r".to_owned(),
        "-z".to_owned(),
        "-l".to_owned(),
        "--full-tree".to_owned(),
        head.to_owned(),
    ];
    if !session.descriptor.vault_prefix.is_empty() {
        args.extend(["--".to_owned(), session.descriptor.vault_prefix.clone()]);
    }
    args
}

fn raw_diff_command(session: &Session, parent: &str, child: &str) -> Vec<String> {
    let mut args = vec![
        "diff".to_owned(),
        "--raw".to_owned(),
        "-z".to_owned(),
        "--no-abbrev".to_owned(),
        "--no-renames".to_owned(),
        "--no-ext-diff".to_owned(),
        "--no-textconv".to_owned(),
        "--ignore-submodules=none".to_owned(),
        parent.to_owned(),
        child.to_owned(),
    ];
    if !session.descriptor.vault_prefix.is_empty() {
        args.extend(["--".to_owned(), session.descriptor.vault_prefix.clone()]);
    }
    args
}

fn working_tree_warning(
    session: &Session,
    deadline: Instant,
    cancelled: &AtomicBool,
) -> ReviewResult<Option<String>> {
    let mut args = vec![
        "status".to_owned(),
        "--porcelain=v1".to_owned(),
        "-z".to_owned(),
        "--untracked-files=normal".to_owned(),
        "--ignore-submodules=all".to_owned(),
    ];
    if !session.descriptor.vault_prefix.is_empty() {
        args.extend(["--".to_owned(), session.descriptor.vault_prefix.clone()]);
    }
    let output = git_output(
        session,
        &owned_refs(&args),
        1024 * 1024,
        deadline,
        cancelled,
    )?;
    Ok((!output.is_empty()).then(|| {
        "The authorized vault has staged, unstaged, or untracked changes. They are excluded; capture reads only pinned committed objects.".to_owned()
    }))
}

fn prepare_core(session: &Session, commit_count: usize) -> ReviewResult<Preparation> {
    if !(1..=MAX_COMMITS).contains(&commit_count) {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "Commit count must be an integer from 1 through 10.",
        ));
    }
    let cancelled = AtomicBool::new(false);
    let deadline = Instant::now() + OPERATION_TIMEOUT;
    let head = git_text(
        session,
        &["rev-parse", "--verify", "HEAD^{commit}"],
        4096,
        deadline,
        &cancelled,
    )
    .map_err(|error| {
        if error.code == "git-command-failed" {
            ReviewSourceError::new(
                "no-commits",
                "The repository has no committed HEAD to review.",
            )
        } else {
            error
        }
    })?
    .trim()
    .to_owned();
    let history = git_text(
        session,
        &[
            "rev-list",
            "--first-parent",
            "--parents",
            &format!("--max-count={commit_count}"),
            &head,
        ],
        64 * 1024,
        deadline,
        &cancelled,
    )?;
    let mut newest_first = Vec::new();
    for line in history.lines() {
        let ids: Vec<&str> = line.split_ascii_whitespace().collect();
        if let Some(commit_id) = ids.first() {
            newest_first.push((
                (*commit_id).to_owned(),
                ids[1..]
                    .iter()
                    .map(|value| (*value).to_owned())
                    .collect::<Vec<_>>(),
            ));
        }
    }
    if newest_first.len() < commit_count {
        return Err(ReviewSourceError::available(
            "insufficient-history",
            format!(
                "Only {} first-parent commits are available locally; no history was fetched.",
                newest_first.len()
            ),
            newest_first.len(),
        ));
    }
    newest_first.reverse();
    let (oldest_id, oldest_parents) = newest_first.first().ok_or_else(|| {
        ReviewSourceError::new("no-commits", "The repository has no commits to review.")
    })?;
    let Some(base_commit_id) = oldest_parents.first().cloned() else {
        let shallow = git_text(
            session,
            &["rev-parse", "--is-shallow-repository"],
            128,
            deadline,
            &cancelled,
        )?
        .trim()
            == "true";
        return Err(if shallow {
            ReviewSourceError::available(
                "insufficient-history",
                "The range reaches a shallow-history boundary; automatic fetching is disabled.",
                commit_count,
            )
        } else {
            ReviewSourceError::new(
                "root-range-unsupported",
                format!(
                    "The range includes root commit {oldest_id}; REVIEW1 requires a real first-parent base commit."
                ),
            )
        });
    };
    let commits = newest_first
        .into_iter()
        .map(|(commit_id, parent_ids)| CommitDescriptor {
            first_parent_id: parent_ids[0].clone(),
            commit_id,
            parent_ids,
        })
        .collect::<Vec<_>>();
    if commits.last().map(|commit| commit.commit_id.as_str()) != Some(head.as_str()) {
        return Err(ReviewSourceError::new(
            "changed-preparation",
            "HEAD changed while the range was prepared; prepare it again.",
        ));
    }

    let tree_args = tree_command(session, &head);
    let tree = git_output(
        session,
        &owned_refs(&tree_args),
        MAX_GIT_OUTPUT_BYTES,
        deadline,
        &cancelled,
    )?;
    let (head_entries, unsupported_encoding) = parse_tree(session, &tree)?;
    let mut changed: BTreeMap<String, Vec<PathChange>> = BTreeMap::new();
    for commit in &commits {
        let args = raw_diff_command(session, &commit.first_parent_id, &commit.commit_id);
        let raw = git_output(
            session,
            &owned_refs(&args),
            MAX_GIT_OUTPUT_BYTES,
            deadline,
            &cancelled,
        )?;
        for (path, change) in
            parse_raw_changes(session, &raw, &commit.commit_id, &commit.first_parent_id)?
        {
            changed.entry(path).or_default().push(change);
        }
    }
    let mut changed_files = Vec::new();
    for (path, changes) in &changed {
        let head_entry = head_entries.get(path);
        let historical_mode = changes
            .iter()
            .rev()
            .find_map(|change| {
                if change.new_mode != "000000" {
                    Some(change.new_mode.as_str())
                } else if change.old_mode != "000000" {
                    Some(change.old_mode.as_str())
                } else {
                    None
                }
            })
            .unwrap_or("000000");
        let availability = if let Some(entry) = head_entry {
            mode_availability(&entry.mode, &entry.object_type, true)
        } else {
            mode_availability(
                historical_mode,
                if historical_mode == "160000" {
                    "commit"
                } else {
                    "blob"
                },
                false,
            )
        };
        let exclusion_reason = discovery_exclusion(path)
            .or_else(|| {
                (!is_markdown(path)).then(|| "only Markdown .md paths are eligible".to_owned())
            })
            .or_else(|| match availability {
                FileAvailability::UnsupportedSymlink => {
                    Some("Git symlink entries are not followed".to_owned())
                }
                FileAvailability::UnsupportedSubmodule => {
                    Some("Git submodule entries are not traversed".to_owned())
                }
                _ => None,
            });
        let eligible = exclusion_reason.is_none();
        changed_files.push(FileDescriptor {
            path: path.clone(),
            role: FileRole::Changed,
            eligible,
            availability: if exclusion_reason.is_some()
                && !matches!(
                    availability,
                    FileAvailability::UnsupportedSymlink | FileAvailability::UnsupportedSubmodule
                ) {
                FileAvailability::Excluded
            } else {
                availability
            },
            byte_length: head_entry.and_then(|entry| entry.size),
            exclusion_reason,
            changes: changes.clone(),
        });
    }
    let changed_paths = changed.keys().map(String::as_str).collect::<BTreeSet<_>>();
    let mut excluded_paths = BTreeSet::new();
    let mut exclusion_reasons = BTreeSet::new();
    if unsupported_encoding > 0 {
        exclusion_reasons
            .insert("one or more Git paths could not be represented as UTF-8".to_owned());
    }
    for entry in head_entries.values() {
        let (eligible, _, reason) = eligible_tree_entry(entry);
        if !eligible {
            excluded_paths.insert(entry.path.clone());
            if let Some(reason) = reason {
                exclusion_reasons.insert(reason);
            }
        }
    }
    for file in &changed_files {
        if !file.eligible {
            excluded_paths.insert(file.path.clone());
            if let Some(reason) = &file.exclusion_reason {
                exclusion_reasons.insert(reason.clone());
            }
        }
    }
    let excluded_path_count = excluded_paths.len() + unsupported_encoding;
    let additional_eligible_file_count = head_entries
        .values()
        .filter(|entry| {
            !changed_paths.contains(entry.path.as_str()) && eligible_tree_entry(entry).0
        })
        .count();
    let branch_output = run_git_at(
        &session.git_executable,
        &session.repo_root,
        &os_args(&["symbolic-ref", "--quiet", "--short", "HEAD"]),
        4096,
        COMMAND_TIMEOUT.min(deadline.saturating_duration_since(Instant::now())),
        &cancelled,
    )?;
    let branch_name = if branch_output.status.success() {
        Some(one_line(
            branch_output.stdout,
            "git-command-failed",
            "Git returned an invalid branch name.",
        )?)
    } else {
        None
    };
    let preparation_id = Uuid::new_v4().to_string();
    Ok(Preparation {
        descriptor: PreparationDescriptor {
            schema_version: SCHEMA_VERSION,
            session_id: session.descriptor.session_id.clone(),
            preparation_id,
            requested_count: commit_count,
            history_policy: "first-parent".to_owned(),
            commit_order: "oldest-to-newest".to_owned(),
            base_commit_id,
            head_commit_id: head,
            commits,
            branch_name,
            changed_files,
            additional_eligible_file_count,
            excluded_path_count,
            exclusion_reasons: exclusion_reasons.into_iter().collect(),
            working_tree_warning: working_tree_warning(session, deadline, &cancelled)?,
            limitations: session.descriptor.limitations.clone(),
        },
        head_entries,
        changed,
    })
}

fn list_files_core(
    session: &Session,
    preparation: &Preparation,
    input: &ListFilesInput,
) -> ReviewResult<FilePage> {
    if input.limit == 0 || input.limit > MAX_PAGE_SIZE {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "File page size must be from 1 through 200.",
        ));
    }
    if input.query.len() > 256 {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "File search text exceeds 256 characters.",
        ));
    }
    let offset = input
        .cursor
        .as_deref()
        .unwrap_or("0")
        .parse::<usize>()
        .map_err(|_| ReviewSourceError::new("invalid-selection", "The file cursor is invalid."))?;
    let query = input.query.to_lowercase();
    let matches = preparation
        .head_entries
        .values()
        .filter(|entry| !preparation.changed.contains_key(&entry.path))
        .filter(|entry| eligible_tree_entry(entry).0)
        .filter(|entry| query.is_empty() || entry.path.to_lowercase().contains(&query))
        .collect::<Vec<_>>();
    if offset > matches.len() {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "The cursor is outside the pinned inventory.",
        ));
    }
    let files = matches
        .iter()
        .skip(offset)
        .take(input.limit)
        .map(|entry| FileDescriptor {
            path: entry.path.clone(),
            role: FileRole::Context,
            eligible: true,
            availability: FileAvailability::Available,
            byte_length: entry.size,
            exclusion_reason: None,
            changes: Vec::new(),
        })
        .collect::<Vec<_>>();
    let next_offset = offset + files.len();
    Ok(FilePage {
        schema_version: SCHEMA_VERSION,
        session_id: session.descriptor.session_id.clone(),
        preparation_id: preparation.descriptor.preparation_id.clone(),
        files,
        next_cursor: (next_offset < matches.len()).then(|| next_offset.to_string()),
        total_matching: matches.len(),
    })
}

fn read_blob(
    session: &Session,
    oid: &str,
    declared_size: Option<usize>,
    deadline: Instant,
    cancelled: &AtomicBool,
) -> ReviewResult<(String, usize)> {
    let size = match declared_size {
        Some(size) => size,
        None => git_text(session, &["cat-file", "-s", oid], 128, deadline, cancelled)
            .map_err(|error| {
                if error.code == "git-command-failed" {
                    ReviewSourceError::new(
                        "missing-object",
                        "A selected Git blob object is unavailable locally.",
                    )
                } else {
                    error
                }
            })?
            .trim()
            .parse::<usize>()
            .map_err(|_| {
                ReviewSourceError::new("missing-object", "Git did not return a valid blob size.")
            })?,
    };
    if size > MAX_BLOB_BYTES {
        return Err(ReviewSourceError::new(
            "size-limit",
            format!("A selected Markdown blob exceeds the {MAX_BLOB_BYTES}-byte limit."),
        ));
    }
    let bytes = git_output(
        session,
        &["cat-file", "blob", oid],
        size.saturating_add(1),
        deadline,
        cancelled,
    )
    .map_err(|error| {
        if error.code == "git-command-failed" {
            ReviewSourceError::new(
                "missing-object",
                "A selected Git blob object is unavailable locally.",
            )
        } else {
            error
        }
    })?;
    if bytes.len() != size {
        return Err(ReviewSourceError::new(
            "missing-object",
            "A selected Git blob was not read at its declared size.",
        ));
    }
    if bytes.contains(&0) {
        return Err(ReviewSourceError::new(
            "unsupported-file",
            "A selected Markdown blob is binary (contains NUL bytes).",
        ));
    }
    let text = String::from_utf8(bytes).map_err(|_| {
        ReviewSourceError::new(
            "invalid-utf8",
            "A selected Markdown blob is not valid UTF-8.",
        )
    })?;
    Ok((text, size))
}

fn patch_command(session: &Session, parent: &str, child: &str, path: &str) -> Vec<String> {
    let mut args = vec![
        "diff".to_owned(),
        "--patch".to_owned(),
        "--full-index".to_owned(),
        "--no-color".to_owned(),
        "--no-prefix".to_owned(),
        "--no-renames".to_owned(),
        "--no-ext-diff".to_owned(),
        "--no-textconv".to_owned(),
        "--text".to_owned(),
        "--no-indent-heuristic".to_owned(),
        "--diff-algorithm=myers".to_owned(),
        "--ignore-submodules=all".to_owned(),
        "--unified=3".to_owned(),
    ];
    if !session.descriptor.vault_prefix.is_empty() {
        args.push(format!("--relative={}", session.descriptor.vault_prefix));
    }
    args.extend([
        parent.to_owned(),
        child.to_owned(),
        "--".to_owned(),
        repo_path(session, path),
    ]);
    args
}

fn ensure_capture_capacity(total_bytes: usize, additional_bytes: usize) -> ReviewResult<()> {
    if additional_bytes > MAX_CAPTURE_BYTES.saturating_sub(total_bytes) {
        return Err(ReviewSourceError::new(
            "size-limit",
            format!("Selected evidence exceeds the {MAX_CAPTURE_BYTES}-byte total limit."),
        ));
    }
    Ok(())
}

fn capture_core(
    session: &Session,
    preparation: &Preparation,
    input: &CaptureInput,
    cancelled: &AtomicBool,
) -> ReviewResult<CaptureResult> {
    if input.request_id.trim().is_empty() || input.request_id.len() > 128 {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "Capture request identity is invalid.",
        ));
    }
    if input.selected_paths.is_empty() || input.selected_paths.len() > MAX_SELECTED_FILES {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "Select from 1 through 32 Markdown paths for one capture.",
        ));
    }
    if input
        .selected_paths
        .iter()
        .map(String::as_str)
        .collect::<BTreeSet<_>>()
        .len()
        != input.selected_paths.len()
    {
        return Err(ReviewSourceError::new(
            "invalid-selection",
            "Selected paths must be unique.",
        ));
    }
    let deadline = Instant::now() + OPERATION_TIMEOUT;
    let current_head = git_text(
        session,
        &["rev-parse", "--verify", "HEAD^{commit}"],
        4096,
        deadline,
        cancelled,
    )?
    .trim()
    .to_owned();
    let head_advanced = current_head != preparation.descriptor.head_commit_id;
    let mut selected_paths = input.selected_paths.clone();
    selected_paths.sort();
    let mut files = Vec::new();
    let mut patches = Vec::new();
    let mut total_bytes = 0usize;
    let mut validated_objects = BTreeSet::new();

    for path in &selected_paths {
        validate_relative_path(path)?;
        let changes = preparation.changed.get(path).cloned().unwrap_or_default();
        let head_entry = preparation.head_entries.get(path);
        let (eligible, availability, exclusion_reason) = if let Some(entry) = head_entry {
            eligible_tree_entry(entry)
        } else if let Some(change) = changes.last() {
            let mode = if change.new_mode != "000000" {
                &change.new_mode
            } else {
                &change.old_mode
            };
            let availability = mode_availability(
                mode,
                if mode == "160000" { "commit" } else { "blob" },
                false,
            );
            let reason = discovery_exclusion(path)
                .or_else(|| {
                    (!is_markdown(path)).then(|| "only Markdown .md paths are eligible".to_owned())
                })
                .or_else(|| match availability {
                    FileAvailability::UnsupportedSymlink => {
                        Some("Git symlink entries are not followed".to_owned())
                    }
                    FileAvailability::UnsupportedSubmodule => {
                        Some("Git submodule entries are not traversed".to_owned())
                    }
                    _ => None,
                });
            (reason.is_none(), availability, reason)
        } else {
            return Err(ReviewSourceError::new(
                "invalid-selection",
                format!("Selected path {path} is not in the pinned changed/context inventory."),
            ));
        };
        if !eligible {
            return Err(ReviewSourceError::new(
                "unsupported-file",
                format!(
                    "Selected path {path} is unavailable: {}.",
                    exclusion_reason.unwrap_or_else(|| "unsupported Git entry".to_owned())
                ),
            ));
        }
        let role = if changes.is_empty() {
            FileRole::Context
        } else {
            FileRole::Changed
        };
        let head_blob = if let Some(entry) = head_entry {
            let declared_size = entry.size.ok_or_else(|| {
                ReviewSourceError::new(
                    "changed-preparation",
                    format!("Pinned blob metadata for {path} has no byte size."),
                )
            })?;
            ensure_capture_capacity(total_bytes, declared_size)?;
            let (content, byte_length) =
                read_blob(session, &entry.oid, entry.size, deadline, cancelled)?;
            total_bytes += byte_length;
            Some(CapturedBlob {
                commit_id: preparation.descriptor.head_commit_id.clone(),
                object_id: entry.oid.clone(),
                byte_length,
                content,
            })
        } else {
            None
        };

        for change in &changes {
            for (oid, mode) in [
                (change.old_oid.as_deref(), change.old_mode.as_str()),
                (change.new_oid.as_deref(), change.new_mode.as_str()),
            ] {
                let Some(oid) = oid else { continue };
                if mode == "160000" || mode == "120000" {
                    return Err(ReviewSourceError::new(
                        "unsupported-file",
                        format!(
                            "Selected path {path} is a symlink or submodule in the pinned range."
                        ),
                    ));
                }
                if validated_objects.insert(oid.to_owned()) {
                    let _ = read_blob(session, oid, None, deadline, cancelled)?;
                }
            }
            let args = patch_command(session, &change.parent_commit_id, &change.commit_id, path);
            let remaining_capture_bytes = MAX_CAPTURE_BYTES.saturating_sub(total_bytes);
            if remaining_capture_bytes == 0 {
                ensure_capture_capacity(total_bytes, 1)?;
            }
            let bytes = git_output(
                session,
                &owned_refs(&args),
                MAX_PATCH_BYTES
                    .min(remaining_capture_bytes)
                    .saturating_add(1),
                deadline,
                cancelled,
            )?;
            if bytes.is_empty() {
                return Err(ReviewSourceError::new(
                    "changed-preparation",
                    format!("Pinned change metadata for {path} no longer yields a patch."),
                ));
            }
            if bytes.len() > MAX_PATCH_BYTES {
                return Err(ReviewSourceError::new(
                    "size-limit",
                    format!("A per-commit patch exceeds the {MAX_PATCH_BYTES}-byte limit."),
                ));
            }
            let byte_length = bytes.len();
            ensure_capture_capacity(total_bytes, byte_length)?;
            let content = String::from_utf8(bytes).map_err(|_| {
                ReviewSourceError::new(
                    "invalid-utf8",
                    format!("The deterministic patch for {path} is not valid UTF-8."),
                )
            })?;
            total_bytes += byte_length;
            patches.push(CapturedPatch {
                id: format!("diff:{}:{path}", change.commit_id),
                path: path.clone(),
                commit_id: change.commit_id.clone(),
                parent_commit_id: change.parent_commit_id.clone(),
                status: change.status.clone(),
                byte_length,
                content,
            });
        }
        if head_blob.is_none() && changes.is_empty() {
            return Err(ReviewSourceError::new(
                "invalid-selection",
                format!("Selected path {path} has neither a pinned source blob nor a range patch."),
            ));
        }
        files.push(CapturedFile {
            path: path.clone(),
            role,
            availability,
            head_blob,
            changes,
        });
    }
    let warning = working_tree_warning(session, deadline, cancelled)?;
    let manifest_files = files
        .iter()
        .map(|file| ManifestFile {
            path: file.path.clone(),
            role: file.role.clone(),
            availability: file.availability.clone(),
            head_blob: file.head_blob.as_ref().map(|blob| ManifestBlob {
                commit_id: blob.commit_id.clone(),
                object_id: blob.object_id.clone(),
                byte_length: blob.byte_length,
            }),
            changes: file.changes.clone(),
        })
        .collect();
    let manifest = CaptureManifest {
        schema_version: SCHEMA_VERSION,
        history_policy: preparation.descriptor.history_policy.clone(),
        commit_order: preparation.descriptor.commit_order.clone(),
        base_commit_id: preparation.descriptor.base_commit_id.clone(),
        head_commit_id: preparation.descriptor.head_commit_id.clone(),
        commits: preparation.descriptor.commits.clone(),
        files: manifest_files,
        captured_byte_count: total_bytes,
        limits: ReviewSourceLimits::default(),
    };
    Ok(CaptureResult {
        schema_version: SCHEMA_VERSION,
        session_id: session.descriptor.session_id.clone(),
        preparation_id: preparation.descriptor.preparation_id.clone(),
        request_id: input.request_id.clone(),
        workspace_id: session.descriptor.workspace_id.clone(),
        selected_paths,
        head_advanced,
        working_tree_warning: warning,
        completeness: "complete".to_owned(),
        missing_material: Vec::new(),
        omissions: Vec::new(),
        files: files.clone(),
        patches,
        manifest,
    })
}

fn verify_workspace_registry(
    app: &AppHandle,
    requested_root: &Path,
    canonical_root: &Path,
    workspace_id: &str,
) -> ReviewResult<bool> {
    let registry_path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| {
            ReviewSourceError::new(
                "native-failure",
                "The private registry location is unavailable.",
            )
        })?
        .join("workspaces.json");
    let registry: Registry = serde_json::from_slice(&fs::read(registry_path).map_err(|_| {
        ReviewSourceError::new(
            "unauthorized",
            "The vault needs a committed private workspace identity before review capture.",
        )
    })?)
    .map_err(|_| {
        ReviewSourceError::new("unauthorized", "The private workspace registry is invalid.")
    })?;
    if registry.schema_version != 1 {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The private workspace registry version is unsupported.",
        ));
    }
    Ok(registry_authorizes(
        &registry,
        requested_root,
        canonical_root,
        workspace_id,
    ))
}

fn registry_authorizes(
    registry: &Registry,
    requested_root: &Path,
    canonical_root: &Path,
    workspace_id: &str,
) -> bool {
    registry.workspaces.iter().any(|entry| {
        entry.workspace_id == workspace_id
            && Path::new(&entry.root_path) == requested_root
            && fs::canonicalize(&entry.root_path)
                .map(|path| path == canonical_root)
                .unwrap_or(false)
    })
}

#[tauri::command]
pub async fn open_review_source_session(
    app: AppHandle,
    state: State<'_, ReviewSourceState>,
    input: OpenSessionInput,
) -> ReviewResult<SessionDescriptor> {
    let requested_root = PathBuf::from(&input.root_path);
    if !requested_root.is_absolute() || !app.fs_scope().is_allowed(&requested_root) {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The vault is not authorized for this desktop process; select it again.",
        ));
    }
    let root = canonical_directory(&input.root_path)?;
    if !app.fs_scope().is_allowed(&root) {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The canonical vault is outside this desktop process's authorized scope; select it again.",
        ));
    }
    let authorized = verify_workspace_registry(&app, &requested_root, &root, &input.workspace_id)?;
    let root_text = root.to_string_lossy().into_owned();
    let workspace_id = input.workspace_id;
    let session = tauri::async_runtime::spawn_blocking(move || {
        open_session_core(&root_text, &workspace_id, authorized)
    })
    .await
    .map_err(|_| {
        ReviewSourceError::new(
            "native-failure",
            "Repository discovery stopped unexpectedly.",
        )
    })??;
    let descriptor = session.descriptor.clone();
    let mut inner = lock_inner(&state)?;
    if inner.sessions.len() >= MAX_SESSIONS {
        return Err(ReviewSourceError::new(
            "size-limit",
            "Too many source sessions are retained; dispose an older session.",
        ));
    }
    inner
        .sessions
        .insert(descriptor.session_id.clone(), session);
    Ok(descriptor)
}

#[tauri::command]
pub async fn prepare_review_source_history(
    state: State<'_, ReviewSourceState>,
    input: PrepareInput,
) -> ReviewResult<PreparationDescriptor> {
    let session = {
        let inner = lock_inner(&state)?;
        inner
            .sessions
            .get(&input.session_id)
            .cloned()
            .ok_or_else(|| {
                ReviewSourceError::new("unauthorized", "The source session is unknown or disposed.")
            })?
    };
    let commit_count = input.commit_count;
    let preparation =
        tauri::async_runtime::spawn_blocking(move || prepare_core(&session, commit_count))
            .await
            .map_err(|_| {
                ReviewSourceError::new(
                    "native-failure",
                    "History preparation stopped unexpectedly.",
                )
            })??;
    let descriptor = preparation.descriptor.clone();
    let mut inner = lock_inner(&state)?;
    let session = inner.sessions.get_mut(&input.session_id).ok_or_else(|| {
        ReviewSourceError::new(
            "changed-preparation",
            "The source session was disposed during preparation.",
        )
    })?;
    while session.preparations.len() >= MAX_PREPARATIONS {
        if let Some(oldest) = session.preparations.keys().next().cloned() {
            session.preparations.remove(&oldest);
        }
    }
    session
        .preparations
        .insert(descriptor.preparation_id.clone(), preparation);
    Ok(descriptor)
}

#[tauri::command]
pub fn list_review_source_files(
    state: State<'_, ReviewSourceState>,
    input: ListFilesInput,
) -> ReviewResult<FilePage> {
    let inner = lock_inner(&state)?;
    let session = inner.sessions.get(&input.session_id).ok_or_else(|| {
        ReviewSourceError::new("unauthorized", "The source session is unknown or disposed.")
    })?;
    let preparation = session
        .preparations
        .get(&input.preparation_id)
        .ok_or_else(|| {
            ReviewSourceError::new(
                "changed-preparation",
                "The pinned preparation is unavailable; prepare again.",
            )
        })?;
    list_files_core(session, preparation, &input)
}

#[tauri::command]
pub async fn capture_review_source(
    state: State<'_, ReviewSourceState>,
    input: CaptureInput,
) -> ReviewResult<CaptureResult> {
    let (session, preparation, cancelled) = {
        let mut inner = lock_inner(&state)?;
        if inner.active_requests.contains_key(&input.request_id) {
            return Err(ReviewSourceError::new(
                "invalid-selection",
                "Capture request identity is already active.",
            ));
        }
        let session = inner
            .sessions
            .get(&input.session_id)
            .cloned()
            .ok_or_else(|| {
                ReviewSourceError::new("unauthorized", "The source session is unknown or disposed.")
            })?;
        let preparation = session
            .preparations
            .get(&input.preparation_id)
            .cloned()
            .ok_or_else(|| {
                ReviewSourceError::new(
                    "changed-preparation",
                    "The pinned preparation is unavailable; prepare again.",
                )
            })?;
        let cancelled = Arc::new(AtomicBool::new(false));
        inner.active_requests.insert(
            input.request_id.clone(),
            ActiveRequest {
                session_id: input.session_id.clone(),
                cancelled: Arc::clone(&cancelled),
            },
        );
        (session, preparation, cancelled)
    };
    let capture_input = CaptureInput {
        session_id: input.session_id.clone(),
        preparation_id: input.preparation_id.clone(),
        request_id: input.request_id.clone(),
        selected_paths: input.selected_paths.clone(),
    };
    let result = tauri::async_runtime::spawn_blocking(move || {
        capture_core(&session, &preparation, &capture_input, &cancelled)
    })
    .await
    .map_err(|_| ReviewSourceError::new("native-failure", "Capture stopped unexpectedly."));
    let mut inner = lock_inner(&state)?;
    inner.active_requests.remove(&input.request_id);
    if !inner.sessions.contains_key(&input.session_id) {
        return Err(ReviewSourceError::new(
            "changed-preparation",
            "The source session was disposed before capture completed.",
        ));
    }
    result?
}

#[tauri::command]
pub fn cancel_review_source_capture(
    state: State<'_, ReviewSourceState>,
    input: RequestIdentityInput,
) -> ReviewResult<()> {
    let inner = lock_inner(&state)?;
    let request = inner
        .active_requests
        .get(&input.request_id)
        .ok_or_else(|| ReviewSourceError::new("cancelled", "The capture is no longer active."))?;
    if request.session_id != input.session_id {
        return Err(ReviewSourceError::new(
            "unauthorized",
            "The capture request does not belong to this source session.",
        ));
    }
    request.cancelled.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn dispose_review_source_session(
    state: State<'_, ReviewSourceState>,
    input: SessionIdentityInput,
) -> ReviewResult<()> {
    let mut inner = lock_inner(&state)?;
    if inner.sessions.remove(&input.session_id).is_none() {
        return Ok(());
    }
    for request in inner.active_requests.values() {
        if request.session_id == input.session_id {
            request.cancelled.store(true, Ordering::SeqCst);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;

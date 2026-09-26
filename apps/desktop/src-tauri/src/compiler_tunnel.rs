use serde::Serialize;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use std::process::{Command, Stdio};
#[cfg(target_os = "windows")]
use std::thread;
#[cfg(target_os = "windows")]
use std::time::{Duration, Instant};

#[cfg(any(target_os = "windows", test))]
const ARGUMENT_COMPILER_TUNNEL_TASK_NAME: &str = "Icarus Argument Compiler Tunnel";
#[cfg(any(target_os = "windows", test))]
const ALREADY_RUNNING_EXIT_CODE: i32 = 10;
#[cfg(any(target_os = "windows", test))]
const STARTED_EXIT_CODE: i32 = 11;
#[cfg(any(target_os = "windows", test))]
const QUERY_FAILURE_EXIT_CODE: i32 = 20;
#[cfg(any(target_os = "windows", test))]
const AMBIGUOUS_TASK_EXIT_CODE: i32 = 21;
#[cfg(any(target_os = "windows", test))]
const START_FAILURE_EXIT_CODE: i32 = 30;

#[cfg(target_os = "windows")]
const COMMAND_TIMEOUT: Duration = Duration::from_secs(10);
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ArgumentCompilerTunnelStatus {
    #[cfg(any(target_os = "windows", test))]
    AlreadyRunning,
    #[cfg(any(target_os = "windows", test))]
    Started,
    #[cfg(not(target_os = "windows"))]
    UnsupportedPlatform,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArgumentCompilerTunnelResult {
    status: ArgumentCompilerTunnelStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArgumentCompilerTunnelError {
    code: &'static str,
    message: &'static str,
}

type TunnelResult = Result<ArgumentCompilerTunnelResult, ArgumentCompilerTunnelError>;

#[cfg(any(target_os = "windows", test))]
fn tunnel_error(code: &'static str, message: &'static str) -> ArgumentCompilerTunnelError {
    ArgumentCompilerTunnelError { code, message }
}

#[cfg(any(target_os = "windows", test))]
fn scheduled_task_script() -> String {
    [
        "$ErrorActionPreference = 'Stop'; ",
        "$ProgressPreference = 'SilentlyContinue'; ",
        "try { $tasks = @(Get-ScheduledTask -TaskName '",
        ARGUMENT_COMPILER_TUNNEL_TASK_NAME,
        "' -ErrorAction Stop) } catch { exit 20 }; ",
        "if ($tasks.Count -ne 1) { exit 21 }; ",
        "$task = $tasks[0]; ",
        "if ($task.State -eq 'Running') { exit 10 }; ",
        "try { Start-ScheduledTask -InputObject $task -ErrorAction Stop } ",
        "catch { exit 30 }; ",
        "exit 11",
    ]
    .concat()
}

#[cfg(any(target_os = "windows", test))]
#[derive(Debug, Clone, PartialEq, Eq)]
struct CapturedCommand {
    exit_code: Option<i32>,
}

#[cfg(any(target_os = "windows", test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CommandFailure {
    Unavailable,
    TimedOut,
    NativeFailure,
}

#[cfg(any(target_os = "windows", test))]
trait ScheduledTaskCommand {
    fn run(&self) -> Result<CapturedCommand, CommandFailure>;
}

#[cfg(any(target_os = "windows", test))]
fn ensure_with(command: &impl ScheduledTaskCommand) -> TunnelResult {
    let output = command.run().map_err(|failure| match failure {
        CommandFailure::Unavailable => tunnel_error(
            "powershell-unavailable",
            "Windows PowerShell could not be started to check the configured Argument Compiler tunnel task.",
        ),
        CommandFailure::TimedOut => tunnel_error(
            "task-query-failed",
            "Checking the configured Argument Compiler tunnel task timed out.",
        ),
        CommandFailure::NativeFailure => tunnel_error(
            "native-failure",
            "The Argument Compiler tunnel task check failed unexpectedly.",
        ),
    })?;

    match output.exit_code {
        Some(ALREADY_RUNNING_EXIT_CODE) => Ok(ArgumentCompilerTunnelResult {
            status: ArgumentCompilerTunnelStatus::AlreadyRunning,
        }),
        Some(STARTED_EXIT_CODE) => Ok(ArgumentCompilerTunnelResult {
            status: ArgumentCompilerTunnelStatus::Started,
        }),
        Some(QUERY_FAILURE_EXIT_CODE) => Err(tunnel_error(
            "task-query-failed",
            "The configured Argument Compiler tunnel task could not be found or queried.",
        )),
        Some(AMBIGUOUS_TASK_EXIT_CODE) => Err(tunnel_error(
            "task-query-failed",
            "More than one configured Argument Compiler tunnel task matched the fixed task name.",
        )),
        Some(START_FAILURE_EXIT_CODE) => Err(tunnel_error(
            "task-start-failed",
            "Windows refused to start the configured Argument Compiler tunnel task.",
        )),
        _ => Err(tunnel_error(
            "native-failure",
            "The Argument Compiler tunnel task check failed unexpectedly.",
        )),
    }
}

#[cfg(target_os = "windows")]
struct PowerShellScheduledTaskCommand;

#[cfg(target_os = "windows")]
impl ScheduledTaskCommand for PowerShellScheduledTaskCommand {
    fn run(&self) -> Result<CapturedCommand, CommandFailure> {
        let mut child = Command::new("powershell.exe")
            .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"])
            .arg(scheduled_task_script())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|_| CommandFailure::Unavailable)?;
        let started_at = Instant::now();
        let exit_status = loop {
            match child.try_wait() {
                Ok(Some(status)) => break status,
                Ok(None) => {}
                Err(_) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(CommandFailure::NativeFailure);
                }
            }
            if started_at.elapsed() >= COMMAND_TIMEOUT {
                let _ = child.kill();
                let _ = child.wait();
                return Err(CommandFailure::TimedOut);
            }
            thread::sleep(Duration::from_millis(10));
        };
        Ok(CapturedCommand {
            exit_code: exit_status.code(),
        })
    }
}

#[tauri::command]
pub async fn ensure_argument_compiler_tunnel_running() -> TunnelResult {
    #[cfg(target_os = "windows")]
    {
        return tauri::async_runtime::spawn_blocking(|| {
            ensure_with(&PowerShellScheduledTaskCommand)
        })
        .await
        .map_err(|_| {
            tunnel_error(
                "native-failure",
                "The Argument Compiler tunnel task check stopped unexpectedly.",
            )
        })?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(ArgumentCompilerTunnelResult {
            status: ArgumentCompilerTunnelStatus::UnsupportedPlatform,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct StubCommand(Result<CapturedCommand, CommandFailure>);

    impl ScheduledTaskCommand for StubCommand {
        fn run(&self) -> Result<CapturedCommand, CommandFailure> {
            self.0.clone()
        }
    }

    fn output(exit_code: i32) -> StubCommand {
        StubCommand(Ok(CapturedCommand {
            exit_code: Some(exit_code),
        }))
    }

    #[test]
    fn maps_an_already_running_task() {
        let result = ensure_with(&output(ALREADY_RUNNING_EXIT_CODE)).unwrap();
        assert_eq!(result.status, ArgumentCompilerTunnelStatus::AlreadyRunning);
    }

    #[test]
    fn maps_a_started_task() {
        let result = ensure_with(&output(STARTED_EXIT_CODE)).unwrap();
        assert_eq!(result.status, ArgumentCompilerTunnelStatus::Started);
    }

    #[test]
    fn maps_missing_or_unqueryable_tasks_without_native_details() {
        let error = ensure_with(&output(QUERY_FAILURE_EXIT_CODE))
            .expect_err("query failure must remain visible");
        assert_eq!(error.code, "task-query-failed");
        assert!(error.message.contains("could not be found or queried"));
        assert!(!error.message.contains("C:\\"));
    }

    #[test]
    fn maps_start_failures() {
        let error = ensure_with(&output(START_FAILURE_EXIT_CODE))
            .expect_err("start failure must remain visible");
        assert_eq!(error.code, "task-start-failed");
        assert!(error.message.contains("refused to start"));
    }

    #[test]
    fn bounds_and_sanitizes_process_failures() {
        let error = ensure_with(&StubCommand(Err(CommandFailure::NativeFailure)))
            .expect_err("native failure must remain sanitized");
        assert_eq!(error.code, "native-failure");
        assert!(error.message.len() < 160);
        assert!(!error.message.contains(ARGUMENT_COMPILER_TUNNEL_TASK_NAME));
    }

    #[test]
    fn maps_unavailable_and_timed_out_powershell_without_native_details() {
        let unavailable = ensure_with(&StubCommand(Err(CommandFailure::Unavailable)))
            .expect_err("unavailable PowerShell must fail");
        assert_eq!(unavailable.code, "powershell-unavailable");
        let timed_out = ensure_with(&StubCommand(Err(CommandFailure::TimedOut)))
            .expect_err("timed out PowerShell must fail");
        assert_eq!(timed_out.code, "task-query-failed");
    }

    #[test]
    fn script_targets_only_the_fixed_scheduled_task() {
        let script = scheduled_task_script();
        assert!(script.contains(ARGUMENT_COMPILER_TUNNEL_TASK_NAME));
        assert!(!script.contains("Write"));
        assert!(!script.contains("start-icarus-compiler.ps1"));
    }
}

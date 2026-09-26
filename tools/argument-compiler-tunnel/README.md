# Argument Compiler tunnel launcher

This folder owns the canonical Windows launcher for the existing local
Argument Compiler tunnel.

- `start-icarus-compiler.ps1` validates the fixed local prerequisites, always
  rebuilds the Argument MCP server, verifies the deployment bundle, and only
  then starts the fixed `icarus-compiler` tunnel profile. Build and tunnel
  output remain in the existing launcher log.

The existing `Icarus Argument Compiler Tunnel` Scheduled Task runs the
installed copy at:

```text
%LOCALAPPDATA%\Icarus\tunnel-client\start-icarus-compiler.ps1
```

The Scheduled Task remains the lifecycle owner. The repository script is the
source of truth, but changing it does not update the installed copy
automatically. After merging a launcher change, refresh that copy from the
primary checkout and restart the existing task:

```powershell
$source = Join-Path $env:USERPROFILE 'Documents\GitHub\icarus-graph-explorer\tools\argument-compiler-tunnel\start-icarus-compiler.ps1'
$destination = Join-Path $env:LOCALAPPDATA 'Icarus\tunnel-client\start-icarus-compiler.ps1'
Copy-Item -LiteralPath $destination -Destination "$destination.backup" -Force
Copy-Item -LiteralPath $source -Destination $destination -Force
schtasks /End /TN "Icarus Argument Compiler Tunnel"
schtasks /Run /TN "Icarus Argument Compiler Tunnel"
```

Do not create a second task or change the task name, tunnel profile,
credentials, tunnel client, or Argument Library path while refreshing this
launcher.

$ErrorActionPreference = 'Stop'

$installDirectory = Join-Path $env:LOCALAPPDATA 'Icarus\tunnel-client'
$tunnelClient = Join-Path $installDirectory 'bin\tunnel-client.exe'
$repoRoot = Join-Path $env:USERPROFILE 'Documents\GitHub\icarus-graph-explorer'
$serverBundle = Join-Path $repoRoot 'packages\argument-mcp-server\dist\server.js'
$pnpm = Join-Path $env:APPDATA 'npm\pnpm.cmd'
$nodeDirectory = Join-Path $env:ProgramFiles 'nodejs'
$logDirectory = Join-Path $installDirectory 'logs'
$logFile = Join-Path $logDirectory 'icarus-compiler.log'
$previousLog = Join-Path $logDirectory 'icarus-compiler.previous.log'
$maxLogBytes = 8MB

function Write-LauncherLog {
    param([Parameter(Mandatory = $true)][string]$Message)

    $timestamp = (Get-Date).ToUniversalTime().ToString('o')
    Add-Content -LiteralPath $logFile -Value "$timestamp launcher $Message" -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

    if ((Test-Path -LiteralPath $logFile) -and
        ((Get-Item -LiteralPath $logFile).Length -ge $maxLogBytes)) {
        if (Test-Path -LiteralPath $previousLog) {
            Remove-Item -LiteralPath $previousLog -Force
        }
        Move-Item -LiteralPath $logFile -Destination $previousLog
    }

    if (-not (Test-Path -LiteralPath $tunnelClient -PathType Leaf)) {
        throw "Tunnel client is missing: $tunnelClient"
    }

    if (-not (Test-Path -LiteralPath $nodeDirectory -PathType Container)) {
        throw "Node.js directory is missing: $nodeDirectory"
    }
    $env:Path = $nodeDirectory + ';' + $env:Path

    if (-not (Test-Path -LiteralPath $pnpm -PathType Leaf)) {
        throw "pnpm is missing: $pnpm"
    }

    if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
        throw "Repository root is missing: $repoRoot"
    }

    Write-LauncherLog 'Building a fresh Argument MCP package before starting the tunnel.'
    $buildExitCode = $null
    Push-Location -LiteralPath $repoRoot
    try {
        $savedErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            & $pnpm --filter '@icarus-graph-explorer/argument-mcp-server' build 2>&1 |
                Out-File -LiteralPath $logFile -Append -Encoding utf8
            $buildExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $savedErrorActionPreference
        }
    } finally {
        Pop-Location
    }

    if ($buildExitCode -ne 0) {
        throw "Argument MCP server build failed with exit code $buildExitCode."
    }

    if (-not (Test-Path -LiteralPath $serverBundle -PathType Leaf)) {
        throw "Argument MCP server build did not produce the expected bundle: $serverBundle"
    }

    Write-LauncherLog 'Starting tunnel client with the icarus-compiler profile.'
    $savedErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $tunnelClient run --profile icarus-compiler 2>&1 |
            Out-File -LiteralPath $logFile -Append -Encoding utf8
        $tunnelExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $savedErrorActionPreference
    }
    Write-LauncherLog "Tunnel client exited with code $tunnelExitCode."
    exit $tunnelExitCode
} catch {
    Write-LauncherLog ("Startup failed: " + $_.Exception.Message)
    exit 1
}

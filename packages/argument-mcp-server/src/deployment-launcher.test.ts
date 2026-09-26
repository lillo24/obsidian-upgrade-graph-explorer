import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const launcher = readFileSync(
  new URL(
    '../../../tools/argument-compiler-tunnel/start-icarus-compiler.ps1',
    import.meta.url,
  ),
  'utf8',
);

const indexOfRequired = (source: string, value: string): number => {
  const index = source.indexOf(value);
  expect(
    index,
    `Expected launcher to contain: ${value}`,
  ).toBeGreaterThanOrEqual(0);
  return index;
};

describe('Argument Compiler deployment launcher', () => {
  it('unconditionally builds the Argument MCP package', () => {
    const buildLog = indexOfRequired(
      launcher,
      "Write-LauncherLog 'Building a fresh Argument MCP package before starting the tunnel.'",
    );
    const build = indexOfRequired(
      launcher,
      "& $pnpm --filter '@icarus-graph-explorer/argument-mcp-server' build",
    );

    expect(launcher.match(/argument-mcp-server' build/g)).toHaveLength(1);
    expect(launcher.slice(buildLog, build)).not.toMatch(/\bif\s*\(/);
  });

  it('fails closed before starting the tunnel when the build is unusable', () => {
    const build = indexOfRequired(
      launcher,
      "& $pnpm --filter '@icarus-graph-explorer/argument-mcp-server' build",
    );
    const exitCodeCheck = indexOfRequired(
      launcher,
      'if ($buildExitCode -ne 0)',
    );
    const bundleCheck = indexOfRequired(
      launcher,
      'if (-not (Test-Path -LiteralPath $serverBundle -PathType Leaf))',
    );
    const tunnel = indexOfRequired(
      launcher,
      '& $tunnelClient run --profile icarus-compiler',
    );

    expect(build).toBeLessThan(exitCodeCheck);
    expect(exitCodeCheck).toBeLessThan(bundleCheck);
    expect(bundleCheck).toBeLessThan(tunnel);
  });

  it('keeps deployment inputs fixed', () => {
    expect(launcher).toMatch(/^\$ErrorActionPreference = 'Stop'/);
    expect(launcher).not.toMatch(/^(?:\s*#.*\r?\n|\s)*param\s*\(/i);
    expect(launcher).not.toContain('$args');
    expect(launcher).not.toMatch(/\$(?:profile|taskName)\b/i);
    expect(launcher.match(/run --profile icarus-compiler/g)).toHaveLength(1);
    expect(launcher).not.toMatch(/run --profile\s+\$[A-Za-z]/i);
  });
});

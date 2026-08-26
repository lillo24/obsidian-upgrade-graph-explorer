import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DiagnosticCliOptions } from './types';

const HELP = `Usage: pnpm diagnose:vault -- --vault <path> [options]

Options:
  --vault <path>          Local vault root (required)
  --out <path>            Optional private JSON report destination
  --exclude <prefix>      Workspace-relative directory prefix; repeatable
  --workspace-id <id>     Development-only workspace ID (default: root basename)
  --verbose               Print additional aggregate timing details
  --help                  Show this help`;

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function argumentValue(
  args: readonly string[],
  index: number,
  flag: string,
): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function diagnosticCliHelp(): string {
  return HELP;
}

export function parseDiagnosticCliArguments(
  args: readonly string[],
  baseDirectory = REPOSITORY_ROOT,
): DiagnosticCliOptions | { readonly help: true } {
  let vaultPath: string | undefined;
  let outputPath: string | undefined;
  let workspaceId: string | undefined;
  let verbose = false;
  const excludes: string[] = [];

  const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
  for (let index = 0; index < normalizedArgs.length; index += 1) {
    const argument = normalizedArgs[index];
    if (argument === '--help') return { help: true };
    if (argument === '--verbose') {
      verbose = true;
      continue;
    }
    if (
      argument === '--vault' ||
      argument === '--out' ||
      argument === '--exclude' ||
      argument === '--workspace-id'
    ) {
      const value = argumentValue(normalizedArgs, index, argument);
      index += 1;
      if (argument === '--vault') vaultPath = value;
      else if (argument === '--out') outputPath = value;
      else if (argument === '--exclude') excludes.push(value);
      else workspaceId = value;
      continue;
    }
    throw new Error(`Unknown option: ${argument ?? ''}`);
  }

  if (vaultPath === undefined) {
    throw new Error('--vault is required.');
  }
  const absoluteVaultPath = resolve(baseDirectory, vaultPath);
  const resolvedWorkspaceId = workspaceId ?? basename(absoluteVaultPath);
  if (resolvedWorkspaceId.trim().length === 0) {
    throw new Error('--workspace-id must be non-empty.');
  }
  return {
    vaultPath: absoluteVaultPath,
    workspaceId: resolvedWorkspaceId,
    excludes,
    ...(outputPath === undefined
      ? {}
      : { outputPath: resolve(baseDirectory, outputPath) }),
    verbose,
  };
}

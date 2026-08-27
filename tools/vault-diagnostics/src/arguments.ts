import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultIdentityStorePath } from './identity-store';
import type { DiagnosticCliOptions } from './types';

const HELP = `Usage: pnpm diagnose:vault -- --vault <path> [options]

Options:
  --vault <path>          Local vault root (required)
  --out <path>            Optional private JSON report destination
  --identity-store <path> Private stable-identity catalog (default: beside --out)
  --reset-identity        Explicitly discard prior identity continuity
  --exclude <prefix>      Workspace-relative directory prefix; repeatable
  --workspace-id <id>     Explicit ID; persistent runs otherwise generate one once
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
  let identityStorePath: string | undefined;
  let workspaceId: string | undefined;
  let resetIdentity = false;
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
    if (argument === '--reset-identity') {
      resetIdentity = true;
      continue;
    }
    if (
      argument === '--vault' ||
      argument === '--out' ||
      argument === '--identity-store' ||
      argument === '--exclude' ||
      argument === '--workspace-id'
    ) {
      const value = argumentValue(normalizedArgs, index, argument);
      index += 1;
      if (argument === '--vault') vaultPath = value;
      else if (argument === '--out') outputPath = value;
      else if (argument === '--identity-store') identityStorePath = value;
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
  const absoluteOutputPath =
    outputPath === undefined ? undefined : resolve(baseDirectory, outputPath);
  const absoluteIdentityStorePath =
    identityStorePath === undefined
      ? absoluteOutputPath === undefined
        ? undefined
        : defaultIdentityStorePath(absoluteOutputPath)
      : resolve(baseDirectory, identityStorePath);
  const resolvedWorkspaceId = workspaceId ?? basename(absoluteVaultPath);
  if (resolvedWorkspaceId.trim().length === 0) {
    throw new Error('--workspace-id must be non-empty.');
  }
  if (resetIdentity && absoluteIdentityStorePath === undefined) {
    throw new Error('--reset-identity requires --identity-store or --out.');
  }
  if (
    absoluteOutputPath !== undefined &&
    absoluteIdentityStorePath === absoluteOutputPath
  ) {
    throw new Error(
      '--identity-store must not overwrite the diagnostic report.',
    );
  }
  return {
    vaultPath: absoluteVaultPath,
    workspaceId: resolvedWorkspaceId,
    excludes,
    ...(absoluteOutputPath === undefined
      ? {}
      : { outputPath: absoluteOutputPath }),
    ...(absoluteIdentityStorePath === undefined
      ? {}
      : { identityStorePath: absoluteIdentityStorePath }),
    resetIdentity,
    workspaceIdWasExplicit: workspaceId !== undefined,
    verbose,
  };
}

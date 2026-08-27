import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import {
  createStableIdentityCatalog,
  validateStableIdentityCatalog,
  type StableIdentityCatalog,
} from '@icarus-graph-explorer/stable-identity';

export interface PreparedIdentityStore {
  readonly catalog: StableIdentityCatalog;
  readonly created: boolean;
  readonly reset: boolean;
}

interface PrepareIdentityStoreOptions {
  readonly vaultPath: string;
  readonly identityStorePath: string;
  readonly reset: boolean;
  readonly explicitWorkspaceId?: string;
  readonly workspaceIdFactory?: () => string;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

async function canonicalPotentialPath(path: string): Promise<string> {
  const absolute = resolve(path);
  const suffix: string[] = [];
  let candidate = absolute;
  while (true) {
    try {
      const existing = await realpath(candidate);
      return suffix.length === 0
        ? existing
        : join(existing, ...suffix.reverse());
    } catch (error: unknown) {
      if (!isMissingFile(error)) {
        throw new Error(
          `Cannot inspect identity-store location ${JSON.stringify(absolute)}.`,
          { cause: error },
        );
      }
      const parent = dirname(candidate);
      if (parent === candidate) {
        throw new Error(
          `Cannot resolve an existing ancestor for identity-store location ${JSON.stringify(absolute)}.`,
          { cause: error },
        );
      }
      suffix.push(candidate.slice(parent.length).replace(/^[/\\]+/u, ''));
      candidate = parent;
    }
  }
}

function isInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith('..') && !isAbsolute(pathFromRoot))
  );
}

/** Reject private application metadata anywhere under the selected vault. */
export async function assertIdentityStoreOutsideVault(
  vaultPath: string,
  identityStorePath: string,
): Promise<void> {
  const [canonicalVault, canonicalStore] = await Promise.all([
    canonicalPotentialPath(vaultPath),
    canonicalPotentialPath(identityStorePath),
  ]);
  if (isInside(canonicalVault, canonicalStore)) {
    throw new Error(
      'The identity store must be outside the selected Markdown vault.',
    );
  }
}

export function defaultIdentityStorePath(outputPath: string): string {
  return outputPath.toLowerCase().endsWith('.json')
    ? `${outputPath.slice(0, -'.json'.length)}.identity.json`
    : `${outputPath}.identity.json`;
}

async function readIdentityCatalog(
  identityStorePath: string,
): Promise<StableIdentityCatalog | undefined> {
  let source: string;
  try {
    source = await readFile(identityStorePath, 'utf8');
  } catch (error: unknown) {
    if (isMissingFile(error)) return undefined;
    throw new Error(
      `Cannot read identity catalog ${JSON.stringify(identityStorePath)}.`,
      { cause: error },
    );
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(source);
  } catch (error: unknown) {
    throw new Error(
      `Identity catalog ${JSON.stringify(identityStorePath)} is not valid JSON. Use --reset-identity to discard continuity explicitly.`,
      { cause: error },
    );
  }
  const validation = validateStableIdentityCatalog(candidate);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Identity catalog ${JSON.stringify(identityStorePath)} is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      } Use --reset-identity to discard continuity explicitly.`,
    );
  }
  return validation.value;
}

/** Load valid private state or explicitly initialize/reset one workspace identity. */
export async function prepareIdentityStore(
  options: PrepareIdentityStoreOptions,
): Promise<PreparedIdentityStore> {
  await assertIdentityStoreOutsideVault(
    options.vaultPath,
    options.identityStorePath,
  );
  const existing = options.reset
    ? undefined
    : await readIdentityCatalog(options.identityStorePath);
  if (existing !== undefined) {
    if (
      options.explicitWorkspaceId !== undefined &&
      options.explicitWorkspaceId !== existing.workspaceId
    ) {
      throw new Error(
        'The explicit workspace ID conflicts with the existing identity catalog. Use --reset-identity to discard continuity explicitly.',
      );
    }
    return { catalog: existing, created: false, reset: false };
  }
  const workspaceId =
    options.explicitWorkspaceId ?? (options.workspaceIdFactory ?? randomUUID)();
  return {
    catalog: createStableIdentityCatalog(workspaceId),
    created: true,
    reset: options.reset,
  };
}

export function serializeIdentityCatalog(
  catalog: StableIdentityCatalog,
): string {
  const validation = validateStableIdentityCatalog(catalog);
  if (!validation.valid) {
    const first = validation.issues[0];
    throw new Error(
      `Refusing to serialize an invalid identity catalog${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
    );
  }
  return `${JSON.stringify(validation.value, null, 2)}\n`;
}

/** Write a validated temporary sibling, close it, then replace the catalog. */
export async function writeIdentityCatalogAtomically(
  identityStorePath: string,
  catalog: StableIdentityCatalog,
): Promise<void> {
  const serialized = serializeIdentityCatalog(catalog);
  await mkdir(dirname(identityStorePath), { recursive: true });
  const temporaryPath = `${identityStorePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, serialized, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryPath, identityStorePath);
  } catch (error: unknown) {
    try {
      await unlink(temporaryPath);
    } catch (cleanupError: unknown) {
      if (!isMissingFile(cleanupError)) {
        throw new AggregateError(
          [error, cleanupError],
          `Identity catalog replacement and temporary-file cleanup both failed for ${JSON.stringify(identityStorePath)}.`,
          { cause: cleanupError },
        );
      }
    }
    throw new Error(
      `Cannot atomically replace identity catalog ${JSON.stringify(identityStorePath)}.`,
      { cause: error },
    );
  }
}

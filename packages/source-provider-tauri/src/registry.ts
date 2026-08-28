import type { WorkspaceId } from '@icarus-graph-explorer/core';
import {
  validateStableIdentityCatalog,
  type StableIdentityCatalog,
} from '@icarus-graph-explorer/stable-identity';
import { compareWorkspaceText } from '@icarus-graph-explorer/vault-discovery-policy';

import type { TauriNativeBridge } from './bridge';
import {
  RecoverableWorkspaceIdentityError,
  type TauriWorkspaceRegistry,
} from './types';

export const TAURI_WORKSPACE_REGISTRY_SCHEMA_VERSION = 1 as const;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

type PlainRecord = Record<string, unknown>;

export interface PrivateStatePaths {
  readonly root: string;
  readonly registry: string;
  readonly identityDirectory: string;
}

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactFields(value: PlainRecord, fields: readonly string[]): boolean {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((field) => Object.hasOwn(value, field))
  );
}

export function validateWorkspaceRegistry(
  value: unknown,
): TauriWorkspaceRegistry {
  if (
    !isRecord(value) ||
    !exactFields(value, ['schemaVersion', 'workspaces']) ||
    value.schemaVersion !== TAURI_WORKSPACE_REGISTRY_SCHEMA_VERSION ||
    !Array.isArray(value.workspaces)
  ) {
    throw new RecoverableWorkspaceIdentityError(
      'The private workspace registry is malformed or uses an unsupported schema.',
      'replace-corrupt-registry',
    );
  }
  const workspaces = value.workspaces.map((entry, index) => {
    if (
      !isRecord(entry) ||
      !exactFields(entry, ['rootPath', 'workspaceId']) ||
      typeof entry.rootPath !== 'string' ||
      entry.rootPath.trim() === '' ||
      typeof entry.workspaceId !== 'string' ||
      entry.workspaceId.trim() === ''
    ) {
      throw new RecoverableWorkspaceIdentityError(
        `The private workspace registry entry at index ${index} is invalid.`,
        'replace-corrupt-registry',
      );
    }
    return { rootPath: entry.rootPath, workspaceId: entry.workspaceId };
  });
  if (
    new Set(workspaces.map(({ rootPath }) => rootPath)).size !==
      workspaces.length ||
    new Set(workspaces.map(({ workspaceId }) => workspaceId)).size !==
      workspaces.length
  ) {
    throw new RecoverableWorkspaceIdentityError(
      'The private workspace registry contains duplicate roots or workspace IDs.',
      'replace-corrupt-registry',
    );
  }
  return {
    schemaVersion: TAURI_WORKSPACE_REGISTRY_SCHEMA_VERSION,
    workspaces,
  };
}

export async function privateStatePaths(
  bridge: TauriNativeBridge,
): Promise<PrivateStatePaths> {
  const root = await bridge.appLocalDataDirectory();
  return {
    root,
    registry: await bridge.joinPath(root, 'workspaces.json'),
    identityDirectory: await bridge.joinPath(root, 'identity'),
  };
}

async function readJson(
  bridge: TauriNativeBridge,
  path: string,
  label: string,
): Promise<unknown | undefined> {
  if (!(await bridge.pathExists(path))) return undefined;
  let bytes;
  try {
    bytes = await bridge.readFileBytes(path);
  } catch (error: unknown) {
    throw new Error(`Cannot read the private ${label}.`, { cause: error });
  }
  let source;
  try {
    source = UTF8_DECODER.decode(bytes);
  } catch (error: unknown) {
    throw new Error(`The private ${label} is not valid UTF-8.`, {
      cause: error,
    });
  }
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new RecoverableWorkspaceIdentityError(
      `The private ${label} is not valid JSON.`,
      label === 'workspace registry'
        ? 'replace-corrupt-registry'
        : 'reset-vault-identity',
    );
  }
}

export async function readWorkspaceRegistry(
  bridge: TauriNativeBridge,
  paths: PrivateStatePaths,
): Promise<TauriWorkspaceRegistry> {
  const candidate = await readJson(
    bridge,
    paths.registry,
    'workspace registry',
  );
  return candidate === undefined
    ? {
        schemaVersion: TAURI_WORKSPACE_REGISTRY_SCHEMA_VERSION,
        workspaces: [],
      }
    : validateWorkspaceRegistry(candidate);
}

export async function catalogPath(
  bridge: TauriNativeBridge,
  paths: PrivateStatePaths,
  workspaceId: WorkspaceId,
): Promise<string> {
  return bridge.joinPath(
    paths.identityDirectory,
    `${encodeURIComponent(workspaceId)}.json`,
  );
}

export async function readKnownCatalog(
  bridge: TauriNativeBridge,
  paths: PrivateStatePaths,
  workspaceId: WorkspaceId,
): Promise<StableIdentityCatalog> {
  const path = await catalogPath(bridge, paths, workspaceId);
  const candidate = await readJson(bridge, path, 'identity catalog');
  if (candidate === undefined) {
    throw new RecoverableWorkspaceIdentityError(
      'The selected vault is registered but its identity catalog is missing.',
      'reset-vault-identity',
    );
  }
  const validation = validateStableIdentityCatalog(candidate);
  if (!validation.valid || validation.value.workspaceId !== workspaceId) {
    const first = validation.valid ? undefined : validation.issues[0];
    throw new RecoverableWorkspaceIdentityError(
      `The selected vault identity catalog is invalid${
        first === undefined ? '.' : ` at ${first.path}: ${first.message}`
      }`,
      'reset-vault-identity',
    );
  }
  return validation.value;
}

export function serializeRegistry(registry: TauriWorkspaceRegistry): string {
  const validated = validateWorkspaceRegistry(registry);
  const sorted = [...validated.workspaces].sort((left, right) =>
    compareWorkspaceText(left.rootPath, right.rootPath),
  );
  return `${JSON.stringify(
    {
      schemaVersion: TAURI_WORKSPACE_REGISTRY_SCHEMA_VERSION,
      workspaces: sorted,
    },
    null,
    2,
  )}\n`;
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

export async function writeTextAtomically(
  bridge: TauriNativeBridge,
  targetPath: string,
  content: string,
  temporaryToken: string,
): Promise<void> {
  const directory = await bridge.dirname(targetPath);
  await bridge.createDirectory(directory);
  const temporaryPath = `${targetPath}.${encodeURIComponent(temporaryToken)}.tmp`;
  try {
    await bridge.writeTextFile(temporaryPath, content, { createNew: true });
    await bridge.renamePath(temporaryPath, targetPath);
  } catch (error: unknown) {
    try {
      if (await bridge.pathExists(temporaryPath)) {
        await bridge.removeFile(temporaryPath);
      }
    } catch (cleanupError: unknown) {
      throw new AggregateError(
        [error, cleanupError],
        'Private state replacement and temporary-file cleanup both failed.',
        { cause: cleanupError },
      );
    }
    throw new Error('Cannot safely replace private application state.', {
      cause: error,
    });
  }
}

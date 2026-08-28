import {
  createStableIdentityCatalog,
  validateStableIdentityCatalog,
} from '@icarus-graph-explorer/stable-identity';

import { createTauriNativeBridge, type TauriNativeBridge } from './bridge';
import { discoverSelectedVault } from './discovery';
import { reconcileSelectedVaultChanges } from './reconciliation';
import {
  catalogPath,
  privateStatePaths,
  readKnownCatalog,
  readWorkspaceRegistry,
  serializeIdentityCatalog,
  serializeRegistry,
  writeTextAtomically,
  type PrivateStatePaths,
} from './registry';
import { normalizedRootPath, selectVaultDirectory } from './selection';
import {
  RecoverableWorkspaceIdentityError,
  type TauriSourceProvider,
  type TauriWorkspaceRegistry,
  type WorkspaceIdentitySession,
} from './types';
import { watchSelectedVault } from './watch';
import type { WatchScheduler } from './watch-burst';

interface ProviderOptions {
  readonly bridge?: TauriNativeBridge;
  readonly watchScheduler?: WatchScheduler;
  readonly workspaceIdFactory?: () => string;
  readonly temporaryTokenFactory?: () => string;
}

interface PrivateIdentitySession {
  readonly normalizedRootPath: string;
  readonly paths: PrivateStatePaths;
  readonly registry: TauriWorkspaceRegistry;
  registered: boolean;
}

function randomId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure workspace identity generation is unavailable.');
  }
  return globalThis.crypto.randomUUID();
}

function validGeneratedId(value: string): string {
  if (value.trim() === '') {
    throw new Error('The workspace ID factory returned an empty value.');
  }
  return value;
}

export function createTauriSourceProvider(
  options: ProviderOptions = {},
): TauriSourceProvider {
  const bridge = options.bridge ?? createTauriNativeBridge();
  const workspaceIdFactory = options.workspaceIdFactory ?? randomId;
  const temporaryTokenFactory = options.temporaryTokenFactory ?? randomId;
  const privateSessions = new WeakMap<
    WorkspaceIdentitySession,
    PrivateIdentitySession
  >();

  return {
    selectVaultDirectory: () => selectVaultDirectory(bridge),
    discoverSelectedVault: (selection, discoveryOptions) =>
      discoverSelectedVault(bridge, selection, discoveryOptions),
    watchSelectedVault: (selection, listener, watchOptions) =>
      watchSelectedVault(
        bridge,
        selection,
        listener,
        watchOptions,
        options.watchScheduler === undefined
          ? {}
          : { scheduler: options.watchScheduler },
      ),
    reconcileSelectedVaultChanges: (input, discoveryOptions) =>
      reconcileSelectedVaultChanges(bridge, input, discoveryOptions),
    async loadOrPrepareWorkspaceIdentity(selection, prepareOptions = {}) {
      const normalizedRoot = await normalizedRootPath(
        bridge,
        selection.rootPath,
      );
      const paths = await privateStatePaths(bridge);
      let registry;
      try {
        registry = await readWorkspaceRegistry(bridge, paths);
      } catch (error: unknown) {
        if (
          !prepareOptions.reset ||
          !prepareOptions.replaceCorruptRegistry ||
          !(error instanceof RecoverableWorkspaceIdentityError) ||
          error.recovery !== 'replace-corrupt-registry'
        ) {
          throw error;
        }
        registry = { schemaVersion: 1, workspaces: [] } as const;
      }
      const known = registry.workspaces.find(
        ({ rootPath }) => rootPath === normalizedRoot,
      );
      let catalog;
      let association: WorkspaceIdentitySession['association'];
      let previousWorkspaceId: string | undefined;
      if (known !== undefined && !prepareOptions.reset) {
        catalog = await readKnownCatalog(bridge, paths, known.workspaceId);
        association = 'existing';
      } else {
        const workspaceId = validGeneratedId(workspaceIdFactory());
        catalog = createStableIdentityCatalog(workspaceId);
        association = known === undefined ? 'new' : 'reset';
        previousWorkspaceId = known?.workspaceId;
      }
      const session: WorkspaceIdentitySession = {
        selection,
        workspaceId: catalog.workspaceId,
        catalog,
        association,
        ...(previousWorkspaceId === undefined ? {} : { previousWorkspaceId }),
      };
      privateSessions.set(session, {
        normalizedRootPath: normalizedRoot,
        paths,
        registry,
        registered: association === 'existing',
      });
      return session;
    },
    async commitWorkspaceIdentity(session, nextCatalog) {
      const privateSession = privateSessions.get(session);
      if (privateSession === undefined) {
        throw new Error(
          'Workspace identity session does not belong to this source provider.',
        );
      }
      const validation = validateStableIdentityCatalog(nextCatalog);
      if (
        !validation.valid ||
        validation.value.workspaceId !== session.workspaceId
      ) {
        const first = validation.valid ? undefined : validation.issues[0];
        throw new Error(
          `Refusing to persist an invalid or mismatched identity catalog${
            first === undefined ? '.' : ` at ${first.path}: ${first.message}`
          }`,
        );
      }
      await bridge.createDirectory(privateSession.paths.identityDirectory);
      const nextCatalogPath = await catalogPath(
        bridge,
        privateSession.paths,
        session.workspaceId,
      );
      await writeTextAtomically(
        bridge,
        nextCatalogPath,
        serializeIdentityCatalog(validation.value),
        temporaryTokenFactory(),
      );
      if (privateSession.registered) return;

      const nextRegistry: TauriWorkspaceRegistry = {
        schemaVersion: 1,
        workspaces: [
          ...privateSession.registry.workspaces.filter(
            ({ rootPath }) => rootPath !== privateSession.normalizedRootPath,
          ),
          {
            rootPath: privateSession.normalizedRootPath,
            workspaceId: session.workspaceId,
          },
        ],
      };
      await writeTextAtomically(
        bridge,
        privateSession.paths.registry,
        serializeRegistry(nextRegistry),
        temporaryTokenFactory(),
      );
      privateSession.registered = true;
    },
  };
}

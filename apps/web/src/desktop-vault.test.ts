import { describe, expect, it } from 'vitest';

import {
  buildObsidianDiagnosticReport,
  type BuildObsidianDiagnosticReportInput,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createStableIdentityCatalog,
  type StableIdentityCatalog,
} from '@icarus-graph-explorer/stable-identity';
import {
  RecoverableWorkspaceIdentityError,
  VaultDiscoveryTimeoutError,
  type DiscoverSelectedVaultOptions,
  type TauriSourceProvider,
  type VaultDiscoveryProgress,
  type VaultSelection,
  type VaultWatchSubscription,
  type WorkspaceIdentitySession,
} from '@icarus-graph-explorer/source-provider-tauri';
import {
  applyObsidianWorkspaceChanges,
  initializeObsidianWorkspaceEngine,
} from '@icarus-graph-explorer/workspace-engine-obsidian';
import {
  createInProcessWorkspaceProcessor,
  createWorkspaceWorkerRuntime,
  type DesktopWorkspaceProcessor,
} from '@icarus-graph-explorer/workspace-worker';

import {
  DesktopVaultOpenError,
  openSelectedDesktopVault,
  selectAndOpenDesktopVault,
  type DesktopVaultOpenProgress,
  type DesktopVaultServices,
} from './desktop-vault';

const SELECTION: VaultSelection = {
  rootPath: 'C:/private/vault',
  displayName: 'vault',
};

class FakeProvider implements TauriSourceProvider {
  selection: VaultSelection | undefined = SELECTION;
  readonly inventory = {
    markdownDocuments: [
      { path: 'A.md', source: '# A\n[[B]]\n' },
      { path: 'B.md', source: '# B\n' },
    ],
    nonMarkdownPaths: ['image.png'],
  } as const;
  catalog = createStableIdentityCatalog('desktop-workspace');
  commitError?: Error;
  commits = 0;
  discoverCalls = 0;
  identityOptions: unknown;

  async selectVaultDirectory(): Promise<VaultSelection | undefined> {
    return this.selection;
  }

  async discoverSelectedVault(
    selection: VaultSelection,
    options?: DiscoverSelectedVaultOptions,
  ) {
    void selection;
    void options;
    this.discoverCalls += 1;
    return this.inventory;
  }

  async watchSelectedVault(): Promise<VaultWatchSubscription> {
    return { stop: async () => undefined };
  }

  async reconcileSelectedVaultChanges(): Promise<never> {
    throw new Error('Live reconciliation is outside this test fake.');
  }

  async loadOrPrepareWorkspaceIdentity(
    selection: VaultSelection,
    options?: unknown,
  ): Promise<WorkspaceIdentitySession> {
    this.identityOptions = options;
    return {
      selection,
      workspaceId: this.catalog.workspaceId,
      catalog: this.catalog,
      association: 'existing',
    };
  }

  async commitWorkspaceIdentity(
    _session: WorkspaceIdentitySession,
    nextCatalog: StableIdentityCatalog,
  ): Promise<void> {
    this.commits += 1;
    if (this.commitError !== undefined) throw this.commitError;
    this.catalog = nextCatalog;
  }
}

function measuredServices(
  customize?: (
    processor: DesktopWorkspaceProcessor,
    processorIndex: number,
  ) => DesktopWorkspaceProcessor,
) {
  let time = 0;
  let initializations = 0;
  let processors = 0;
  const reportInputs: BuildObsidianDiagnosticReportInput[] = [];
  const services: DesktopVaultServices = {
    now: () => (time += 1),
    createProcessor() {
      processors += 1;
      const processor = createInProcessWorkspaceProcessor(
        createWorkspaceWorkerRuntime({
          now: () => (time += 1),
          nextCandidateId: () => `candidate-${time}`,
          initializeEngine(input) {
            initializations += 1;
            return initializeObsidianWorkspaceEngine(input);
          },
          applyChanges: applyObsidianWorkspaceChanges,
          buildReport(input) {
            reportInputs.push(input);
            return buildObsidianDiagnosticReport(input);
          },
        }),
      );
      return customize?.(processor, processors) ?? processor;
    },
  };
  return {
    services,
    initializations: () => initializations,
    processors: () => processors,
    reportInputs,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function identitySession(provider: FakeProvider): WorkspaceIdentitySession {
  return {
    selection: SELECTION,
    workspaceId: provider.catalog.workspaceId,
    catalog: provider.catalog,
    association: 'existing',
  };
}

describe('desktop vault worker orchestration', () => {
  it('leaves the application unchanged after directory-dialog cancellation', async () => {
    const provider = new FakeProvider();
    provider.selection = undefined;
    const measured = measuredServices();
    const progress: DesktopVaultOpenProgress[] = [];
    await expect(
      selectAndOpenDesktopVault(provider, measured.services, (event) =>
        progress.push(event),
      ),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(provider.commits).toBe(0);
    expect(measured.processors()).toBe(0);
    expect(progress).toEqual([]);
  });

  it('awaits worker preparation, persists, commits, and exposes no engine', async () => {
    const provider = new FakeProvider();
    const measured = measuredServices();
    const opened = await selectAndOpenDesktopVault(provider, measured.services);
    if (opened.status !== 'opened')
      throw new Error('Expected an opened vault.');

    expect(measured.initializations()).toBe(1);
    expect(provider.commits).toBe(1);
    expect(opened.report.identity).toEqual({ stability: 'stable' });
    expect(opened.report.sourceInventory).toEqual({
      markdownFileCount: 2,
      nonMarkdownFileCount: 1,
    });
    expect(measured.reportInputs).toHaveLength(1);
    expect(
      measured.reportInputs[0]?.documents.map((value) => value.structure.path),
    ).toEqual(['A.md', 'B.md']);
    expect(opened.runtime).not.toHaveProperty('engine');
    expect(opened.runtime).toMatchObject({
      workspaceId: 'desktop-workspace',
      revision: 0,
    });
    expect(opened.identityCounts).toEqual({
      entitiesReused: 0,
      entitiesNew: 4,
      referencesReused: 0,
      referencesNew: 1,
    });
  });

  it('publishes ordered startup stages with exact acquired inventory counts', async () => {
    const provider = new FakeProvider();
    const measured = measuredServices();
    const progress: DesktopVaultOpenProgress[] = [];

    const opened = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
      (event) => progress.push(event),
    );

    expect(progress.map(({ stage }) => stage)).toEqual([
      'acquiring-source',
      'acquiring-source',
      'acquiring-source',
      'building-workspace',
      'persisting-identity',
      'committing-workspace',
    ]);
    expect(progress.slice(0, 3)).toEqual([
      {
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'pending',
          identityPreparation: 'pending',
        },
      },
      {
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'complete',
          identityPreparation: 'pending',
          markdownFileCount: provider.inventory.markdownDocuments.length,
          nonMarkdownPathCount: provider.inventory.nonMarkdownPaths.length,
        },
      },
      {
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'complete',
          identityPreparation: 'complete',
          markdownFileCount: provider.inventory.markdownDocuments.length,
          nonMarkdownPathCount: provider.inventory.nonMarkdownPaths.length,
        },
      },
    ]);
    expect(progress.slice(3)).toEqual(
      Array.from({ length: 3 }, (_, index) => ({
        stage: [
          'building-workspace',
          'persisting-identity',
          'committing-workspace',
        ][index],
        markdownFileCount: provider.inventory.markdownDocuments.length,
        nonMarkdownPathCount: provider.inventory.nonMarkdownPaths.length,
      })),
    );
    opened.runtime.processor.terminate();
  });

  it('keeps acquisition concurrent and reports source completion first with real counts', async () => {
    const provider = new FakeProvider();
    const source = deferred<typeof provider.inventory>();
    const identity = deferred<WorkspaceIdentitySession>();
    let sourceStarted = false;
    let identityStarted = false;
    provider.discoverSelectedVault = () => {
      sourceStarted = true;
      return source.promise;
    };
    provider.loadOrPrepareWorkspaceIdentity = () => {
      identityStarted = true;
      return identity.promise;
    };
    const measured = measuredServices();
    const progress: DesktopVaultOpenProgress[] = [];

    const opening = openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
      (event) => progress.push(event),
    );
    expect(sourceStarted).toBe(true);
    expect(identityStarted).toBe(true);

    source.resolve(provider.inventory);
    await Promise.resolve();
    expect(progress.at(-1)).toEqual({
      stage: 'acquiring-source',
      acquisition: {
        sourceDiscovery: 'complete',
        identityPreparation: 'pending',
        markdownFileCount: 2,
        nonMarkdownPathCount: 1,
      },
    });

    identity.resolve(identitySession(provider));
    const opened = await opening;
    expect(progress[3]).toMatchObject({
      stage: 'building-workspace',
      markdownFileCount: 2,
      nonMarkdownPathCount: 1,
    });
    opened.runtime.processor.terminate();
  });

  it('threads detailed discovery progress separately from App-wide stage progress', async () => {
    const provider = new FakeProvider();
    const measured = measuredServices();
    const discoveryProgress: VaultDiscoveryProgress[] = [];
    const expected: VaultDiscoveryProgress = {
      directoriesRead: 3,
      entriesExamined: 8,
      markdownFilesRead: 4,
      nonMarkdownFilesSeen: 2,
      bytesRead: 120,
      currentRecursionDepth: 1,
      maximumRecursionDepth: 2,
      slowOperationWarningMs: 3_000,
      currentOperation: 'read-markdown',
      currentWorkspacePath: 'Folder/A.md',
      currentOperationStartedAt: 10,
    };
    provider.discoverSelectedVault = async (
      _selection: VaultSelection,
      options?: DiscoverSelectedVaultOptions,
    ) => {
      options?.onProgress?.(expected);
      return provider.inventory;
    };

    const opened = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
      undefined,
      (progress) => discoveryProgress.push(progress),
    );

    expect(discoveryProgress).toEqual([expected]);
    opened.runtime.processor.terminate();
  });

  it('reports identity completion first and waits for source before building', async () => {
    const provider = new FakeProvider();
    const source = deferred<typeof provider.inventory>();
    const identity = deferred<WorkspaceIdentitySession>();
    let sourceStarted = false;
    let identityStarted = false;
    provider.discoverSelectedVault = () => {
      sourceStarted = true;
      return source.promise;
    };
    provider.loadOrPrepareWorkspaceIdentity = () => {
      identityStarted = true;
      return identity.promise;
    };
    const measured = measuredServices();
    const progress: DesktopVaultOpenProgress[] = [];

    const opening = openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
      (event) => progress.push(event),
    );
    expect(sourceStarted).toBe(true);
    expect(identityStarted).toBe(true);

    identity.resolve(identitySession(provider));
    await Promise.resolve();
    expect(progress.at(-1)).toEqual({
      stage: 'acquiring-source',
      acquisition: {
        sourceDiscovery: 'pending',
        identityPreparation: 'complete',
      },
    });
    expect(progress.some(({ stage }) => stage === 'building-workspace')).toBe(
      false,
    );

    source.resolve(provider.inventory);
    const opened = await opening;
    expect(progress[3]).toMatchObject({
      stage: 'building-workspace',
      markdownFileCount: 2,
      nonMarkdownPathCount: 1,
    });
    opened.runtime.processor.terminate();
  });

  it('discards and terminates the candidate when identity persistence fails', async () => {
    const provider = new FakeProvider();
    provider.commitError = new Error('app-data write denied');
    let terminated = 0;
    const measured = measuredServices((processor) => ({
      ...processor,
      terminate() {
        terminated += 1;
        processor.terminate();
      },
    }));
    const opened = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
    );

    expect(measured.initializations()).toBe(1);
    expect(opened.identityPersisted).toBe(false);
    expect(opened.report.identity).toEqual({ stability: 'transient' });
    expect(opened.warning).toContain('app-data write denied');
    expect(terminated).toBe(1);
    expect(measured.reportInputs).toHaveLength(1);
  });

  it('recovers with a replacement worker if commit acknowledgement fails after persistence', async () => {
    const provider = new FakeProvider();
    let firstTerminated = false;
    const measured = measuredServices((processor, index) =>
      index === 1
        ? {
            ...processor,
            commitCandidate: async () => {
              throw new Error('worker crashed before commit acknowledgement');
            },
            terminate() {
              firstTerminated = true;
              processor.terminate();
            },
          }
        : processor,
    );

    const progress: DesktopVaultOpenProgress[] = [];
    const opened = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
      (event) => progress.push(event),
    );

    expect(opened.identityPersisted).toBe(true);
    expect(opened.report.identity).toEqual({ stability: 'stable' });
    expect(measured.processors()).toBe(2);
    expect(measured.initializations()).toBe(2);
    expect(provider.commits).toBe(2);
    expect(provider.discoverCalls).toBe(2);
    expect(firstTerminated).toBe(true);
    expect(progress.map(({ stage }) => stage)).toEqual([
      'acquiring-source',
      'acquiring-source',
      'acquiring-source',
      'building-workspace',
      'persisting-identity',
      'committing-workspace',
      'recovering-workspace',
    ]);
  });

  it('isolates a throwing progress observer from startup results and commit order', async () => {
    async function run(observe: boolean) {
      const provider = new FakeProvider();
      const operations: string[] = [];
      const measured = measuredServices((processor) => ({
        ...processor,
        async prepareInitialize(input) {
          operations.push('prepare');
          return processor.prepareInitialize(input);
        },
        async commitCandidate(candidateId) {
          operations.push('commit-candidate');
          return processor.commitCandidate(candidateId);
        },
      }));
      let observerCalls = 0;
      const opened = await openSelectedDesktopVault(
        provider,
        SELECTION,
        {},
        measured.services,
        observe
          ? () => {
              observerCalls += 1;
              throw new Error('simulated presentation failure');
            }
          : undefined,
      );
      const evidence = {
        report: opened.report,
        catalog: opened.runtime.durableIdentityCatalog,
        operations,
        timings: opened.timings,
        revision: opened.runtime.revision,
      };
      opened.runtime.processor.terminate();
      return { evidence, observerCalls };
    }

    const baseline = await run(false);
    const observed = await run(true);

    expect(observed.observerCalls).toBe(6);
    expect(observed.evidence).toEqual(baseline.evidence);
  });

  it('reuses every unchanged identity when the stable workspace opens again', async () => {
    const provider = new FakeProvider();
    const measured = measuredServices();
    const first = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
    );
    first.runtime.processor.terminate();
    const second = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
    );

    expect(first.identityCounts.entitiesNew).toBeGreaterThan(0);
    expect(second.identityCounts).toEqual({
      entitiesReused: first.report.snapshot.entities.length,
      entitiesNew: 0,
      referencesReused: first.report.snapshot.references.length,
      referencesNew: 0,
    });
  });

  it('propagates source failures without creating a worker or empty report', async () => {
    const provider = new FakeProvider();
    provider.discoverSelectedVault = async () => {
      throw new Error('Cannot read vault directory Folder.');
    };
    const measured = measuredServices();
    await expect(
      openSelectedDesktopVault(provider, SELECTION, {}, measured.services),
    ).rejects.toThrow('Cannot read vault directory Folder');
    expect(provider.commits).toBe(0);
    expect(measured.processors()).toBe(0);
  });

  it('preserves relative watchdog diagnostics without creating a worker', async () => {
    const provider = new FakeProvider();
    provider.discoverSelectedVault = async () => {
      throw new VaultDiscoveryTimeoutError(
        'read-markdown',
        'Notes/A.md',
        60_000,
        {
          directoriesRead: 83,
          entriesExamined: 1_426,
          markdownFilesRead: 612,
          nonMarkdownFilesSeen: 4,
          bytesRead: 123_456,
          currentRecursionDepth: 2,
          maximumRecursionDepth: 4,
          slowOperationWarningMs: 3_000,
          currentOperation: 'read-markdown',
          currentWorkspacePath: 'Notes/A.md',
          currentOperationStartedAt: 0,
        },
      );
    };
    const measured = measuredServices();

    await expect(
      openSelectedDesktopVault(provider, SELECTION, {}, measured.services),
    ).rejects.toThrow(
      'Vault discovery stalled for 60 s during read-markdown at Notes/A.md. Directories 83 · Entries 1426 · Markdown 612',
    );
    expect(provider.commits).toBe(0);
    expect(measured.processors()).toBe(0);
  });

  it('preserves recoverable identity metadata when identity preparation fails', async () => {
    const provider = new FakeProvider();
    provider.loadOrPrepareWorkspaceIdentity = async () => {
      throw new RecoverableWorkspaceIdentityError(
        'workspace registry is corrupt',
        'replace-corrupt-registry',
      );
    };
    const measured = measuredServices();

    try {
      await openSelectedDesktopVault(
        provider,
        SELECTION,
        {},
        measured.services,
      );
      throw new Error('Expected identity preparation to fail.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DesktopVaultOpenError);
      expect((error as DesktopVaultOpenError).recovery).toBe(
        'replace-corrupt-registry',
      );
    }
    expect(provider.commits).toBe(0);
    expect(measured.processors()).toBe(0);
  });

  it('passes confirmed reset options through the selected-vault retry', async () => {
    const provider = new FakeProvider();
    const measured = measuredServices();
    await openSelectedDesktopVault(
      provider,
      SELECTION,
      { reset: true, replaceCorruptRegistry: true },
      measured.services,
    );
    expect(provider.identityOptions).toEqual({
      reset: true,
      replaceCorruptRegistry: true,
    });
  });
});

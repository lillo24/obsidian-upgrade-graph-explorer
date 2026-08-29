import { describe, expect, it } from 'vitest';

import {
  buildObsidianDiagnosticReport,
  type BuildObsidianDiagnosticReportInput,
} from '@icarus-graph-explorer/diagnostics-obsidian';
import {
  createStableIdentityCatalog,
  type StableIdentityCatalog,
} from '@icarus-graph-explorer/stable-identity';
import type {
  TauriSourceProvider,
  VaultSelection,
  VaultWatchSubscription,
  WorkspaceIdentitySession,
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
  openSelectedDesktopVault,
  selectAndOpenDesktopVault,
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

  async discoverSelectedVault() {
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

describe('desktop vault worker orchestration', () => {
  it('leaves the application unchanged after directory-dialog cancellation', async () => {
    const provider = new FakeProvider();
    provider.selection = undefined;
    const measured = measuredServices();
    await expect(
      selectAndOpenDesktopVault(provider, measured.services),
    ).resolves.toEqual({ status: 'cancelled' });
    expect(provider.commits).toBe(0);
    expect(measured.processors()).toBe(0);
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

    const opened = await openSelectedDesktopVault(
      provider,
      SELECTION,
      {},
      measured.services,
    );

    expect(opened.identityPersisted).toBe(true);
    expect(opened.report.identity).toEqual({ stability: 'stable' });
    expect(measured.processors()).toBe(2);
    expect(measured.initializations()).toBe(2);
    expect(provider.commits).toBe(2);
    expect(provider.discoverCalls).toBe(2);
    expect(firstTerminated).toBe(true);
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

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
  WorkspaceIdentitySession,
} from '@icarus-graph-explorer/source-provider-tauri';
import {
  initializeObsidianWorkspaceEngine,
  type InitializeObsidianWorkspaceEngineInput,
} from '@icarus-graph-explorer/workspace-engine-obsidian';

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
  identityOptions: unknown;

  async selectVaultDirectory(): Promise<VaultSelection | undefined> {
    return this.selection;
  }

  async discoverSelectedVault() {
    return this.inventory;
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

function measuredServices() {
  let time = 0;
  let initializations = 0;
  const reportInputs: BuildObsidianDiagnosticReportInput[] = [];
  const services: DesktopVaultServices = {
    now: () => (time += 1),
    initializeEngine(input: InitializeObsidianWorkspaceEngineInput) {
      initializations += 1;
      return initializeObsidianWorkspaceEngine(input);
    },
    buildReport(input: BuildObsidianDiagnosticReportInput) {
      reportInputs.push(input);
      return buildObsidianDiagnosticReport(input);
    },
  };
  return {
    services,
    initializations: () => initializations,
    reportInputs,
  };
}

describe('desktop vault application orchestration', () => {
  it('leaves the application unchanged after directory-dialog cancellation', async () => {
    const provider = new FakeProvider();
    provider.selection = undefined;
    await expect(selectAndOpenDesktopVault(provider)).resolves.toEqual({
      status: 'cancelled',
    });
    expect(provider.commits).toBe(0);
  });

  it('initializes KG10 once, reuses its parsed documents, and marks a persisted report stable', async () => {
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
    expect(measured.reportInputs[0]?.documents).toEqual(
      opened.runtime.engine.parsedDocuments(),
    );
    expect(opened.runtime.engine.parsedDocumentCount).toBe(2);
    expect(opened.identityCounts).toEqual({
      entitiesReused: 0,
      entitiesNew: 4,
      referencesReused: 0,
      referencesNew: 1,
    });
  });

  it('downgrades truthfully to transient when identity persistence fails', async () => {
    const provider = new FakeProvider();
    provider.commitError = new Error('app-data write denied');
    const measured = measuredServices();
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
    expect(measured.reportInputs).toHaveLength(2);
  });

  it('reuses every unchanged identity when the same stable workspace is opened again', async () => {
    const provider = new FakeProvider();
    const first = await openSelectedDesktopVault(provider, SELECTION);
    const second = await openSelectedDesktopVault(provider, SELECTION);

    expect(first.identityCounts.entitiesNew).toBeGreaterThan(0);
    expect(second.identityCounts).toEqual({
      entitiesReused: first.report.snapshot.entities.length,
      entitiesNew: 0,
      referencesReused: first.report.snapshot.references.length,
      referencesNew: 0,
    });
    expect(second.report.snapshot.workspace.id).toBe(
      first.report.snapshot.workspace.id,
    );
  });

  it('propagates source failures instead of producing a success-shaped empty report', async () => {
    const provider = new FakeProvider();
    provider.discoverSelectedVault = async () => {
      throw new Error('Cannot read vault directory Folder.');
    };
    await expect(openSelectedDesktopVault(provider, SELECTION)).rejects.toThrow(
      'Cannot read vault directory Folder',
    );
    expect(provider.commits).toBe(0);
  });

  it('passes confirmed reset options through the selected-vault retry', async () => {
    const provider = new FakeProvider();
    await openSelectedDesktopVault(provider, SELECTION, {
      reset: true,
      replaceCorruptRegistry: true,
    });
    expect(provider.identityOptions).toEqual({
      reset: true,
      replaceCorruptRegistry: true,
    });
  });
});

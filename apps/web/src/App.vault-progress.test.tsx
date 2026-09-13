// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  TauriSourceProvider,
  VaultDiscoveryProgressListener,
  VaultSelection,
} from '@icarus-graph-explorer/source-provider-tauri';
import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';

const mocks = vi.hoisted(() => ({
  graphRenderCount: 0,
  openLiveDesktopVault: vi.fn(),
  useSample: undefined as (() => void) | undefined,
}));

vi.mock('./desktop-live-vault', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./desktop-live-vault')>()),
  openLiveDesktopVault: mocks.openLiveDesktopVault,
}));

vi.mock('./components/GraphExplorer', () => ({
  GraphExplorer: ({
    settingsContent,
    snapshot,
  }: {
    readonly settingsContent: React.ReactNode;
    readonly snapshot: { readonly entities: readonly unknown[] };
  }) => {
    mocks.graphRenderCount += 1;
    const settings = settingsContent as {
      readonly props: {
        readonly children: readonly [
          { readonly props: { readonly onUseSample: () => void } },
          unknown,
        ];
      };
    };
    mocks.useSample = settings.props.children[0].props.onUseSample;
    return (
      <div
        data-entity-count={snapshot.entities.length}
        data-testid="current-graph"
      >
        {settingsContent}
      </div>
    );
  },
}));

import { App } from './App';
import type {
  DesktopVaultOpenProgressListener,
  OpenedDesktopVault,
} from './desktop-vault';
import sampleReportJson from './sample-report.json';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SELECTION: VaultSelection = {
  rootPath: 'C:/private/vault',
  displayName: 'vault',
};

const sampleValidation = validateObsidianDiagnosticReport(sampleReportJson);
if (!sampleValidation.valid) throw new Error('Expected a valid sample report.');
const SAMPLE_REPORT = sampleValidation.value;

function openedVault(): OpenedDesktopVault {
  return {
    status: 'opened',
    displayName: 'vault',
    report: SAMPLE_REPORT,
    identityPersisted: true,
    timings: {
      sourceAcquisitionMs: 0,
      workspaceInitializationMs: 0,
      diagnosticConstructionMs: 0,
      workerComputeMs: 0,
      workerRoundTripMs: 0,
      mainThreadHighGapMs: 0,
      identityPersistenceMs: 0,
    },
    identityCounts: {
      entitiesReused: 0,
      entitiesNew: 0,
      referencesReused: 0,
      referencesNew: 0,
    },
    runtime: {} as OpenedDesktopVault['runtime'],
  };
}

function provider(selected: VaultSelection | undefined): TauriSourceProvider {
  return {
    selectVaultDirectory: vi.fn().mockResolvedValue(selected),
  } as unknown as TauriSourceProvider;
}

function button(container: HTMLElement, text: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`Missing ${text} button.`);
  }
  return match;
}

describe('App vault progress lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(async () => {
    await Promise.all([
      import('./desktop-vault'),
      import('./desktop-live-vault'),
    ]);
  });

  beforeEach(async () => {
    mocks.graphRenderCount = 0;
    mocks.openLiveDesktopVault.mockReset();
    mocks.useSample = undefined;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    vi.useRealTimers();
    vi.restoreAllMocks();
    container.remove();
  });

  it('clears progress without an error or graph replacement when selection is cancelled', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await act(() =>
      root.render(<App desktopSourceProvider={provider(undefined)} />),
    );
    const graph = container.querySelector('[data-testid="current-graph"]');
    const entityCount = graph?.getAttribute('data-entity-count');

    await act(async () => {
      button(container, 'Open Vault').click();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(graph?.getAttribute('data-entity-count')).toBe(entityCount);
    expect(mocks.openLiveDesktopVault).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts elapsed timing only after the folder selection resolves', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let resolveSelection!: (selection: VaultSelection) => void;
    const selection = new Promise<VaultSelection>((resolve) => {
      resolveSelection = resolve;
    });
    const selectingProvider = {
      selectVaultDirectory: vi.fn(() => selection),
    } as unknown as TauriSourceProvider;
    mocks.openLiveDesktopVault.mockImplementation(
      () => new Promise(() => undefined),
    );
    await act(() =>
      root.render(<App desktopSourceProvider={selectingProvider} />),
    );

    await act(async () => {
      button(container, 'Open Vault').click();
      await Promise.resolve();
    });
    expect(selectingProvider.selectVaultDirectory).toHaveBeenCalledOnce();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    resolveSelection(SELECTION);
    await act(async () => {
      await vi.waitFor(
        () => expect(mocks.openLiveDesktopVault).toHaveBeenCalledOnce(),
        { timeout: 5_000 },
      );
    });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('isolates elapsed and discovery updates from GraphExplorer and clears progress after failure', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let monotonicNow = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow);
    let progressListener: DesktopVaultOpenProgressListener | undefined;
    let discoveryProgressListener: VaultDiscoveryProgressListener | undefined;
    let rejectOpen!: (error: Error) => void;
    mocks.openLiveDesktopVault.mockImplementation(
      (...args: readonly unknown[]) => {
        progressListener = args[4] as DesktopVaultOpenProgressListener;
        discoveryProgressListener = args[5] as VaultDiscoveryProgressListener;
        return new Promise((_resolve, reject) => {
          rejectOpen = reject;
        });
      },
    );
    await act(() =>
      root.render(<App desktopSourceProvider={provider(SELECTION)} />),
    );
    const graph = container.querySelector('[data-testid="current-graph"]');
    const entityCount = graph?.getAttribute('data-entity-count');

    await act(async () => {
      button(container, 'Open Vault').click();
      await vi.waitFor(
        () => expect(mocks.openLiveDesktopVault).toHaveBeenCalledOnce(),
        { timeout: 5_000 },
      );
    });
    const rendersBeforeDiscoveryProgress = mocks.graphRenderCount;
    await act(() => {
      for (let index = 1; index <= 2_000; index += 1) {
        discoveryProgressListener?.({
          directoriesRead: 83,
          entriesExamined: index,
          markdownFilesRead: Math.floor(index / 2),
          nonMarkdownFilesSeen: Math.floor(index / 3),
          bytesRead: index * 10,
          currentRecursionDepth: 2,
          maximumRecursionDepth: 4,
          slowOperationWarningMs: 3_000,
          currentOperation: 'read-markdown',
          currentWorkspacePath: `Folder/Note-${index}.md`,
          currentOperationStartedAt: 0,
        });
      }
    });
    expect(mocks.graphRenderCount).toBe(rendersBeforeDiscoveryProgress);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(container.textContent).toContain(
      'Directories 83 · Entries 2,000 · Markdown 1,000 · Non-Markdown 666 · Depth 2 (max 4)',
    );
    expect(mocks.graphRenderCount).toBe(rendersBeforeDiscoveryProgress);
    monotonicNow = 3_200;
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    expect(container.textContent).toContain(
      'Still waiting for a Markdown file read…',
    );
    expect(container.textContent).toContain(
      'Current item: Folder/Note-2000.md · Waiting on current operation: 3 s',
    );
    expect(mocks.graphRenderCount).toBe(rendersBeforeDiscoveryProgress);

    await act(() =>
      progressListener?.({
        stage: 'building-workspace',
        markdownFileCount: 1_203,
        nonMarkdownPathCount: 19,
      }),
    );

    const progressbar = container.querySelector('[role="progressbar"]');
    expect(progressbar?.getAttribute('aria-label')).toBe('Opening vault');
    expect(progressbar?.hasAttribute('aria-valuenow')).toBe(false);
    expect(container.textContent).toContain(
      'Building workspace… 1,203 Markdown files',
    );
    expect(graph?.getAttribute('data-entity-count')).toBe(entityCount);
    expect(vi.getTimerCount()).toBe(1);

    const rendersBeforeElapsedTick = mocks.graphRenderCount;
    monotonicNow = 67_000;
    await act(() => vi.advanceTimersByTimeAsync(1_000));

    expect(container.textContent).toContain('Elapsed 01:07');
    expect(mocks.graphRenderCount).toBe(rendersBeforeElapsedTick);

    await act(async () => {
      rejectOpen(new Error('simulated startup failure'));
      await Promise.resolve();
    });

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'simulated startup failure',
    );
    expect(graph?.getAttribute('data-entity-count')).toBe(entityCount);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the local timer on success and rejects both late acquisition completions after a source switch', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let monotonicNow = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => monotonicNow);
    mocks.openLiveDesktopVault.mockResolvedValueOnce({ opened: openedVault() });
    await act(() =>
      root.render(<App desktopSourceProvider={provider(SELECTION)} />),
    );

    await act(async () => {
      button(container, 'Open Vault').click();
      await vi.waitFor(
        () => expect(mocks.openLiveDesktopVault).toHaveBeenCalledTimes(1),
        { timeout: 5_000 },
      );
    });
    await vi.waitFor(() =>
      expect(container.querySelector('[role="progressbar"]')).toBeNull(),
    );
    expect(vi.getTimerCount()).toBe(0);

    let staleProgress: DesktopVaultOpenProgressListener | undefined;
    mocks.openLiveDesktopVault.mockImplementationOnce(
      (...args: readonly unknown[]) => {
        staleProgress = args[4] as DesktopVaultOpenProgressListener;
        return new Promise(() => undefined);
      },
    );
    monotonicNow = 1_000;
    await act(async () => {
      button(container, 'Open Vault').click();
      await vi.waitFor(
        () => expect(mocks.openLiveDesktopVault).toHaveBeenCalledTimes(2),
        { timeout: 5_000 },
      );
    });
    expect(vi.getTimerCount()).toBe(1);

    await act(() => mocks.useSample?.());
    expect(vi.getTimerCount()).toBe(0);

    await act(() => {
      staleProgress?.({
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'complete',
          identityPreparation: 'pending',
          markdownFileCount: 2,
          nonMarkdownPathCount: 1,
        },
      });
      staleProgress?.({
        stage: 'acquiring-source',
        acquisition: {
          sourceDiscovery: 'pending',
          identityPreparation: 'complete',
        },
      });
    });

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.textContent).not.toContain('Loading workspace identity…');
    expect(container.textContent).not.toContain('Reading vault files…');
  });

  it('clears the notice timer when App unmounts during an open', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(performance, 'now').mockReturnValue(0);
    mocks.openLiveDesktopVault.mockImplementation(
      () => new Promise(() => undefined),
    );
    await act(() =>
      root.render(<App desktopSourceProvider={provider(SELECTION)} />),
    );

    await act(async () => {
      button(container, 'Open Vault').click();
      await vi.waitFor(
        () => expect(mocks.openLiveDesktopVault).toHaveBeenCalledOnce(),
        { timeout: 5_000 },
      );
    });
    expect(vi.getTimerCount()).toBe(1);

    await act(() => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    root = createRoot(container);
  });
});

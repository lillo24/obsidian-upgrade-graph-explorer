// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  TauriSourceProvider,
  VaultSelection,
} from '@icarus-graph-explorer/source-provider-tauri';

const mocks = vi.hoisted(() => ({
  openLiveDesktopVault: vi.fn(),
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
  }) => (
    <div
      data-entity-count={snapshot.entities.length}
      data-testid="current-graph"
    >
      {settingsContent}
    </div>
  ),
}));

import { App } from './App';
import type { DesktopVaultOpenProgressListener } from './desktop-vault';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SELECTION: VaultSelection = {
  rootPath: 'C:/private/vault',
  displayName: 'vault',
};

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

  beforeEach(async () => {
    mocks.openLiveDesktopVault.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
  });

  it('clears progress without an error or graph replacement when selection is cancelled', async () => {
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
  });

  it('shows typed progress over the current graph and clears it after failure', async () => {
    let progressListener: DesktopVaultOpenProgressListener | undefined;
    let rejectOpen!: (error: Error) => void;
    mocks.openLiveDesktopVault.mockImplementation(
      (...args: readonly unknown[]) => {
        progressListener = args[4] as DesktopVaultOpenProgressListener;
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

    await act(async () => {
      rejectOpen(new Error('simulated startup failure'));
      await Promise.resolve();
    });

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'simulated startup failure',
    );
    expect(graph?.getAttribute('data-entity-count')).toBe(entityCount);
  });
});

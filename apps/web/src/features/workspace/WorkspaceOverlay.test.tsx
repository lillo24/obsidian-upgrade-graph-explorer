// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureArgumentLibrarySnapshot,
  createEmptyArgumentLibrary,
  sameSnapshot,
  type ArgumentLibrary,
  type ArgumentLibraryStore,
} from '@icarus-graph-explorer/argument-workspace';
import { MemoryReviewHistoryStore } from '@icarus-graph-explorer/review-workspace';
import { ScriptedAgentProvider } from '@icarus-graph-explorer/ai-review';
import type { ReviewSourceProvider } from '@icarus-graph-explorer/review-source-tauri';

import { AiReviewController } from '../ai-review/controller';
import { ArgumentWorkspaceSession } from '../arguments/session';
import { WorkspaceOverlay, type WorkspaceArea } from './WorkspaceOverlay';

class ArgumentStore implements ArgumentLibraryStore {
  snapshot = captureArgumentLibrarySnapshot(
    createEmptyArgumentLibrary({
      createId: (kind) => `workspace-${kind}`,
      now: () => '2026-09-13T08:00:00.000Z',
    }),
  );

  async load() {
    return { status: 'loaded' as const, snapshot: this.snapshot };
  }

  async save(
    library: ArgumentLibrary,
    expected: Parameters<ArgumentLibraryStore['save']>[1],
  ) {
    if (
      expected === 'missing' ||
      !sameSnapshot(expected, this.snapshot.descriptor)
    ) {
      return { status: 'conflict' as const, message: 'changed' };
    }
    this.snapshot = captureArgumentLibrarySnapshot(library);
    return { status: 'saved' as const, snapshot: this.snapshot };
  }
}

const unsupportedSource: ReviewSourceProvider = {
  isSupported: () => false,
  async openAuthorizedSession() {
    throw new Error('unsupported');
  },
};

function setValue(control: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set;
  if (setter === undefined) throw new Error('Missing input value setter.');
  setter.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('shared local workspace overlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(
      function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    );
    vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute('open');
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('shows one explicit OpenAI model and cloud-upload disclosure', async () => {
    const controller = new AiReviewController({
      sourceProvider: unsupportedSource,
      historyStore: new MemoryReviewHistoryStore(),
      agentProvider: new ScriptedAgentProvider({}),
      defaultModels: {
        analysis: { provider: 'openai-agents', model: 'gpt-6-astra' },
        integrator: { provider: 'openai-agents', model: 'gpt-6-astra' },
        postCheck: { provider: 'openai-agents', model: 'gpt-6-astra' },
      },
    });
    await controller.open();
    const argumentSession = new ArgumentWorkspaceSession(new ArgumentStore());
    await act(async () => {
      root.render(
        <WorkspaceOverlay
          area="review"
          argumentSession={argumentSession}
          controller={controller}
          onAreaChange={() => undefined}
          onRequestClose={() => undefined}
          open
        />,
      );
    });
    expect(
      container.querySelectorAll('input[name="openai-review-model"]'),
    ).toHaveLength(1);
    expect(
      container.querySelector<HTMLInputElement>(
        'input[name="openai-review-model"]',
      )?.value,
    ).toBe('gpt-6-astra');
    expect(container.textContent).toContain(
      'does not upload the rest of your vault',
    );
    expect(container.textContent).not.toContain('API key');
  });

  it('keeps one modal, routes dirty Arguments transitions, and restores the launcher', async () => {
    const controller = new AiReviewController({
      sourceProvider: unsupportedSource,
      historyStore: new MemoryReviewHistoryStore(),
    });
    await controller.open();
    const argumentStore = new ArgumentStore();
    const argumentSession = new ArgumentWorkspaceSession(argumentStore);

    function Harness() {
      const [area, setArea] = useState<WorkspaceArea>('arguments');
      const [open, setOpen] = useState(true);
      const [launcher, setLauncher] = useState<HTMLElement>();
      return (
        <>
          <button
            id="test-launcher"
            onClick={(event) => {
              setLauncher(event.currentTarget);
              setOpen(true);
            }}
            type="button"
          >
            Open Workspace
          </button>
          <WorkspaceOverlay
            area={area}
            argumentSession={argumentSession}
            controller={controller}
            onAreaChange={setArea}
            onRequestClose={() => setOpen(false)}
            open={open}
            {...(launcher === undefined ? {} : { restoreFocus: launcher })}
          />
        </>
      );
    }

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.querySelectorAll('dialog')).toHaveLength(1);
    const buttons = () => [
      ...container.querySelectorAll<HTMLButtonElement>('button'),
    ];
    const button = (name: string) =>
      buttons().find((candidate) => candidate.textContent?.trim() === name)!;

    await act(() => button('New Topic').click());
    const title = [
      ...container.querySelectorAll<HTMLInputElement>('input'),
    ].find((candidate) =>
      candidate.parentElement?.textContent?.includes('Title'),
    )!;
    await act(() => setValue(title, 'Unsaved synthetic topic'));
    expect(container.textContent).toContain('Unsaved draft');

    await act(() => button('AI Review').click());
    expect(container.textContent).toContain(
      'Switch to AI Review with unsaved Argument changes?',
    );
    expect(
      container
        .querySelector('#arguments-workspace-area')
        ?.hasAttribute('hidden'),
    ).toBe(false);
    await act(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(container.textContent).not.toContain(
      'Switch to AI Review with unsaved Argument changes?',
    );
    expect(title.value).toBe('Unsaved synthetic topic');

    await act(() => button('AI Review').click());
    await act(() => button('Discard').click());
    expect(
      container.querySelector('#review-workspace-area')?.hasAttribute('hidden'),
    ).toBe(false);
    expect(container.textContent).toContain('Live analysis is not connected');
    expect(container.textContent).toContain('Browser session only');

    const launcher =
      container.querySelector<HTMLButtonElement>('#test-launcher')!;
    await act(() => launcher.click());
    await act(() => button('Close').click());
    await act(async () => Promise.resolve());
    expect(document.activeElement).toBe(launcher);
  });
});

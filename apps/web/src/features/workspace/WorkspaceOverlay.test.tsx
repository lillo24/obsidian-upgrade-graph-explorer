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
import {
  OPENAI_DEFAULT_MODEL,
  createOpenAiAgentsProvider,
} from '../ai-review/openai-agents-provider';
import { OpenAiSessionCredentials } from '../ai-review/openai-session-credentials';
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

const SENTINEL_KEY = 'sk-test-DO-NOT-PERSIST-123';

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

  it('keeps injected controllers generic and supports independent stage models', async () => {
    const controller = new AiReviewController({
      sourceProvider: unsupportedSource,
      historyStore: new MemoryReviewHistoryStore(),
      agentProvider: new ScriptedAgentProvider({}),
      defaultModels: {
        analysis: { provider: 'custom-provider', model: 'analysis-model' },
        integrator: { provider: 'custom-provider', model: 'integrator-model' },
        postCheck: { provider: 'custom-provider', model: 'post-model' },
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
    expect(container.querySelectorAll('input[name$="-model"]')).toHaveLength(3);
    expect(
      [
        ...container.querySelectorAll<HTMLInputElement>(
          'input[name$="-model"]',
        ),
      ].map(({ value }) => value),
    ).toEqual(['analysis-model', 'integrator-model', 'post-model']);
    expect(container.textContent).toContain(
      'does not upload the rest of your vault',
    );
    expect(container.textContent).not.toContain('API key');
  });

  it('adopts and clears a session-only OpenAI key without leaving it in DOM or storage', async () => {
    const credentials = new OpenAiSessionCredentials();
    const openAi = createOpenAiAgentsProvider({ credentials });
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const consoleCalls = vi
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const controller = new AiReviewController({
      sourceProvider: unsupportedSource,
      historyStore: new MemoryReviewHistoryStore(),
      agentProvider: new ScriptedAgentProvider({}),
      agentProviderAvailability: openAi.getAvailability,
      agentProviderAvailabilitySubscribe: openAi.subscribeAvailability,
      defaultModels: openAi.defaultModels,
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
          openAiCredentials={credentials}
        />,
      );
    });
    const keyInput = container.querySelector<HTMLInputElement>(
      'input[name="openai-session-api-key"]',
    )!;
    expect(keyInput.type).toBe('password');
    expect(controller.snapshot().modelAvailable).toBe(false);
    setValue(keyInput, SENTINEL_KEY);
    await act(async () => {
      keyInput.form!.dispatchEvent(
        new SubmitEvent('submit', { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });

    expect(keyInput.value).toBe('');
    expect(container.innerHTML).not.toContain(SENTINEL_KEY);
    expect(container.textContent).toContain(
      'API key loaded for this app session',
    );
    expect(controller.snapshot().modelAvailable).toBe(true);
    expect(
      [
        ...container.querySelectorAll<HTMLInputElement>(
          'input[name^="openai-"][name$="-model"]',
        ),
      ].map(({ value }) => value),
    ).toEqual([
      OPENAI_DEFAULT_MODEL,
      OPENAI_DEFAULT_MODEL,
      OPENAI_DEFAULT_MODEL,
    ]);
    expect(storageWrite).not.toHaveBeenCalled();
    expect(consoleCalls).not.toHaveBeenCalled();

    await act(async () => {
      const clear = [...container.querySelectorAll('button')].find(
        ({ textContent }) => textContent === 'Clear',
      );
      clear!.click();
      await Promise.resolve();
    });
    expect(credentials.snapshot().configured).toBe(false);
    expect(controller.snapshot().modelAvailable).toBe(false);
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
            argumentNotice={<p>Compiler tunnel warning</p>}
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
    expect(container.textContent).toContain('Compiler tunnel warning');
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
    expect(container.textContent).not.toContain('Compiler tunnel warning');
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

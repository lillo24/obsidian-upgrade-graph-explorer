// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  attachAnsweringAxiom,
  captureArgumentLibrarySnapshot,
  createAxiom,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createTopic,
  sameSnapshot,
  setTopicMembership,
  updateCounterArgumentResponse,
  type ArgumentLibrary,
  type ArgumentLibraryStore,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';

import { ArgumentsWorkspace } from './ArgumentsWorkspace';
import { ArgumentWorkspaceSession } from './session';

function runtime(): ArgumentRuntime {
  let id = 0;
  let second = 0;
  return {
    createId: (kind) => `ui-${kind}-${++id}`,
    now: () => `2026-03-01T00:00:${String(second++).padStart(2, '0')}.000Z`,
  };
}

function fixture(): ArgumentLibrary {
  const clock = runtime();
  let library = createEmptyArgumentLibrary(clock, 'ui-library');
  library = createTopic(
    library,
    {
      id: 'T-UI',
      title: 'Neutral comparison',
      summary: 'How a comparison depends on common units.',
    },
    clock,
  );
  library = createAxiom(
    library,
    {
      id: 'AX-UI',
      title: 'Compatible units',
      statement: 'Direct numerical comparison requires compatible units.',
      sourceReferences: [
        {
          id: 'SRC-UI',
          path: 'Theory/Neutral.md',
          heading: 'Units',
          label: 'Neutral source locator',
          originalWikilink: '[[Neutral#Units]]',
          role: 'basis',
        },
      ],
    },
    clock,
  );
  library = createCounterArgument(
    library,
    {
      id: 'CA-UI',
      title: 'Numeric mismatch',
      observation: '3.14... differs from 180.',
      challengedClaim: 'Different numerals alone establish a contradiction.',
      target: { kind: 'topic-claim', topicId: 'T-UI' },
    },
    clock,
  );
  library = attachAnsweringAxiom(library, 'CA-UI', 'AX-UI', clock);
  library = updateCounterArgumentResponse(
    library,
    'CA-UI',
    {
      explanation: 'Convert the units before drawing the conclusion.',
      outcome: 'inapplicable-under-stated-scope',
      boundary: 'The observations remain individually meaningful.',
    },
    clock,
  );
  library = setTopicMembership(library, 'T-UI', 'axiom', 'AX-UI', true, clock);
  return setTopicMembership(
    library,
    'T-UI',
    'counter-argument',
    'CA-UI',
    true,
    clock,
  );
}

class MemoryStore implements ArgumentLibraryStore {
  snapshot = captureArgumentLibrarySnapshot(fixture());
  writes = 0;

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
    this.writes += 1;
    this.snapshot = captureArgumentLibrarySnapshot(library);
    return { status: 'saved' as const, snapshot: this.snapshot };
  }
}

function setValue(
  control: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  const prototype =
    control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (setter === undefined) throw new Error('Missing native value setter.');
  setter.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('standalone Arguments workspace', () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: MemoryStore;
  let session: ArgumentWorkspaceSession;
  let close: Mock<() => void>;

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
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn(),
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    store = new MemoryStore();
    session = new ArgumentWorkspaceSession(store, runtime());
    close = vi.fn();
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount() {
    await act(async () => {
      root.render(
        <ArgumentsWorkspace
          onRequestClose={() => close()}
          open
          session={session}
        />,
      );
      await session.open();
      await Promise.resolve();
    });
  }

  function button(name: string): HTMLButtonElement {
    const result = [
      ...container.querySelectorAll<HTMLButtonElement>('button'),
    ].find(
      (candidate) =>
        candidate.textContent?.trim() === name ||
        candidate.getAttribute('aria-label') === name,
    );
    if (result === undefined) throw new Error(`Missing button ${name}`);
    return result;
  }

  async function click(name: string) {
    await act(async () => {
      button(name).click();
      await Promise.resolve();
    });
  }

  it('reads a complete exchange, navigates its shared Axiom, searches, and previews bounded context', async () => {
    await mount();
    await click('Numeric mismatch');

    const text = container.textContent ?? '';
    expect(text.indexOf('Observation / example / argument')).toBeLessThan(
      text.indexOf('What this is intended to challenge'),
    );
    expect(text.indexOf('What this is intended to challenge')).toBeLessThan(
      text.indexOf('Answered using'),
    );
    expect(text.indexOf('Answered using')).toBeLessThan(
      text.indexOf('Recorded response — why it applies'),
    );
    expect(text).toContain('3.14... differs from 180.');
    expect(text).toContain('Convert the units before drawing the conclusion.');
    expect(text).toContain('inapplicable-under-stated-scope');

    await click('Compatible units');
    expect(container.textContent).toContain('[[Neutral#Units]]');
    expect(container.textContent).toContain(
      'has not been read or currently verified',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a[href^="http"]')).toBeNull();

    const search = container.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )!;
    await act(() => setValue(search, '3.14...'));
    await act(async () => Promise.resolve());
    expect(
      container.querySelector('.arguments-search-results')?.textContent,
    ).toContain('Numeric mismatch');

    await click('Numeric mismatch');
    await click('Preview context');
    const preview = container.querySelector<HTMLTextAreaElement>(
      '[aria-label="Argument context preview"]',
    )!;
    expect(preview.value).toContain('Linked theory source text not read.');
    expect(preview.value).toContain(
      'Convert the units before drawing the conclusion.',
    );
    expect(preview.value).toContain('AX-UI@');
    expect(preview.value).toContain('Consultation receipt');
  });

  it('keeps dirty drafts through nested Escape and performs one confirmed Save', async () => {
    await mount();
    await click('Numeric mismatch');
    await click('Edit');
    const observation = [
      ...container.querySelectorAll<HTMLTextAreaElement>('textarea'),
    ].find((control) =>
      control.parentElement?.textContent?.includes(
        'Observation / example / argument',
      ),
    )!;
    await act(() => setValue(observation, 'A safely edited neutral example.'));
    expect(container.textContent).toContain('Unsaved draft');

    await click('Close');
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(container.textContent).toContain(
      'Close Arguments with unsaved changes?',
    );
    await act(() =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      ),
    );
    expect(container.textContent).not.toContain(
      'Close Arguments with unsaved changes?',
    );
    expect(close).not.toHaveBeenCalled();

    await click('Save');
    expect(store.writes).toBe(1);
    expect(store.snapshot.library.counterArguments[0]!.observation).toBe(
      'A safely edited neutral example.',
    );
    expect(container.textContent).not.toContain('Unsaved draft');
    await click('Close');
    expect(close).toHaveBeenCalledOnce();
  });
});

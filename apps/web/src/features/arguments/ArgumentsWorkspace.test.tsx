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
  createArgument,
  createCounterArgument,
  createEmptyArgumentLibrary,
  createTopic,
  promoteArgumentToCurrent,
  sameSnapshot,
  setTopicMembership,
  updateCounterArgumentResponse,
  type ArgumentLibrary,
  type ArgumentLibraryStore,
  type ArgumentRuntime,
} from '@icarus-graph-explorer/argument-workspace';

import { ArgumentsWorkspace } from './ArgumentsWorkspace';
import { ArgumentSourceAccessSession } from './source-capture';
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
    createArgument(
      createArgument(
        library,
        {
          id: 'AR-UI',
          title: 'Compatibility reasoning',
          premises: [
            {
              id: 'P-UI',
              kind: 'axiom',
              axiomId: 'AX-UI',
              reliedOnRevision: library.axioms[0]!.revision,
            },
          ],
          reasoning: 'Comparable units are required before comparison.',
          conclusion: 'Convert units before concluding a contradiction.',
          reviewState: 'accepted',
        },
        clock,
      ),
      {
        id: 'AR-UI-NEXT',
        title: 'Replacement reasoning',
        premises: [],
        conclusion: 'A replacement Current conclusion.',
        reviewState: 'accepted',
      },
      clock,
    ),
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
  library = setTopicMembership(
    library,
    'T-UI',
    'argument',
    'AR-UI',
    true,
    clock,
  );
  library = setTopicMembership(
    library,
    'T-UI',
    'argument',
    'AR-UI-NEXT',
    true,
    clock,
  );
  library = promoteArgumentToCurrent(library, 'T-UI', 'AR-UI', clock);
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

  async function mount(sourceAccess?: ArgumentSourceAccessSession) {
    await act(async () => {
      root.render(
        <ArgumentsWorkspace
          onRequestClose={() => close()}
          open
          session={session}
          {...(sourceAccess === undefined ? {} : { sourceAccess })}
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

  function textarea(name: string): HTMLTextAreaElement {
    const result = [
      ...container.querySelectorAll<HTMLTextAreaElement>('textarea'),
    ].find((candidate) =>
      candidate.closest('label')?.textContent?.includes(name),
    );
    if (result === undefined) throw new Error(`Missing textarea ${name}`);
    return result;
  }

  async function typeCharacters(control: HTMLTextAreaElement, value: string) {
    for (const character of value) {
      await act(async () => {
        setValue(control, control.value + character);
        await Promise.resolve();
      });
    }
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

  it('shows Current reasoning and promotes an accepted member explicitly', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    await mount();
    expect(container.textContent).toContain('Current reasoning');
    expect(container.textContent).toContain('Compatibility reasoning');

    await click('Replacement reasoning');
    expect(container.textContent).toContain(
      'A replacement Current conclusion.',
    );
    await click('Promote to Current');

    expect(store.snapshot.library.topics[0]!.currentArgumentId).toBe(
      'AR-UI-NEXT',
    );
    expect(
      store.snapshot.library.arguments.find(({ id }) => id === 'AR-UI-NEXT'),
    ).toMatchObject({ supersedesArgumentId: 'AR-UI' });
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

  it('preserves retrieval text character-by-character and normalizes only on save', async () => {
    await mount();
    await click('Compatible units');
    await click('Edit');
    const aliases = textarea('Aliases');
    await typeCharacters(aliases, 'two words ');
    expect(aliases.value).toBe('two words ');
    await typeCharacters(aliases, '\n');
    expect(aliases.value).toBe('two words \n');
    await typeCharacters(aliases, 'alpha');

    const phrases = textarea('Exact retrieval phrases');
    await typeCharacters(phrases, 'phrase with spaces\nnext phrase');
    expect(phrases.value).toBe('phrase with spaces\nnext phrase');
    expect(store.writes).toBe(0);

    await click('Save');
    expect(store.writes).toBe(1);
    expect(store.snapshot.library.axioms[0]!.retrieval).toEqual({
      aliases: ['alpha', 'two words'],
      keywords: [],
      phrases: ['next phrase', 'phrase with spaces'],
    });
  });

  it('binds an injected source host, previews exact text, and records a baseline only after confirmation', async () => {
    const sourceAccess = new ArgumentSourceAccessSession();
    const publish = (
      source: string,
      runtimeRevision: number,
      sourceSessionId = 'source-session-one',
    ) =>
      sourceAccess.publishCommittedSource({
        sourceSessionId,
        sourceSpaceId: 'source-space-ui',
        displayName: 'Neutral test vault',
        acquisition: 'captured',
        acquisitionState: 'ready',
        runtimeRevision,
        observedAt: `2026-06-01T00:00:0${runtimeRevision}.000Z`,
        inventory: {
          markdownDocuments: [{ path: 'Theory/Neutral.md', source }],
          nonMarkdownPaths: [],
        },
      });
    publish('# Neutral\n## Units\nExact S1.\n', 1);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    await mount(sourceAccess);
    await click('Compatible units');
    await click('Use selected vault for theory sources');
    await click('Read source');

    expect(container.textContent).toContain('Exact S1.');
    expect(container.textContent).toContain('unknown / no comparable baseline');
    expect(store.writes).toBe(0);
    await click('Record this source version');
    expect(store.writes).toBe(1);
    const recorded = store.snapshot.library.axioms[0]!.sourceReferences[0]!;
    expect(recorded.sourceSpaceHint).toBe('source-space-ui');
    expect(recorded.recordedVersion).toMatchObject({
      fingerprintScope: 'file',
    });
    expect(store.snapshot.library.counterArguments[0]!.response.outcome).toBe(
      'inapplicable-under-stated-scope',
    );

    await act(async () => {
      publish('# Neutral\n## Units\nExact S2.\n', 2);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Retained capture');
    await click('Refresh source');
    expect(container.textContent).toContain('Exact S2.');
    expect(container.textContent).toContain(
      'changed — review warning only; no verdict changed',
    );
    expect(store.writes).toBe(1);

    await click('Numeric mismatch');
    await click('Preview context');
    expect(container.textContent).toContain('Registered theory sources (1)');
    await click('Include linked theory sources');
    const packetPreview = container.querySelector<HTMLTextAreaElement>(
      '[aria-label="Argument context preview"]',
    )!;
    expect(packetPreview.value).toContain(
      '# Source-aware argument context packet',
    );
    expect(packetPreview.value).toContain(
      'Convert the units before drawing the conclusion.',
    );
    expect(packetPreview.value).toContain('Exact S2.');
    expect(packetPreview.value).toContain('Source inclusion: complete');
    expect(store.writes).toBe(1);
  });

  it('invalidates binding on a source-session switch without losing a dirty editor', async () => {
    const sourceAccess = new ArgumentSourceAccessSession();
    sourceAccess.publishCommittedSource({
      sourceSessionId: 'source-session-one',
      sourceSpaceId: 'source-space-one',
      displayName: 'First neutral vault',
      acquisition: 'captured',
      acquisitionState: 'ready',
      runtimeRevision: 1,
      observedAt: '2026-06-01T00:00:01.000Z',
      inventory: { markdownDocuments: [], nonMarkdownPaths: [] },
    });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    await mount(sourceAccess);
    await click('Compatible units');
    await click('Use selected vault for theory sources');
    await click('Edit');
    const statement = textarea('Statement');
    await typeCharacters(statement, ' retained');

    await act(async () => {
      sourceAccess.publishCommittedSource({
        sourceSessionId: 'source-session-two',
        sourceSpaceId: 'source-space-two',
        displayName: 'Second neutral vault',
        acquisition: 'captured',
        acquisitionState: 'ready',
        runtimeRevision: 1,
        observedAt: '2026-06-01T00:00:02.000Z',
        inventory: { markdownDocuments: [], nonMarkdownPaths: [] },
      });
      await Promise.resolve();
    });

    expect(statement.value).toContain(' retained');
    expect(container.textContent).toContain('Unsaved draft');
    expect(container.textContent).toContain(
      'Use selected vault for theory sources',
    );
    expect(store.writes).toBe(0);
  });
});

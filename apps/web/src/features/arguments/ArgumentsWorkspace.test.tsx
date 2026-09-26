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
  createContext,
  createEmptyArgumentLibrary,
  createTopic,
  editArgument,
  editAxiom,
  promoteArgumentToCurrent,
  sameSnapshot,
  setTopicMembership,
  submitArgumentProposal,
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
  library = createContext(
    library,
    {
      id: 'CTX-UI',
      title: 'Neutral background',
      description: 'Background for interpreting the comparison.',
      axiomIds: ['AX-UI'],
      reviewState: 'accepted',
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
          examples: [
            {
              id: 'E-UI',
              text: 'A neutral sample uses one measurement unit.',
            },
          ],
          premises: [
            {
              id: 'P-UI',
              kind: 'axiom',
              axiomId: 'AX-UI',
              reliedOnRevision: library.axioms[0]!.revision,
              exampleIds: ['E-UI'],
            },
          ],
          reasoning: 'Comparable units are required before comparison.',
          conclusion: 'Convert units before concluding a contradiction.',
          boundary: 'The conclusion does not depend on display formatting.',
          contextIds: ['CTX-UI'],
          reviewState: 'accepted',
        },
        clock,
      ),
      {
        id: 'AR-UI-NEXT',
        title: 'Replacement reasoning',
        premises: [
          {
            id: 'P-UI-REUSED',
            kind: 'argument-premise',
            argumentId: 'AR-UI',
            premiseId: 'P-UI',
            reliedOnRevision: 1,
          },
        ],
        relations: [
          {
            id: 'REL-UI',
            kind: 'attack',
            targetArgumentId: 'AR-UI',
            targetPart: { kind: 'reasoning' },
            reliedOnRevision: 1,
          },
        ],
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

function fixtureWithProposal(
  staleTarget = false,
  intent: 'attack' | 'add-boundary' = 'attack',
  includeSoftExplanation = true,
): ArgumentLibrary {
  const clock = runtime();
  const base = fixture();
  const descriptor = captureArgumentLibrarySnapshot(base).descriptor;
  const target = base.arguments.find(({ id }) => id === 'AR-UI')!;
  const topic = base.topics.find(({ id }) => id === 'T-UI')!;
  const axiom = base.axioms.find(({ id }) => id === 'AX-UI')!;
  let library = submitArgumentProposal(
    base,
    {
      clientSubmissionId: 'ui-proposal-submission',
      title: 'Verified normalization exception',
      ...(includeSoftExplanation
        ? {
            softExplanationMarkdown: [
              '### Review impact',
              '',
              'This **plain-language view** contains SOFT_ONLY_MARKER.',
              '',
              '> It helps a person scan the proposal.',
              '',
              '1. Review the boundary.',
              '2. Check the cited structure.',
              '',
              '```text',
              'review-only-code     LEFT -> MIDDLE -> RIGHT'.padEnd(240, '-'),
              '```',
              '',
              '<script>globalThis.mailboxPwned = true</script>',
              '',
              '[unsafe](javascript:alert(1)) [safe](https://example.test/review)',
              '',
              '![remote](https://example.test/review.png)',
            ].join('\n'),
          }
        : {}),
      intent,
      topicId: topic.id,
      target: {
        argumentId: target.id,
        part: { kind: 'reasoning' },
        reliedOnRevision: target.revision,
      },
      examples: ['The input quantities were normalized upstream.'],
      premises: [
        {
          id: 'P-CLAIM',
          kind: 'text',
          text: 'A current normalization contract exists.',
        },
        {
          id: 'P-AXIOM',
          kind: 'axiom',
          axiomId: axiom.id,
          reliedOnRevision: axiom.revision,
        },
      ],
      reasoning: 'Verified normalization can satisfy the compatibility rule.',
      conclusion: 'A second conversion is unnecessary in this bounded case.',
      boundary: 'Only while the normalization contract remains current.',
      sourceObservations: [
        {
          id: 'SOURCE-1',
          label: 'Normalization implementation',
          repository: 'icarus/example',
          url: 'https://example.com/icarus/commit/36c927fabcd',
          commitSha: '36c927fabcd',
          filePath: 'Associated Value.md',
          observation: 'The implementation normalizes quantities upstream.',
        },
      ],
      whyNovelOrUnresolved:
        'The canonical reasoning does not discuss pre-normalized inputs.',
      consultation: {
        libraryId: descriptor.libraryId,
        libraryRevision: descriptor.libraryRevision,
        contentFingerprint: descriptor.contentFingerprint,
        records: [
          { kind: 'topic', id: topic.id, revision: topic.revision },
          { kind: 'argument', id: target.id, revision: target.revision },
          { kind: 'axiom', id: axiom.id, revision: axiom.revision },
        ],
      },
    },
    clock,
  ).library;
  if (staleTarget) {
    library = editArgument(
      library,
      target.id,
      { reasoning: 'The canonical reasoning changed after consultation.' },
      clock,
    );
  }
  return library;
}

class MemoryStore implements ArgumentLibraryStore {
  snapshot: ReturnType<typeof captureArgumentLibrarySnapshot>;
  writes = 0;

  constructor(library: ArgumentLibrary = fixture()) {
    this.snapshot = captureArgumentLibrarySnapshot(library);
  }

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
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: vi.fn(),
      }),
    );
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

  function fieldsetCheckbox(legend: string, label: string): HTMLInputElement {
    const fieldset = [
      ...container.querySelectorAll<HTMLFieldSetElement>('fieldset'),
    ].find(
      (candidate) => candidate.querySelector('legend')?.textContent === legend,
    );
    const result = [
      ...(fieldset?.querySelectorAll<HTMLInputElement>(
        'input[type="checkbox"]',
      ) ?? []),
    ].find((candidate) =>
      candidate.closest('label')?.textContent?.includes(label),
    );
    if (result === undefined) {
      throw new Error(`Missing checkbox ${legend}: ${label}`);
    }
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

  it('shows pending proposal provenance, stale targets, suggestions, and cancellation without canonical writes', async () => {
    store = new MemoryStore(fixtureWithProposal(true));
    session = new ArgumentWorkspaceSession(store, runtime());
    await mount();

    await click('Mailbox (1)');
    expect(container.textContent).toContain('Non-canonical review queue');
    expect(container.textContent).toContain('Pending (1)');
    expect(container.textContent).toContain('Verified normalization exception');
    expect(container.textContent).toContain(
      'A second conversion is unnecessary in this bounded case.',
    );
    expect(container.textContent).toContain(
      'The canonical reasoning does not discuss pre-normalized inputs.',
    );
    expect(container.textContent).toContain(
      'Compatibility reasoning argument · AR-UI · revision 1',
    );
    expect(container.textContent).toContain('Source observations / provenance');
    expect(container.textContent).toContain('36c927f');
    expect(container.textContent).toContain('Stale target:');
    const soft = container.querySelector<HTMLElement>(
      '.arguments-mailbox__soft-explanation',
    );
    const localContext = [...container.querySelectorAll('h4')].find(
      (heading) => heading.textContent === 'Local Argument context',
    );
    const formal = container.querySelector<HTMLElement>(
      '.arguments-mailbox__formal-title',
    );
    expect(soft?.textContent).toContain('What this means');
    expect(soft?.querySelector('h3')?.textContent).toBe('Review impact');
    expect(soft?.querySelector('strong')?.textContent).toBe(
      'plain-language view',
    );
    expect(soft?.querySelector('blockquote')).not.toBeNull();
    expect(soft?.querySelector('ol')).not.toBeNull();
    const codeViewport = soft?.querySelector('pre');
    expect(codeViewport?.textContent).toContain(
      'review-only-code     LEFT -> MIDDLE -> RIGHT',
    );
    expect(codeViewport?.textContent).toContain('-'.repeat(120));
    expect(
      codeViewport?.parentElement?.classList.contains(
        'safe-markdown__code-block',
      ),
    ).toBe(true);
    expect(soft?.querySelector('script')).toBeNull();
    expect(soft?.querySelector('img')).toBeNull();
    expect(soft?.querySelectorAll('a')).toHaveLength(1);
    expect(soft?.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.test/review',
    );
    expect(Reflect.get(globalThis, 'mailboxPwned')).toBeUndefined();
    expect(localContext?.compareDocumentPosition(soft!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(soft?.compareDocumentPosition(formal!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await click('Accept / Integrate');
    expect(container.textContent).toContain('Integrate accepted proposal');
    expect(container.textContent).toContain('Compatible units');
    expect(textarea('Conclusion').value).toBe(
      'A second conversion is unnecessary in this bounded case.',
    );
    expect(
      [...container.querySelectorAll('select')].find((select) =>
        select.closest('label')?.textContent?.includes('Canonical relation'),
      )?.value,
    ).toBe('attack');
    expect(store.writes).toBe(0);

    await click('Cancel');
    expect(container.textContent).toContain('Cancel this draft?');
    await click('Discard');
    expect(container.textContent).toContain('Proposal Mailbox');
    expect(container.textContent).toContain('Pending (1)');
    expect(store.snapshot.library.proposals[0]?.status).toBe('pending');
    expect(store.writes).toBe(0);
  });

  it('omits the Soft Explanation section when the proposal has none', async () => {
    store = new MemoryStore(fixtureWithProposal(false, 'attack', false));
    session = new ArgumentWorkspaceSession(store, runtime());
    await mount();

    await click('Mailbox (1)');

    expect(container.textContent).not.toContain('What this means');
    expect(
      container.querySelector('.arguments-mailbox__soft-explanation'),
    ).toBeNull();
    expect(container.textContent).toContain('Formal argument');
  });

  it('protects a dirty canonical draft before opening the Mailbox', async () => {
    store = new MemoryStore(fixtureWithProposal());
    session = new ArgumentWorkspaceSession(store, runtime());
    await mount();
    await click('Numeric mismatch');
    await click('Edit');
    await act(() => setValue(textarea('Observation'), 'Unsaved Mailbox test.'));

    await click('Mailbox (1)');
    expect(container.textContent).toContain(
      'Open Mailbox with unsaved changes?',
    );
    expect(container.textContent).not.toContain('Proposal Mailbox');
    await click('Discard');
    expect(container.textContent).toContain('Proposal Mailbox');
    expect(store.writes).toBe(0);
  });

  it('keeps boundary intent separate from canonical attack and exposes navigable target provenance', async () => {
    store = new MemoryStore(fixtureWithProposal(false, 'add-boundary'));
    session = new ArgumentWorkspaceSession(store, runtime());
    await mount();
    await click('Mailbox (1)');

    expect(container.textContent).toContain('Add boundary to');
    const commit = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/icarus/commit/36c927fabcd"]',
    );
    expect(commit?.textContent).toBe('36c927fa');
    expect(commit?.title).toBe('36c927fabcd');
    expect(button('Copy SHA')).toBeDefined();
    expect(button('Open record')).toBeDefined();

    await click('Accept / Integrate');
    expect(
      [...container.querySelectorAll('select')].find((select) =>
        select.closest('label')?.textContent?.includes('Canonical relation'),
      )?.value,
    ).toBe('none');
    expect(store.writes).toBe(0);
  });

  it('rejects a proposal into one accepted canonical Audit and exposes it in history', async () => {
    store = new MemoryStore(fixtureWithProposal());
    session = new ArgumentWorkspaceSession(store, runtime());
    await mount();
    await click('Mailbox (1)');
    await click('Reject / Record response');

    expect(container.textContent).toContain('Record why the proposal failed');
    expect(container.textContent).toContain(
      'canonical Counter-Argument will be human-accepted',
    );
    await click('Save');
    expect(container.textContent).toContain(
      'Response explanation is required to reject a proposal.',
    );
    expect(store.writes).toBe(0);
    await act(() =>
      setValue(
        textarea('Recorded response — why it applies'),
        'No current normalization contract supports this exception.',
      ),
    );
    await act(() =>
      setValue(
        textarea('Human decision note'),
        'Rejected after checking the current Axiom.',
      ),
    );
    await act(() =>
      fieldsetCheckbox(
        'Answered using reusable Axioms',
        'Compatible units',
      ).click(),
    );
    await click('Save');

    expect(store.writes).toBe(1);
    const proposal = store.snapshot.library.proposals[0]!;
    expect(proposal.status).toBe('rejected');
    const resultingId = proposal.decision?.resultingCounterArgumentId;
    const result = store.snapshot.library.counterArguments.find(
      ({ id }) => id === resultingId,
    );
    expect(result).toMatchObject({
      reviewState: 'accepted',
      response: {
        explanation:
          'No current normalization contract supports this exception.',
        outcome: 'refuted',
        answeringAxioms: [{ axiomId: 'AX-UI', reliedOnRevision: 1 }],
      },
    });
    expect(JSON.stringify(result)).not.toContain('SOFT_ONLY_MARKER');
    expect(proposal.softExplanationMarkdown).toContain('SOFT_ONLY_MARKER');
    expect(store.snapshot.library.topics[0]?.counterArgumentIds).toContain(
      resultingId,
    );

    await click('Mailbox (0)');
    await click('History');
    expect(container.textContent).toContain('Human decision');
    expect(container.textContent).toContain(
      'Rejected after checking the current Axiom.',
    );
    expect(button('Open resulting Counter-Argument')).toBeDefined();
  });

  it('accepts a proposal with explicit attack, supersession, and promotion choices', async () => {
    store = new MemoryStore(fixtureWithProposal());
    session = new ArgumentWorkspaceSession(store, runtime());
    await mount();
    await click('Mailbox (1)');
    await click('Accept / Integrate');
    await act(() =>
      setValue(
        textarea('Human decision note'),
        'Accepted as the Current bounded refinement.',
      ),
    );
    await act(() =>
      fieldsetCheckbox(
        'Final relationship to the target',
        'Supersede the target Argument',
      ).click(),
    );
    await act(() =>
      fieldsetCheckbox(
        'Final relationship to the target',
        'Promote the new Argument to Current for the selected Topic',
      ).click(),
    );
    await click('Save');

    expect(store.writes).toBe(1);
    const proposal = store.snapshot.library.proposals[0]!;
    expect(proposal.status).toBe('accepted');
    const resultingId = proposal.decision?.resultingArgumentId;
    const result = store.snapshot.library.arguments.find(
      ({ id }) => id === resultingId,
    );
    expect(result).toMatchObject({
      reviewState: 'accepted',
      supersedesArgumentId: 'AR-UI',
      relations: [
        expect.objectContaining({
          kind: 'attack',
          targetArgumentId: 'AR-UI',
          targetPart: { kind: 'reasoning' },
          reliedOnRevision: 1,
        }),
      ],
    });
    expect(JSON.stringify(result)).not.toContain('SOFT_ONLY_MARKER');
    expect(proposal.softExplanationMarkdown).toContain('SOFT_ONLY_MARKER');
    expect(result?.premises).toEqual([
      expect.objectContaining({
        kind: 'text',
        text: 'A current normalization contract exists.',
      }),
      expect.objectContaining({ kind: 'axiom', axiomId: 'AX-UI' }),
    ]);
    expect(
      result?.premises.some(
        (premise) =>
          premise.kind === 'text' &&
          premise.text.includes('implementation normalizes'),
      ),
    ).toBe(false);
    expect(store.snapshot.library.topics[0]?.currentArgumentId).toBe(
      resultingId,
    );

    await click('Mailbox (0)');
    await click('History');
    expect(container.textContent).toContain(
      'Accepted as the Current bounded refinement.',
    );
    expect(button('Open resulting Argument')).toBeDefined();
  });

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

  it('previews Insert JSON and protects a dirty draft before one atomic confirmation', async () => {
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
    await act(() => setValue(observation, 'Unsaved local draft.'));

    await click('Insert JSON');
    const source = textarea('Insert JSON document');
    await act(() =>
      setValue(
        source,
        JSON.stringify({
          format: 'argument-workspace-insert-v1',
          topics: [
            {
              id: 'TOP-INSERT-UI',
              title: 'Inserted UI Topic',
              summary: 'A synthetic UI insertion.',
            },
          ],
          arguments: [
            {
              id: 'ARG-INSERT-UI-A1',
              title: 'Inserted original',
              premises: [
                { id: 'P-INSERT-UI', kind: 'text', text: 'Premise one.' },
              ],
              reasoning: 'Original reasoning.',
              conclusion: 'Original conclusion.',
              reviewState: 'accepted',
            },
            {
              id: 'ARG-INSERT-UI-A2',
              title: 'Inserted refinement',
              premises: [
                {
                  id: 'P-INSERT-REUSE',
                  kind: 'argument-premise',
                  argumentId: 'ARG-INSERT-UI-A1',
                  premiseId: 'P-INSERT-UI',
                },
              ],
              conclusion: 'Refined conclusion.',
              relations: [
                {
                  id: 'REL-INSERT-UI',
                  kind: 'attack',
                  targetArgumentId: 'ARG-INSERT-UI-A1',
                  targetPart: { kind: 'reasoning' },
                },
              ],
              supersedesArgumentId: 'ARG-INSERT-UI-A1',
              reviewState: 'accepted',
            },
          ],
          memberships: [
            {
              topicId: 'TOP-INSERT-UI',
              kind: 'argument',
              recordId: 'ARG-INSERT-UI-A1',
            },
            {
              topicId: 'TOP-INSERT-UI',
              kind: 'argument',
              recordId: 'ARG-INSERT-UI-A2',
            },
          ],
          currentPromotions: [
            {
              topicId: 'TOP-INSERT-UI',
              argumentId: 'ARG-INSERT-UI-A2',
            },
          ],
        }),
      ),
    );
    await click('Preview insert');

    expect(store.writes).toBe(0);
    expect(container.textContent).toContain('Validated preview');
    expect(container.textContent).toContain(
      'Resolved ARG-INSERT-UI-A1 at revision 1',
    );
    expect(container.textContent).toContain('Attack / support relations');

    await click('Confirm insert');
    expect(container.textContent).toContain('Insert over unsaved changes?');
    expect(store.writes).toBe(0);
    await click('Discard');

    expect(store.writes).toBe(1);
    expect(store.snapshot.library.topics).toContainEqual(
      expect.objectContaining({
        id: 'TOP-INSERT-UI',
        currentArgumentId: 'ARG-INSERT-UI-A2',
        argumentIds: ['ARG-INSERT-UI-A1', 'ARG-INSERT-UI-A2'],
      }),
    );
    expect(container.textContent).toContain('Inserted UI Topic');
  });

  it('loads an Insert JSON file into the editable source before preview and confirmation', async () => {
    await mount();
    await click('Insert JSON');

    const source = JSON.stringify({
      format: 'argument-workspace-insert-v1',
      topics: [
        {
          id: 'TOP-INSERT-FILE',
          title: 'Bread drinking symbolic matching',
          summary: 'Loaded from a selected JSON file.',
        },
      ],
    });
    const picker = [
      ...container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
    ].find((control) =>
      control.closest('label')?.textContent?.includes('Select JSON file'),
    );
    if (picker === undefined)
      throw new Error('Missing Insert JSON file picker.');
    expect(picker.accept).toContain('.json');

    const file = new File(
      [source],
      'bread_drinking_symbolic_matching_insert.json',
      {
        type: 'application/json',
      },
    );
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: async () => source,
    });
    Object.defineProperty(picker, 'files', {
      configurable: true,
      value: [file],
    });
    await act(async () => {
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      await Promise.resolve();
    });

    expect(textarea('Insert JSON document').value).toBe(source);
    expect(container.textContent).toContain(
      'bread_drinking_symbolic_matching_insert.json',
    );
    await click('Preview insert');
    expect(store.writes).toBe(0);
    expect(container.textContent).toContain('Validated preview');
    expect(container.textContent).toContain('TOP-INSERT-FILE');

    await click('Confirm insert');
    await vi.waitFor(() => expect(store.writes).toBe(1));
    expect(store.snapshot.library.topics).toContainEqual(
      expect.objectContaining({
        id: 'TOP-INSERT-FILE',
        title: 'Bread drinking symbolic matching',
      }),
    );
  });

  it('shows Current reasoning and promotes an accepted member explicitly', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );
    await mount();
    expect(container.textContent).toContain('Current reasoning');
    expect(container.textContent).toContain('Compatibility reasoning');

    await click('Compatibility reasoning');
    expect(container.textContent).toContain(
      'A neutral sample uses one measurement unit.',
    );
    expect(container.textContent).toContain('Grounded in local Examples: E-UI');
    expect(container.textContent).toContain(
      'The conclusion does not depend on display formatting.',
    );
    expect(container.textContent).toContain(
      'Contexts — background, not premises',
    );
    expect(container.textContent).toContain('Effective background Axioms');
    expect(container.textContent).toContain('Neutral background');

    await click('Back');
    await click('Replacement reasoning');
    expect(container.textContent).toContain(
      'A replacement Current conclusion.',
    );
    expect(container.textContent).toContain('premise P-UI');
    expect(container.textContent).toContain('attack');
    expect(container.textContent).toContain('reasoning');
    await click('Promote to Current');

    expect(store.snapshot.library.topics[0]!.currentArgumentId).toBe(
      'AR-UI-NEXT',
    );
    expect(
      store.snapshot.library.arguments.find(({ id }) => id === 'AR-UI-NEXT'),
    ).toMatchObject({ supersedesArgumentId: 'AR-UI' });
  });

  it('exposes Context authoring fields and the separate Argument background selector', async () => {
    await mount();
    await click('New Context');
    expect(textarea('Description')).toBeInstanceOf(HTMLTextAreaElement);
    expect(container.textContent).toContain('Parent Context');
    expect(container.textContent).toContain('Direct background Axioms');
    expect(container.textContent).toContain(
      'background never becomes an inference premise',
    );

    await click('Cancel');
    await click('Discard');
    await click('Compatibility reasoning');
    await click('Edit');
    expect(container.textContent).toContain(
      'Contexts (background, not premises)',
    );
    expect(container.textContent).toContain('Effective background Axioms');
    expect(container.textContent).toContain(
      'available context, not premise dependencies',
    );
  });

  it('explains inherited premise staleness when pinned revisions still match', async () => {
    const changed = editAxiom(
      fixture(),
      'AX-UI',
      { statement: 'The compatible-units support was revised.' },
      runtime(),
    );
    store.snapshot = captureArgumentLibrarySnapshot(changed);
    await mount();
    await click('Replacement reasoning');

    const text = container.textContent ?? '';
    expect(text).toContain(
      'Pinned revision metadata — relied on revision 1; current revision 1.',
    );
    expect(text).toContain(
      'Inherited stale — the referenced inference has unresolved upstream premise support.',
    );
    expect(text).toContain(
      'AR-UI-NEXT.P-UI-REUSED → AR-UI.P-UI; AR-UI.P-UI → AX-UI',
    );
    expect(text).toContain(
      'Resolve and reassess upstream inference dependencies before reassessing this Argument.',
    );
    expect(button('Reassess against current premise versions').disabled).toBe(
      true,
    );
  });

  it('edits Examples, Boundary/Invariance, provenance, premise reuse, and relations in one Argument editor', async () => {
    await mount();
    await click('Compatibility reasoning');
    await click('Edit');
    expect(container.textContent).toContain('Grounded in local Examples');
    expect(container.textContent).toContain('Add Example');
    expect(container.textContent).toContain('Add relation');
    await typeCharacters(textarea('Example text'), ' Extended.');
    await act(() =>
      setValue(
        textarea('Boundary / Invariance'),
        'The result is invariant under neutral display changes.',
      ),
    );
    await click('Add relation');
    await click('Save');

    const saved = store.snapshot.library.arguments.find(
      ({ id }) => id === 'AR-UI',
    )!;
    expect(saved.examples[0]!.text).toContain('Extended.');
    expect(saved.premises[0]!.exampleIds).toEqual(['E-UI']);
    expect(saved.boundary).toBe(
      'The result is invariant under neutral display changes.',
    );
    expect(saved.relations).toEqual([
      expect.objectContaining({
        kind: 'attack',
        targetArgumentId: 'AR-UI-NEXT',
        targetPart: { kind: 'argument' },
      }),
    ]);

    await click('Back');
    await click('Replacement reasoning');
    await click('Edit');
    expect(container.textContent).toContain('Prior Argument premise');
    expect(container.textContent).toContain('Source premise');
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

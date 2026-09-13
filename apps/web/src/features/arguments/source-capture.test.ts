import { describe, expect, it } from 'vitest';

import type {
  LinkedTheorySourceProviderRequest,
  TheorySourceReference,
} from '@icarus-graph-explorer/argument-workspace';

import {
  ARGUMENT_SOURCE_CAPTURE_LIMITS,
  ArgumentSourceAccessSession,
  FULL_DOCUMENT_SOURCE_VERSION_NAMESPACE,
  type ArgumentSourceCandidateInput,
} from './source-capture';

const OBSERVED = '2026-04-01T12:00:00.000Z';

function candidate(
  overrides: Partial<ArgumentSourceCandidateInput> = {},
): ArgumentSourceCandidateInput {
  return {
    sourceSessionId: 'session-one',
    sourceSpaceId: 'source-space-one',
    displayName: 'Neutral vault',
    acquisition: 'captured',
    acquisitionState: 'ready',
    runtimeRevision: 1,
    observedAt: OBSERVED,
    inventory: {
      markdownDocuments: [
        {
          path: 'Theory/Neutral.md',
          source:
            '---\r\ntitle: "# Not a heading"\r\n---\r\n# Root\r\nOpening 😀.\r\n```md\r\n# False\r\n```\r\n## Child\r\nChild text.\r\n#### Skipped\r\nNested text.\r\n# Next\r\nEnd.\r\n',
        },
        {
          path: 'Theory/Duplicates.md',
          source:
            '<!--\n# Comment\n-->\n> [!note]\n> # Callout\n# First\n## Same\nOne\n# Second\n## Same\nTwo\n\nSetext\n======\nThree\n',
        },
      ],
      nonMarkdownPaths: ['image.png'],
    },
    ...overrides,
  };
}

function reference(
  overrides: Partial<TheorySourceReference> = {},
): TheorySourceReference {
  return {
    id: 'SRC-ONE',
    path: 'Theory/Neutral.md',
    heading: 'Root#Child',
    label: 'Neutral child',
    role: 'basis',
    ...overrides,
  };
}

function fileReference(id: string): TheorySourceReference {
  const { heading, ...result } = reference({ id });
  void heading;
  return result;
}

function request(
  locator: TheorySourceReference,
  overrides: Partial<LinkedTheorySourceProviderRequest> = {},
): LinkedTheorySourceProviderRequest {
  return {
    sourceReferenceId: locator.id,
    locator,
    requireExactVersion: false,
    maxCharacters: 12_000,
    ...overrides,
  };
}

function boundCapture(
  input = candidate(),
  references: readonly TheorySourceReference[] = [reference()],
) {
  const access = new ArgumentSourceAccessSession();
  access.publishCommittedSource(input);
  expect(access.bindCurrent(access.state().generation).status).toBe('bound');
  const captured = access.capture(references);
  if (captured.status !== 'ok') throw new Error(captured.message);
  return { access, capture: captured.capture };
}

describe('argument source capture', () => {
  it('requires explicit binding and invalidates it for a new source session', () => {
    const access = new ArgumentSourceAccessSession();
    expect(access.capture([reference()]).status).toBe('unavailable');
    access.publishCommittedSource(candidate());
    expect(access.capture([reference()])).toMatchObject({
      status: 'wrong-binding',
    });
    expect(access.bindCurrent(access.state().generation).status).toBe('bound');
    expect(access.capture([reference()]).status).toBe('ok');

    access.publishCommittedSource(
      candidate({ runtimeRevision: 2, acquisition: 'captured' }),
    );
    expect(access.state().status).toBe('bound');
    access.publishCommittedSource(
      candidate({
        sourceSessionId: 'session-two',
        sourceSpaceId: 'source-space-two',
      }),
    );
    expect(access.state().status).toBe('available');
    expect(access.capture([reference()]).status).toBe('wrong-binding');
  });

  it('denies fresh capture from a non-committed live acquisition state', () => {
    const access = new ArgumentSourceAccessSession();
    access.publishCommittedSource(
      candidate({ acquisition: 'live', acquisitionState: 'updating' }),
    );
    access.bindCurrent(access.state().generation);
    expect(access.capture([reference()])).toMatchObject({
      status: 'unavailable',
    });
  });

  it('enforces selected-reference and per-file capture limits explicitly', async () => {
    const access = new ArgumentSourceAccessSession();
    access.publishCommittedSource(candidate());
    access.bindCurrent(access.state().generation);
    expect(
      access.capture(
        Array.from(
          { length: ARGUMENT_SOURCE_CAPTURE_LIMITS.selectedReferences + 1 },
          (_value, index) => reference({ id: `SRC-${index}` }),
        ),
      ),
    ).toMatchObject({ status: 'limit-exceeded' });

    const oversized = new ArgumentSourceAccessSession();
    oversized.publishCommittedSource(
      candidate({
        inventory: {
          markdownDocuments: [
            {
              path: 'Theory/Neutral.md',
              source: 'x'.repeat(
                ARGUMENT_SOURCE_CAPTURE_LIMITS.perFileCharacters + 1,
              ),
            },
          ],
          nonMarkdownPaths: [],
        },
      }),
    );
    oversized.bindCurrent(oversized.state().generation);
    const result = oversized.capture([reference()]);
    if (result.status !== 'ok') throw new Error(result.message);
    expect(
      await result.capture.provider.read(request(reference())),
    ).toMatchObject({ status: 'denied' });
  });

  it('enforces captured-file and total-character limits without widening the selection', async () => {
    const fileLimited = new ArgumentSourceAccessSession();
    const fileReferences = Array.from(
      { length: ARGUMENT_SOURCE_CAPTURE_LIMITS.capturedFiles + 1 },
      (_value, index) =>
        fileReference(`FILE-${index}`) satisfies TheorySourceReference,
    ).map((value, index) => ({
      ...value,
      path: `Theory/File-${index}.md`,
    }));
    fileLimited.publishCommittedSource(
      candidate({
        inventory: {
          markdownDocuments: fileReferences.map(({ path }, index) => ({
            path,
            source: `File ${index}\n`,
          })),
          nonMarkdownPaths: [],
        },
      }),
    );
    fileLimited.bindCurrent(fileLimited.state().generation);
    const fileCapture = fileLimited.capture(fileReferences);
    if (fileCapture.status !== 'ok') throw new Error(fileCapture.message);
    const lastFile = fileReferences.at(-1)!;
    expect(
      await fileCapture.capture.provider.read(request(lastFile)),
    ).toMatchObject({ status: 'denied' });

    const totalLimited = new ArgumentSourceAccessSession();
    const maximumFile = 'x'.repeat(
      ARGUMENT_SOURCE_CAPTURE_LIMITS.perFileCharacters,
    );
    const totalReferences = Array.from({ length: 5 }, (_value, index) => ({
      ...fileReference(`TOTAL-${index}`),
      path: `Theory/Total-${index}.md`,
    }));
    totalLimited.publishCommittedSource(
      candidate({
        inventory: {
          markdownDocuments: totalReferences.map(({ path }) => ({
            path,
            source: maximumFile,
          })),
          nonMarkdownPaths: [],
        },
      }),
    );
    totalLimited.bindCurrent(totalLimited.state().generation);
    const totalCapture = totalLimited.capture(totalReferences);
    if (totalCapture.status !== 'ok') throw new Error(totalCapture.message);
    expect(
      await totalCapture.capture.provider.read(request(totalReferences[4]!)),
    ).toMatchObject({ status: 'denied' });
  });

  it('returns exact heading subtrees with CRLF UTF-16 spans and stable full-file versions', async () => {
    const locator = reference({
      originalWikilink: '[[Conflicting#Display only]]',
    });
    const { capture } = boundCapture(candidate(), [locator]);
    const result = await capture.provider.read(request(locator));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.text).toBe(
      '## Child\r\nChild text.\r\n#### Skipped\r\nNested text.\r\n',
    );
    expect(result.location).toMatchObject({
      path: 'Theory/Neutral.md',
      heading: 'Root#Child',
      span: {
        start: { line: 9, column: 1 },
        end: { line: 13, column: 1 },
      },
    });
    expect(result.location.span?.end.offset).toBe(
      candidate().inventory.markdownDocuments[0]!.source.indexOf('# Next'),
    );
    expect(result.sourceVersion).toMatch(
      new RegExp(
        `^${FULL_DOCUMENT_SOURCE_VERSION_NAMESPACE}:[a-f0-9]{64}$`,
        'u',
      ),
    );

    const second = boundCapture(candidate({ runtimeRevision: 99 }), [
      locator,
    ]).capture;
    const again = await second.provider.read(request(locator));
    expect(again.status).toBe('ok');
    if (again.status === 'ok') {
      expect(again.sourceVersion).toBe(result.sourceVersion);
    }
  });

  it('supports full files and Setext headings while keeping false headings out', async () => {
    const full = fileReference('FULL');
    const setext = reference({
      id: 'SETEXT',
      path: 'Theory/Duplicates.md',
      heading: 'Setext',
    });
    const falseHeading = reference({ id: 'FALSE', heading: 'False' });
    const commentHeading = reference({
      id: 'COMMENT',
      path: 'Theory/Duplicates.md',
      heading: 'Comment',
    });
    const calloutHeading = reference({
      id: 'CALLOUT',
      path: 'Theory/Duplicates.md',
      heading: 'Callout',
    });
    const { capture } = boundCapture(candidate(), [
      full,
      setext,
      falseHeading,
      commentHeading,
      calloutHeading,
    ]);
    const fullResult = await capture.provider.read(request(full));
    expect(fullResult).toMatchObject({ status: 'ok', complete: true });
    if (fullResult.status === 'ok') {
      expect(fullResult.text).toBe(
        candidate().inventory.markdownDocuments[0]!.source,
      );
    }
    const setextResult = await capture.provider.read(request(setext));
    expect(setextResult).toMatchObject({
      status: 'ok',
      text: 'Setext\n======\nThree\n',
    });
    expect(await capture.provider.read(request(falseHeading))).toMatchObject({
      status: 'heading-unresolved',
    });
    expect(await capture.provider.read(request(commentHeading))).toMatchObject({
      status: 'heading-unresolved',
    });
    expect(await capture.provider.read(request(calloutHeading))).toMatchObject({
      status: 'heading-unresolved',
    });
  });

  it('reports duplicate and missing headings instead of falling back', async () => {
    const ambiguous = reference({
      id: 'AMBIGUOUS',
      path: 'Theory/Duplicates.md',
      heading: 'Same',
    });
    const exact = reference({
      id: 'EXACT',
      path: 'Theory/Duplicates.md',
      heading: 'Second#Same',
    });
    const missing = reference({
      id: 'MISSING',
      path: 'Theory/Duplicates.md',
      heading: 'Renamed',
    });
    const { capture } = boundCapture(candidate(), [ambiguous, exact, missing]);
    expect(await capture.provider.read(request(ambiguous))).toMatchObject({
      status: 'heading-ambiguous',
    });
    expect(await capture.provider.read(request(exact))).toMatchObject({
      status: 'ok',
      text: '## Same\nTwo\n\n',
    });
    expect(await capture.provider.read(request(missing))).toMatchObject({
      status: 'heading-unresolved',
    });
  });

  it('clips without splitting surrogate pairs and returns the clipped span', async () => {
    const locator = fileReference('SRC-ONE');
    const { capture } = boundCapture(candidate(), [locator]);
    const source = candidate().inventory.markdownDocuments[0]!.source;
    const emoji = source.indexOf('😀');
    const result = await capture.provider.read(
      request(locator, { maxCharacters: emoji + 1 }),
    );
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.text.length).toBe(emoji);
    expect(result.text.endsWith('\ud83d')).toBe(false);
    expect(result.complete).toBe(false);
    expect(result.location.span?.end.offset).toBe(emoji);
    expect(result.omissions).toHaveLength(1);
  });

  it('rejects unsafe, non-Markdown, changed locators, unknown IDs, blocks, and unavailable exact versions', async () => {
    const unsafe = reference({ id: 'UNSAFE', path: '../outside.md' });
    const attachment = reference({ id: 'ATTACHMENT', path: 'image.png' });
    const block = reference({ id: 'BLOCK', block: 'marker' });
    const exactVersion = reference({ id: 'EXACT-VERSION' });
    const { capture } = boundCapture(candidate(), [
      unsafe,
      attachment,
      block,
      exactVersion,
    ]);
    expect(await capture.provider.read(request(unsafe))).toMatchObject({
      status: 'denied',
    });
    expect(await capture.provider.read(request(attachment))).toMatchObject({
      status: 'unsupported',
    });
    expect(await capture.provider.read(request(block))).toMatchObject({
      status: 'unsupported',
    });
    expect(
      await capture.provider.read(
        request(reference({ id: 'UNKNOWN' }), {
          sourceReferenceId: 'UNKNOWN',
        }),
      ),
    ).toMatchObject({ status: 'denied' });
    expect(
      await capture.provider.read(
        request(block, { locator: { ...block, heading: 'changed' } }),
      ),
    ).toMatchObject({ status: 'denied' });
    expect(
      await capture.provider.read(
        request(exactVersion, {
          requireExactVersion: true,
          expectedSourceVersion: 'unretained-version',
        }),
      ),
    ).toMatchObject({ status: 'version-unavailable' });
  });

  it('keeps a retained S1 capture immutable after the live session publishes S2', async () => {
    const locator = fileReference('SRC-ONE');
    const { access, capture: first } = boundCapture(candidate(), [locator]);
    const s1 = await first.provider.read(request(locator));
    access.publishCommittedSource(
      candidate({
        acquisition: 'live',
        runtimeRevision: 2,
        inventory: {
          markdownDocuments: [
            { path: 'Theory/Neutral.md', source: '# Root\nS2\n' },
          ],
          nonMarkdownPaths: [],
        },
      }),
    );
    const secondResult = access.capture([locator]);
    if (secondResult.status !== 'ok') throw new Error(secondResult.message);
    const s2 = await secondResult.capture.provider.read(request(locator));
    const s1Again = await first.provider.read(request(locator));
    expect(s1Again).toEqual(s1);
    expect(s2).toMatchObject({ status: 'ok', text: '# Root\nS2\n' });
    if (s1.status === 'ok' && s2.status === 'ok') {
      expect(s2.sourceVersion).not.toBe(s1.sourceVersion);
      expect(
        await secondResult.capture.provider.read(
          request(locator, {
            requireExactVersion: true,
            expectedSourceVersion: s1.sourceVersion!,
          }),
        ),
      ).toMatchObject({ status: 'version-unavailable' });
    }
  });
});

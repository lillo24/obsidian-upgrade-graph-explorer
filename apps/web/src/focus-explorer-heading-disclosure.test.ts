import { describe, expect, it } from 'vitest';

import type {
  FocusOutlineModel,
  FocusOutlineRowStatus,
} from './focus-outline-model';
import {
  EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
  focusExplorerCollapsedHeadingIds,
  focusExplorerVisibleHeadingRows,
  synchronizeFocusExplorerHeadingDisclosure,
  toggleFocusExplorerHeadingDisclosure,
} from './focus-explorer-heading-disclosure';

function outline(
  statuses: Partial<Record<'h1' | 'h2' | 'h2b' | 'h3', FocusOutlineRowStatus>>,
  documentEntityId = 'doc-a',
): FocusOutlineModel {
  const status = (id: 'h1' | 'h2' | 'h2b' | 'h3') =>
    statuses[id] ?? 'not-disclosed';
  return {
    documentEntityId,
    sourcePath: `${documentEntityId}.md`,
    hiddenEntityIds: [],
    rows: [
      {
        entityId: 'h1',
        title: 'One',
        depth: 1,
        headingLevel: 1,
        hasChildHeadings: true,
        status: status('h1'),
        explicitlyHidden: false,
      },
      {
        entityId: 'h2',
        title: 'Two',
        depth: 2,
        headingLevel: 2,
        parentEntityId: 'h1',
        hasChildHeadings: true,
        status: status('h2'),
        explicitlyHidden: false,
      },
      {
        entityId: 'h3',
        title: 'Three',
        depth: 3,
        headingLevel: 3,
        parentEntityId: 'h2',
        hasChildHeadings: false,
        status: status('h3'),
        explicitlyHidden: false,
      },
      {
        entityId: 'h2b',
        title: 'Two B',
        depth: 2,
        headingLevel: 2,
        parentEntityId: 'h1',
        hasChildHeadings: false,
        status: status('h2b'),
        explicitlyHidden: false,
      },
    ],
  };
}

function collapsed(
  state: ReturnType<typeof synchronizeFocusExplorerHeadingDisclosure>,
) {
  return focusExplorerCollapsedHeadingIds(state, 'doc-a');
}

describe('Focus Explorer Heading disclosure', () => {
  it('E1/E2 opens initial ancestor paths only for graph-visible descendants', () => {
    const expanded = synchronizeFocusExplorerHeadingDisclosure(
      EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
      outline({ h1: 'visible', h2: 'visible', h2b: 'visible' }),
    );
    expect([...collapsed(expanded)]).toEqual(['h2']);
    expect(
      focusExplorerVisibleHeadingRows(
        outline({ h1: 'visible', h2: 'visible', h2b: 'visible' }),
        collapsed(expanded),
      ).map((row) => row.entityId),
    ).toEqual(['h1', 'h2', 'h2b']);

    const compact = synchronizeFocusExplorerHeadingDisclosure(
      EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
      outline({ h1: 'visible' }),
    );
    expect([...collapsed(compact)]).toEqual(['h1', 'h2']);
    expect(
      focusExplorerVisibleHeadingRows(
        outline({ h1: 'visible' }),
        collapsed(compact),
      ).map((row) => row.entityId),
    ).toEqual(['h1']);
  });

  it('E3/E5 opens for newly visible rows and preserves a later manual collapse on ordinary rerenders', () => {
    let state = synchronizeFocusExplorerHeadingDisclosure(
      EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
      outline({ h1: 'visible' }),
    );
    state = synchronizeFocusExplorerHeadingDisclosure(
      state,
      outline({ h1: 'visible', h2: 'visible' }),
    );
    expect(collapsed(state).has('h1')).toBe(false);

    state = toggleFocusExplorerHeadingDisclosure(state, 'doc-a', 'h1');
    expect(collapsed(state).has('h1')).toBe(true);
    const unchanged = synchronizeFocusExplorerHeadingDisclosure(
      state,
      outline({ h1: 'visible', h2: 'visible' }),
    );
    expect(unchanged).toBe(state);
    expect(collapsed(unchanged).has('h1')).toBe(true);
  });

  it('E6/E7/E8 never closes after graph collapse and reopens every ancestor after nested re-expansion', () => {
    let state = synchronizeFocusExplorerHeadingDisclosure(
      EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
      outline({ h1: 'visible', h2: 'visible', h3: 'visible' }),
    );
    expect([...collapsed(state)]).toEqual([]);

    state = synchronizeFocusExplorerHeadingDisclosure(
      state,
      outline({ h1: 'visible' }),
    );
    expect([...collapsed(state)]).toEqual([]);
    state = toggleFocusExplorerHeadingDisclosure(state, 'doc-a', 'h1');
    state = toggleFocusExplorerHeadingDisclosure(state, 'doc-a', 'h2');
    expect([...collapsed(state)]).toEqual(['h1', 'h2']);

    state = synchronizeFocusExplorerHeadingDisclosure(
      state,
      outline({ h1: 'visible', h2: 'visible', h3: 'visible' }),
    );
    expect([...collapsed(state)]).toEqual([]);
  });

  it('E9/E14 filters canonical rows without changing graph hide metadata', () => {
    const model = outline({
      h1: 'hidden',
      h2: 'hidden-by-ancestor',
      h3: 'hidden-by-ancestor',
    });
    const hiddenModel = { ...model, hiddenEntityIds: ['h1', 'h2'] };
    let state = synchronizeFocusExplorerHeadingDisclosure(
      EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
      hiddenModel,
    );
    state = toggleFocusExplorerHeadingDisclosure(state, 'doc-a', 'h1');

    expect(hiddenModel.hiddenEntityIds).toEqual(['h1', 'h2']);
    expect(
      focusExplorerVisibleHeadingRows(
        hiddenModel,
        focusExplorerCollapsedHeadingIds(state, 'doc-a'),
      ).map((row) => [row.entityId, row.status]),
    ).toEqual([
      ['h1', 'hidden'],
      ['h2', 'hidden-by-ancestor'],
      ['h2b', 'not-disclosed'],
    ]);
  });

  it('E12 retains independent collapse choices per canonical document ID', () => {
    let state = synchronizeFocusExplorerHeadingDisclosure(
      EMPTY_FOCUS_EXPLORER_HEADING_DISCLOSURE,
      outline({ h1: 'visible', h2: 'visible' }, 'doc-a'),
    );
    state = toggleFocusExplorerHeadingDisclosure(state, 'doc-a', 'h1');
    state = synchronizeFocusExplorerHeadingDisclosure(
      state,
      outline({ h1: 'visible', h2: 'visible' }, 'doc-b'),
    );
    expect(focusExplorerCollapsedHeadingIds(state, 'doc-b').has('h1')).toBe(
      false,
    );
    expect(focusExplorerCollapsedHeadingIds(state, 'doc-a').has('h1')).toBe(
      true,
    );

    const returned = synchronizeFocusExplorerHeadingDisclosure(
      state,
      outline({ h1: 'visible', h2: 'visible' }, 'doc-a'),
    );
    expect(focusExplorerCollapsedHeadingIds(returned, 'doc-a').has('h1')).toBe(
      true,
    );
  });
});

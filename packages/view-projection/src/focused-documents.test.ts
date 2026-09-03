import { describe, expect, it } from 'vitest';

import { describeFocusedDocumentNeighborhood } from './focused-documents';
import { deriveLocalProjectionState } from './local';
import { projectionFixture } from './test-fixture';
import { createProjectionWorkspace } from './workspace';

describe('focused document neighborhood description', () => {
  const workspace = createProjectionWorkspace(projectionFixture());

  it('normalizes a Heading root and round-trips as deterministic JSON', () => {
    const state = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 2,
          expandedEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
      },
      'a-detail',
    );
    const first = describeFocusedDocumentNeighborhood(workspace, state);
    const second = describeFocusedDocumentNeighborhood(workspace, state);
    expect(first.rootDocumentEntityId).toBe('doc-a');
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('keeps detailed text/kind filters out of neighborhood membership', () => {
    const base = deriveLocalProjectionState(
      workspace,
      {
        disclosure: {
          defaultDepth: 0,
          expandedEntityIds: [],
          collapsedEntityIds: [],
          includeBlocks: false,
        },
        focus: {
          rootEntityId: 'doc-a',
          hops: 2,
          direction: 'outgoing',
          hierarchyContext: 'ancestors',
        },
      },
      'doc-a',
    );
    const filtered = {
      ...base,
      filters: { text: 'no-match', entityKinds: ['section' as const] },
    };
    expect(
      describeFocusedDocumentNeighborhood(workspace, filtered)
        .documentDistances,
    ).toEqual(
      describeFocusedDocumentNeighborhood(workspace, base).documentDistances,
    );
  });
});

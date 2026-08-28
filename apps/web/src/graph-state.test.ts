import { describe, expect, it } from 'vitest';

import { graphStateReducer, initialGraphState } from './graph-state';

describe('graph projection interaction state', () => {
  it('replaces state atomically after live snapshot reconciliation', () => {
    const state = initialGraphState();
    const replacement = {
      ...state,
      disclosure: { ...state.disclosure, includeBlocks: true },
    };

    expect(
      graphStateReducer(state, { type: 'replace-state', state: replacement }),
    ).toBe(replacement);
  });

  it('resets to the conservative documents-only state', () => {
    const changed = graphStateReducer(initialGraphState(), {
      type: 'set-depth',
      depth: 1,
    });

    expect(graphStateReducer(changed, { type: 'reset-view' })).toEqual(
      initialGraphState(),
    );
  });

  it('expands and collapses entities without mutating prior state', () => {
    const initial = initialGraphState();
    const expanded = graphStateReducer(initial, {
      type: 'toggle-entity',
      entityId: 'entity-a',
      currentlyOpen: false,
    });
    const collapsed = graphStateReducer(expanded, {
      type: 'toggle-entity',
      entityId: 'entity-a',
      currentlyOpen: true,
    });

    expect(initial.disclosure.expandedEntityIds).toEqual([]);
    expect(expanded.disclosure.expandedEntityIds).toEqual(['entity-a']);
    expect(expanded.disclosure.collapsedEntityIds).toEqual([]);
    expect(collapsed.disclosure.expandedEntityIds).toEqual([]);
    expect(collapsed.disclosure.collapsedEntityIds).toEqual(['entity-a']);
  });

  it('preserves disclosure while focus enters, changes, and exits', () => {
    const disclosed = graphStateReducer(
      graphStateReducer(initialGraphState(), {
        type: 'set-heading-limit',
        maxSectionLevel: 2,
      }),
      {
        type: 'toggle-entity',
        entityId: 'entity-a',
        currentlyOpen: false,
      },
    );
    const focused = graphStateReducer(disclosed, {
      type: 'enter-focus',
      entityId: 'entity-a',
    });
    const directed = graphStateReducer(
      graphStateReducer(focused, { type: 'set-focus-hops', hops: 3 }),
      { type: 'set-focus-direction', direction: 'incoming' },
    );
    const restored = graphStateReducer(directed, { type: 'exit-focus' });

    expect(directed.focus).toMatchObject({
      rootEntityId: 'entity-a',
      hops: 3,
      direction: 'incoming',
    });
    expect(restored.focus).toBeUndefined();
    expect(restored.disclosure).toEqual(disclosed.disclosure);
  });

  it('enables block projection without changing structural depth', () => {
    const initial = initialGraphState();
    const withBlocks = graphStateReducer(initial, {
      type: 'set-include-blocks',
      includeBlocks: true,
    });

    expect(withBlocks.disclosure).toMatchObject({
      defaultDepth: 0,
      includeBlocks: true,
    });
    expect(initial.disclosure.includeBlocks).toBe(false);
  });

  it('sets and removes the literal heading ceiling without changing structural depth', () => {
    const initial = initialGraphState();
    const limited = graphStateReducer(initial, {
      type: 'set-heading-limit',
      maxSectionLevel: 1,
    });
    const unlimited = graphStateReducer(limited, {
      type: 'set-heading-limit',
      maxSectionLevel: null,
    });

    expect(limited.disclosure).toMatchObject({
      defaultDepth: 0,
      maxSectionLevel: 1,
    });
    expect(unlimited).toEqual(initial);
  });

  it('maps practical path, entity-kind, and status controls to KG6 filters', () => {
    const scoped = graphStateReducer(initialGraphState(), {
      type: 'set-path-scope',
      pathPrefix: 'folder',
    });
    const withoutSections = graphStateReducer(scoped, {
      type: 'toggle-entity-kind',
      entityKind: 'section',
      enabled: false,
    });
    const withoutInvalid = graphStateReducer(withoutSections, {
      type: 'toggle-reference-status',
      status: 'invalid',
      enabled: false,
    });

    expect(withoutInvalid.filters).toEqual({
      pathPrefixes: ['folder'],
      entityKinds: ['document', 'block'],
      referenceStatuses: ['resolved', 'unresolved', 'ambiguous'],
    });
    expect(
      graphStateReducer(withoutInvalid, {
        type: 'set-path-scope',
        pathPrefix: null,
      }).filters,
    ).toEqual({
      entityKinds: ['document', 'block'],
      referenceStatuses: ['resolved', 'unresolved', 'ambiguous'],
    });
  });

  it('applies one verified navigation state atomically', () => {
    const navigated = {
      ...initialGraphState(),
      disclosure: {
        ...initialGraphState().disclosure,
        expandedEntityIds: ['doc-a'],
      },
    };

    expect(
      graphStateReducer(initialGraphState(), {
        type: 'apply-navigation',
        state: navigated,
      }),
    ).toBe(navigated);
  });

  it('reset clears the heading ceiling back to no limit', () => {
    const limited = graphStateReducer(initialGraphState(), {
      type: 'set-heading-limit',
      maxSectionLevel: 3,
    });

    expect(
      graphStateReducer(limited, { type: 'reset-view' }).disclosure
        .maxSectionLevel,
    ).toBeUndefined();
  });
});

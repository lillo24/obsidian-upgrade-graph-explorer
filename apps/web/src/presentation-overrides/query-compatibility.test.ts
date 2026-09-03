import { describe, expect, it } from 'vitest';
import type { KnowledgeSnapshot } from '@icarus-graph-explorer/core';
import {
  createEmptyPresentationOverrideRegistry,
  reconcilePresentationOverrides,
  serializePresentationOverrideRegistry,
  setEntitySizeScale,
} from '@icarus-graph-explorer/presentation-overrides';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectLocalView,
  projectView,
} from '@icarus-graph-explorer/view-projection';
import {
  createPersistedWorkspaceView,
  PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION,
} from '@icarus-graph-explorer/view-state';
import {
  mapProjectionToGlobal,
  mapProjectionToLocalTopology,
  resolveGlobalNodeStyle,
  resolveLocalNodeStyle,
  resolveGlobalLayoutSettings,
  DEFAULT_GLOBAL_LAYOUT_SETTINGS,
} from '@icarus-graph-explorer/renderer-sigma/core';
import { planExactPathQueryMutation } from '../network-explorer-query-actions';
import { effectiveGlobalProjectionState } from '../global-view';
import { graphStateReducer } from '../graph-state';
import {
  addSavedGraphFilter,
  createEmptySavedGraphFilterRegistry,
} from '../persistence/saved-filters';
import {
  createGraphHistoryCheckpoint,
  createGraphNavigationHistory,
  goBackInGraphHistory,
  recordGraphNavigation,
} from '../navigation-history';

const span = { start: { line: 1, column: 1 }, end: { line: 3, column: 1 } };
const snapshot: KnowledgeSnapshot = {
  schemaVersion: 1,
  workspace: { id: 'size-query-test' },
  entities: ['A', 'B'].map((id) => ({
    id,
    kind: 'document',
    source: { path: `${id}.md`, span },
  })),
  references: [
    {
      id: 'A-B',
      sourceEntityId: 'A',
      kind: 'link',
      rawTarget: 'B',
      sourceSpan: span,
      resolution: { status: 'resolved', targetEntityId: 'B' },
    },
  ],
};

describe('size overrides remain separate from QUERY1/navigation', () => {
  it.each(['All', 'Focus'] as const)(
    'retains %s size across Hide, saved query application, unhide, and Back',
    (scope) => {
      const workspace = createProjectionWorkspace(snapshot);
      const initial = {
        ...documentOnlyProjectionState(),
        ...(scope === 'Focus'
          ? {
              focus: {
                rootEntityId: 'A',
                hops: 1,
                direction: 'both',
                hierarchyContext: 'ancestors',
              } as const,
            }
          : {}),
      };
      const registry = setEntitySizeScale(
        createEmptyPresentationOverrideRegistry(snapshot.workspace.id),
        'B',
        1.75,
      );
      const serialized = serializePresentationOverrideRegistry(registry);
      const overrides = reconcilePresentationOverrides(
        registry,
        new Map(snapshot.entities.map((entity) => [entity.id, entity])),
      );
      const render = (state: typeof initial) =>
        scope === 'Focus'
          ? mapProjectionToLocalTopology(
              projectLocalView(workspace, state),
              'A',
            )
          : mapProjectionToGlobal(
              projectView(
                workspace,
                effectiveGlobalProjectionState(workspace, state),
              ),
            );
      const displayedSize = (state: typeof initial) => {
        const attributes = render(state).nodes.find(
          (node) => node.attributes.entityId === 'B',
        )!.attributes;
        const context = {
          hovered: false,
          selected: false,
          relatedToHover: true,
          sizeScale: overrides.get('B')!.sizeScale,
        };
        return 'root' in attributes
          ? resolveLocalNodeStyle(attributes, { ...context, lod: 'near-local' })
              .size
          : resolveGlobalNodeStyle(attributes, {
              ...context,
              lod: 'near',
              settings: resolveGlobalLayoutSettings(
                DEFAULT_GLOBAL_LAYOUT_SETTINGS,
              ),
            }).size;
      };
      const initialSize = displayedSize(initial);
      const hide = planExactPathQueryMutation({
        activeQuery: undefined,
        queryDraft: '',
        path: 'B.md',
        operation: 'add',
      });
      if (!hide.ok || hide.query === undefined)
        throw new Error('Expected Hide query');
      const saved = addSavedGraphFilter(
        createEmptySavedGraphFilterRegistry(snapshot.workspace.id),
        'Without B',
        hide.query,
      );
      if (!saved.ok) throw new Error(saved.message);
      const hidden = graphStateReducer(initial, {
        type: 'set-query',
        query: saved.value.filters[0]!.query,
      });
      expect(
        render(hidden).nodes.some((node) => node.attributes.entityId === 'B'),
      ).toBe(false);
      expect(overrides.get('B')).toEqual({ sizeScale: 1.75 });
      const unhide = planExactPathQueryMutation({
        activeQuery: hide.query,
        queryDraft: hide.draft,
        path: 'B.md',
        operation: 'remove',
      });
      if (!unhide.ok) throw new Error(unhide.issue);
      const restored = graphStateReducer(hidden, {
        type: 'set-query',
        query: unhide.query ?? null,
      });
      expect(displayedSize(restored)).toBe(initialSize);
      const before = createGraphHistoryCheckpoint(
        initial,
        undefined,
        scope === 'All' ? 'global' : 'local',
      );
      const after = createGraphHistoryCheckpoint(
        hidden,
        undefined,
        scope === 'All' ? 'global' : 'local',
      );
      const back = goBackInGraphHistory(
        recordGraphNavigation(createGraphNavigationHistory(), before, after),
        after,
      );
      expect(back?.target.state).toEqual(before.state);
      expect(serializePresentationOverrideRegistry(registry)).toBe(serialized);
      expect(PERSISTED_WORKSPACE_VIEW_SCHEMA_VERSION).toBe(3);
      expect(
        JSON.stringify(
          createPersistedWorkspaceView({ workspace, state: restored }),
        ),
      ).not.toContain('sizeScale');
      expect(JSON.stringify(saved.value)).not.toContain('sizeScale');
    },
  );
});

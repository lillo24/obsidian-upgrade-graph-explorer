/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { applyRendererInteractionState } from './highlight';
import {
  applyFocusHierarchySubfocus,
  deriveFocusHierarchySubfocusPresentation,
} from './focus-hierarchy-subfocus';
import type { GraphFlowEdge, GraphFlowNode, RendererGraph } from './types';

function entity(
  id: string,
  kind: 'document' | 'section' | 'block',
  moduleId: string,
  x: number,
): GraphFlowNode {
  return {
    id,
    type: 'entity',
    position: { x, y: 0 },
    width: 100,
    height: 50,
    data: {
      projectionNodeId: `projection-${id}`,
      entityId: id,
      entityKind: kind,
      typeLabel:
        kind === 'document' ? 'File' : kind === 'section' ? 'Heading' : 'Block',
      title: id,
      detail: null,
      sourcePath: `${moduleId}.md`,
      sourceStartLine: 1,
      role: 'content',
      focusDistance: 0,
      revealableDescendantCount: 0,
      visibleDescendantCount: 0,
      isExpanded: true,
      internalReferenceCount: 0,
      ariaLabel: id,
      visualVariant: 'extended',
      root: kind === 'document' && id === 'file',
      focusSchematicModuleId: moduleId,
    },
  } as GraphFlowNode;
}

function moduleNode(id: string): GraphFlowNode {
  return {
    id: `module-${id}`,
    type: 'module',
    position: { x: 0, y: 0 },
    width: 400,
    height: 300,
    zIndex: -1,
    data: {
      projectionNodeId: null,
      moduleId: id,
      root: id === 'file',
      hasVisibleStructuralDescendants: true,
    },
  } as GraphFlowNode;
}

function edge(
  id: string,
  source: string,
  target: string,
  kind: 'hierarchy' | 'reference',
): GraphFlowEdge {
  return {
    id,
    type: 'graph',
    source,
    target,
    data: {
      projectionEdgeId: `projection-${id}`,
      kind,
      status: kind === 'reference' ? 'resolved' : null,
      referenceCount: 1,
      ariaLabel: id,
      visualVariant: 'extended',
    },
  } as GraphFlowEdge;
}

function fixture(): RendererGraph {
  return {
    nodes: [
      moduleNode('file'),
      moduleNode('other-file'),
      entity('file', 'document', 'file', 0),
      entity('heading-a', 'section', 'file', 100),
      entity('block-a1', 'block', 'file', 200),
      entity('heading-a2', 'section', 'file', 300),
      entity('heading-b', 'section', 'file', 400),
      entity('other-file', 'document', 'other-file', 500),
      entity('other-heading', 'section', 'other-file', 600),
    ],
    edges: [
      edge('file-a', 'file', 'heading-a', 'hierarchy'),
      edge('a-a1', 'heading-a', 'block-a1', 'hierarchy'),
      edge('a-a2', 'heading-a', 'heading-a2', 'hierarchy'),
      edge('file-b', 'file', 'heading-b', 'hierarchy'),
      edge('other-file-heading', 'other-file', 'other-heading', 'hierarchy'),
      edge('a1-other', 'block-a1', 'other-heading', 'reference'),
      edge('b-other-file', 'heading-b', 'other-file', 'reference'),
    ],
    layoutWarning: null,
  };
}

function tierIds(
  graph: RendererGraph,
  tier: 'primary' | 'context' | 'dimmed',
): string[] {
  return graph.nodes
    .filter(({ className }) => className?.includes(`is-subfocus-${tier}`))
    .map(({ id }) => id)
    .sort();
}

describe('Focus Hierarchy subfocus presentation', () => {
  it('S1/S2 keeps the Heading subtree and exact reference endpoint primary', () => {
    const presentation = deriveFocusHierarchySubfocusPresentation(fixture(), {
      entityId: 'heading-a',
      kind: 'section',
    });

    expect([...presentation.primaryNodeIds].sort()).toEqual([
      'block-a1',
      'heading-a',
      'heading-a2',
      'other-heading',
    ]);
    expect([...presentation.primaryEdgeIds].sort()).toEqual([
      'a-a1',
      'a-a2',
      'a1-other',
    ]);
    expect([...presentation.contextNodeIds].sort()).toEqual([
      'file',
      'module-file',
      'module-other-file',
    ]);
  });

  it('S3 keeps Block subfocus exact instead of expanding its container', () => {
    const applied = applyFocusHierarchySubfocus(fixture(), {
      entityId: 'block-a1',
      kind: 'block',
    });

    expect(tierIds(applied, 'primary')).toEqual(['block-a1', 'other-heading']);
    expect(tierIds(applied, 'context')).toEqual([
      'file',
      'heading-a',
      'module-file',
      'module-other-file',
    ]);
    expect(tierIds(applied, 'dimmed')).toContain('heading-a2');
  });

  it('S4 changes only classes/z-order and leaves topology and geometry intact', () => {
    const graph = fixture();
    const positions = graph.nodes.map(({ id, position, width, height }) => ({
      id,
      position,
      width,
      height,
    }));
    const applied = applyFocusHierarchySubfocus(graph, {
      entityId: 'heading-a',
      kind: 'section',
    });

    expect(applied.nodes.map(({ id }) => id)).toEqual(
      graph.nodes.map(({ id }) => id),
    );
    expect(applied.edges.map(({ id }) => id)).toEqual(
      graph.edges.map(({ id }) => id),
    );
    expect(
      applied.nodes.map(({ id, position, width, height }) => ({
        id,
        position,
        width,
        height,
      })),
    ).toEqual(positions);
  });

  it('S11 leaves the validated graph intact when a stale target is absent', () => {
    const graph = fixture();
    expect(
      applyFocusHierarchySubfocus(graph, {
        entityId: 'removed',
        kind: 'section',
      }),
    ).toBe(graph);
  });

  it('composes persistent tiers with hover and selection classes', () => {
    const graph = applyFocusHierarchySubfocus(fixture(), {
      entityId: 'heading-a',
      kind: 'section',
    });
    const composed = applyRendererInteractionState(
      graph,
      { kind: 'node', id: 'projection-heading-b' },
      { kind: 'node', id: 'projection-heading-b' },
    );
    const unrelated = composed.nodes.find(({ id }) => id === 'heading-b')!;
    const primary = composed.nodes.find(({ id }) => id === 'heading-a')!;

    expect(unrelated.className).toContain('is-subfocus-dimmed');
    expect(unrelated.className).toContain('is-highlighted');
    expect(unrelated.selected).toBe(true);
    expect(primary.className).toContain('is-subfocus-primary');
    expect(primary.className).toContain('is-deemphasized');
  });

  it('defines primary/context/dim opacity and caps unrelated hover emphasis', () => {
    const styles = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );
    expect(styles).toMatch(/is-subfocus-primary[\s\S]*?opacity:\s*1;/);
    expect(styles).toMatch(/is-subfocus-context[\s\S]*?opacity:\s*0\.3;/);
    expect(styles).toMatch(/is-subfocus-dimmed[\s\S]*?opacity:\s*0\.08;/);
    expect(styles).toMatch(
      /is-subfocus-dimmed\.is-highlighted[\s\S]*?opacity:\s*0\.16;/,
    );
  });
});

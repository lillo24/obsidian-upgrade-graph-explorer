import { describe, expect, it } from 'vitest';

import type {
  ProjectedEntityNode,
  ViewProjection,
} from '@icarus-graph-explorer/view-projection';

import { rendererEdgeId, rendererNodeId } from './ids';
import {
  ENTITY_NODE_DIMENSIONS,
  ENTITY_TYPE_LABELS,
  mapProjectionToReactFlow,
} from './mapping';
import { rendererTestProjection } from './test-fixture';

describe('React Flow projection mapping', () => {
  it('maps each KG6 node and edge exactly once without deriving graph semantics', () => {
    const projection = rendererTestProjection();
    const mapped = mapProjectionToReactFlow(
      projection,
      'structure',
      new Set(['document-a']),
    );

    expect(mapped.nodes).toHaveLength(projection.nodes.length);
    expect(mapped.edges).toHaveLength(projection.edges.length);
    expect(
      mapped.nodes.map((node) => node.data.projectionNodeId).sort(),
    ).toEqual(projection.nodes.map((node) => node.id).sort());
    expect(
      mapped.edges.map((edge) => edge.data?.projectionEdgeId).sort(),
    ).toEqual(projection.edges.map((edge) => edge.id).sort());
  });

  it('preserves disclosure, internal-link, diagnostic, and aggregation metadata', () => {
    const mapped = mapProjectionToReactFlow(
      rendererTestProjection(),
      'focus',
      new Set(['document-a']),
    );
    const documentNode = mapped.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-document',
    );
    const diagnosticNode = mapped.nodes.find(
      (node) => node.data.projectionNodeId === 'projection-diagnostic',
    );
    const referenceEdge = mapped.edges.find(
      (edge) => edge.data?.projectionEdgeId === 'projection-reference-edge',
    );

    expect(documentNode?.data).toMatchObject({
      detail: null,
      title: 'Alpha',
      typeLabel: 'File',
      isExpanded: true,
      internalReferenceCount: 2,
      visibleDescendantCount: 1,
    });
    expect(diagnosticNode?.data).toMatchObject({
      status: 'ambiguous',
      rawTarget: 'Shared note',
      candidateCount: 2,
    });
    expect(referenceEdge?.data).toMatchObject({
      status: 'ambiguous',
      referenceCount: 2,
    });
    expect(referenceEdge).toMatchObject({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
    });
    expect(
      mapped.nodes.find(
        (candidate) => candidate.data.projectionNodeId === 'projection-section',
      ),
    ).toMatchObject({
      className:
        'graph-node graph-node--section graph-node--role-content graph-node--focus-distance-1',
      width: 184,
      height: 72,
      data: { typeLabel: 'Heading' },
    });
  });

  it('keeps entity-kind metadata and compact silhouettes explicit', () => {
    expect(ENTITY_TYPE_LABELS).toEqual({
      document: 'File',
      section: 'Heading',
      block: 'Block',
    });
    expect(ENTITY_NODE_DIMENSIONS).toEqual({
      document: { width: 200, height: 80 },
      section: { width: 184, height: 72 },
      block: { width: 152, height: 64 },
    });
  });

  it('adds deterministic collision-only context without exposing full paths by default', () => {
    const entity = (
      id: string,
      entityKind: ProjectedEntityNode['entityKind'],
      sourcePath: string,
      sourceStartLine: number,
      title: string | null,
    ): ProjectedEntityNode => ({
      id,
      kind: 'entity',
      entityId: `entity-${id}`,
      entityKind,
      sourcePath,
      sourceStartLine,
      title,
      hasHiddenChildren: false,
      hiddenDescendantCount: 0,
      internalReferenceIds: [],
      role: 'content',
      focusDistance: null,
    });
    const projection: ViewProjection = {
      nodes: [
        entity('document-alpha', 'document', 'alpha/models/Note.md', 1, null),
        entity('document-beta', 'document', 'beta/models/Note.md', 1, null),
        entity('document-root', 'document', 'Note.md', 1, null),
        entity('document-unique', 'document', 'Unique.md', 1, null),
        entity(
          'section-alpha',
          'section',
          'alpha/models/Note.md',
          4,
          'Overview',
        ),
        entity('section-beta', 'section', 'beta/models/Note.md', 7, 'Overview'),
        entity(
          'section-repeat-a',
          'section',
          'alpha/models/Note.md',
          12,
          'Repeat',
        ),
        entity(
          'section-repeat-b',
          'section',
          'alpha/models/Note.md',
          20,
          'Repeat',
        ),
        entity('section-unique', 'section', 'Unique.md', 3, 'Only here'),
        entity('block', 'block', 'Unique.md', 84, null),
      ],
      edges: [],
      issues: [],
    };
    const mapped = mapProjectionToReactFlow(projection, 'structure', new Set());
    const data = new Map(
      mapped.nodes.map((node) => [node.data.projectionNodeId, node.data]),
    );

    expect(data.get('document-alpha')).toMatchObject({
      title: 'Note',
      detail: 'alpha/models',
    });
    expect(data.get('document-beta')).toMatchObject({
      title: 'Note',
      detail: 'beta/models',
    });
    expect(data.get('document-root')).toMatchObject({
      title: 'Note',
      detail: 'workspace root',
    });
    expect(data.get('document-unique')).toMatchObject({
      title: 'Unique',
      detail: null,
    });
    expect(data.get('section-alpha')).toMatchObject({
      title: 'Overview',
      detail: 'Note · alpha/models',
    });
    expect(data.get('section-beta')).toMatchObject({
      title: 'Overview',
      detail: 'Note · beta/models',
    });
    expect(data.get('section-repeat-a')).toMatchObject({
      title: 'Repeat',
      detail: 'Note · alpha/models · line 12',
    });
    expect(data.get('section-repeat-b')).toMatchObject({
      title: 'Repeat',
      detail: 'Note · alpha/models · line 20',
    });
    expect(data.get('section-unique')).toMatchObject({
      title: 'Only here',
      detail: null,
    });
    expect(data.get('block')).toMatchObject({
      title: 'Line 84',
      detail: 'Unique',
    });
  });

  it('uses collision-safe renderer IDs for projection identifiers', () => {
    expect(rendererNodeId('a,b')).not.toBe(rendererNodeId('a", "b'));
    expect(rendererNodeId('same')).not.toBe(rendererEdgeId('same'));
    expect(JSON.parse(rendererNodeId('value'))).toEqual([
      'reactflow-node',
      'value',
    ]);
  });
});

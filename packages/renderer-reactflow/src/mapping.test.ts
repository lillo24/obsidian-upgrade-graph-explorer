import { describe, expect, it } from 'vitest';

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
      className: 'graph-node graph-node--section',
      width: 200,
      height: 96,
      data: { typeLabel: 'Heading' },
    });
  });

  it('keeps File, Heading, and Block labels and silhouettes explicit', () => {
    expect(ENTITY_TYPE_LABELS).toEqual({
      document: 'File',
      section: 'Heading',
      block: 'Block',
    });
    expect(ENTITY_NODE_DIMENSIONS).toEqual({
      document: { width: 224, height: 112 },
      section: { width: 200, height: 96 },
      block: { width: 168, height: 80 },
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

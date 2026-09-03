import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { mapProjectionToReactFlow } from './mapping';
import { EntityNode } from './nodes';
import { rendererTestProjection } from './test-fixture';
import type { EntityFlowNode } from './types';

function renderNode(node: EntityFlowNode): string {
  return renderToStaticMarkup(
    <ReactFlowProvider>
      <EntityNode
        id={node.id}
        data={node.data}
        type="entity"
        selected={false}
        isConnectable={false}
        dragging={false}
        draggable={false}
        deletable={false}
        selectable
        zIndex={0}
        positionAbsoluteX={0}
        positionAbsoluteY={0}
      />
    </ReactFlowProvider>,
  );
}

describe('Compact File disambiguation', () => {
  const paths = [
    'folder-a/Note.md',
    'folder-b/Note.md',
    'Note.md',
    'root/Note.md',
    'folder/Note.md',
    'nested/a/Note.md',
    'nested/b/Note.md',
    'Unique.md',
  ];
  const template = rendererTestProjection().nodes.find(
    (n) => n.kind === 'entity',
  )!;
  if (template.kind !== 'entity') throw new Error('Expected entity fixture.');
  const projection = {
    nodes: paths.map((path, i) => ({
      ...template,
      id: `node-${i}`,
      entityId: `entity-${i}`,
      sourcePath: path,
      entityKind: 'document' as const,
      title: null,
    })),
    edges: [],
    issues: [],
  };
  it('reuses the shortest parent suffix, including root and nested Files', () => {
    const mapped = mapProjectionToReactFlow(projection, 'structure', {
      visualVariant: 'compact-schematic',
    });
    for (const [i, context] of [
      'folder-a',
      'folder-b',
      'workspace root',
      'root',
      'folder',
      'a',
      'b',
      null,
    ].entries()) {
      const node = mapped.nodes.find(
        (n) => n.type === 'entity' && n.data.sourcePath === paths[i],
      )! as EntityFlowNode;
      expect(node.data.detail).toBe(context);
      const markup = renderNode(node);
      expect(markup).toContain(paths[i]);
      if (context === null)
        expect(markup).not.toContain('compact-file-context');
      else
        expect(markup).toContain(
          `class="compact-file-context" translate="no"> · ${context}</span>`,
        );
      expect(node.width).toBe(156);
      expect(node.height).toBe(46);
    }
  });
  it('keeps extended Files and compact Heading/Block detail behavior unchanged', () => {
    const extended = mapProjectionToReactFlow(projection, 'local-structured', {
      visualVariant: 'extended',
    });
    for (const node of extended.nodes) {
      if (node.type !== 'entity') continue;
      const markup = renderNode(node);
      expect(markup).not.toContain('compact-file-context');
      expect(node.width).toBe(200);
      if (node.data.detail !== null)
        expect(markup).toContain('class="entity-detail"');
    }
    const node = extended.nodes.find(
      (n) => n.type === 'entity',
    )! as EntityFlowNode;
    for (const entityKind of ['section', 'block'] as const) {
      expect(
        renderNode({
          ...node,
          data: {
            ...node.data,
            entityKind,
            visualVariant: 'compact-schematic',
            detail: 'Line 7',
          },
        }),
      ).not.toContain('compact-file-context');
    }
  });
});

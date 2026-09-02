import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { VisualGroupNodePresentation } from '@icarus-graph-explorer/visual-groups';

import { createRendererLayoutInput } from './layout';
import { localStructuredLayoutFingerprint } from './local-structured-layout';
import { mapProjectionToReactFlow } from './mapping';
import { rendererTestProjection } from './test-fixture';
import {
  REACT_FLOW_VISUAL_GROUP_STYLE_UPDATE_CONTRACT,
  useVisualGroupPresentation,
  visualGroupAccentStyle,
  VisualGroupPresentationProvider,
} from './visual-group-presentation';

const presentation = {
  groupName: 'Research',
  color: 'violet',
  accent: '#7c3aed',
} as const;

function Probe({ entityId }: { readonly entityId: string }) {
  const resolved = useVisualGroupPresentation(entityId);
  return (
    <span
      data-color={resolved?.color}
      data-group={resolved?.groupName}
      style={visualGroupAccentStyle(resolved)}
    />
  );
}

describe('React Flow Visual Group presentation seam', () => {
  it('delivers resolved EntityId presentation without query or topology data', () => {
    const markup = renderToStaticMarkup(
      <VisualGroupPresentationProvider
        styles={new Map([['document-a', presentation]])}
      >
        <Probe entityId="document-a" />
      </VisualGroupPresentationProvider>,
    );
    expect(markup).toContain('data-color="violet"');
    expect(markup).toContain('data-group="Research"');
    expect(markup).toContain('--visual-group-accent:#7c3aed');
  });

  it('keeps the default DOM style absent when no map is supplied', () => {
    expect(
      renderToStaticMarkup(
        <VisualGroupPresentationProvider>
          <Probe entityId="document-a" />
        </VisualGroupPresentationProvider>,
      ),
    ).toBe('<span></span>');
  });

  it('keeps mapped topology, geometry, and W3 input independent from style maps', () => {
    const projection = rendererTestProjection();
    const mapped = mapProjectionToReactFlow(projection, 'structure');
    const layoutInput = createRendererLayoutInput(
      mapped.nodes,
      mapped.edges,
      'structure',
    );
    const changedStyles = new Map<string, VisualGroupNodePresentation>([
      ['document-a', presentation],
      [
        'section-a',
        { groupName: 'Draft', color: 'amber', accent: '#d97706' } as const,
      ],
    ]);

    expect(changedStyles.size).toBe(2);
    expect(mapProjectionToReactFlow(projection, 'structure')).toEqual(mapped);
    expect(
      createRendererLayoutInput(mapped.nodes, mapped.edges, 'structure'),
    ).toEqual(layoutInput);
    expect(REACT_FLOW_VISUAL_GROUP_STYLE_UPDATE_CONTRACT).toEqual({
      projection: 0,
      mapping: 0,
      layout: 0,
      geometryChanges: 0,
      styleRenders: 1,
    });
  });

  it('retains every entity grammar and leaves diagnostic presentation outside the seam', () => {
    const mapped = mapProjectionToReactFlow(
      rendererTestProjection(),
      'structure',
    );
    expect(
      mapped.nodes.find(({ type }) => type === 'entity')?.className,
    ).toContain('graph-node--document');
    expect(
      mapped.nodes.find(({ type }) => type === 'diagnostic')?.className,
    ).toBe('graph-node graph-node--diagnostic graph-node--ambiguous');
    expect(
      mapped.nodes.map(({ width, height }) => ({ width, height })),
    ).toEqual(
      mapProjectionToReactFlow(rendererTestProjection(), 'structure').nodes.map(
        ({ width, height }) => ({ width, height }),
      ),
    );
  });

  it('reuses the same style seam in Local Structured with extended cards', () => {
    const projection = rendererTestProjection();
    const structured = mapProjectionToReactFlow(
      projection,
      'local-structured',
      { visualVariant: 'extended', rootEntityId: 'document-a' },
    );
    const before = localStructuredLayoutFingerprint(
      structured.nodes,
      structured.edges,
    );
    const styles = new Map<string, VisualGroupNodePresentation>([
      ['document-a', presentation],
    ]);

    expect(styles.get('document-a')?.accent).toBe('#7c3aed');
    expect(
      localStructuredLayoutFingerprint(structured.nodes, structured.edges),
    ).toBe(before);
    expect(
      new Map(
        structured.nodes.map((node) => [
          node.data.projectionNodeId,
          { width: node.width, height: node.height },
        ]),
      ),
    ).toEqual(
      new Map([
        ['projection-document', { width: 200, height: 80 }],
        ['projection-section', { width: 184, height: 72 }],
        ['projection-diagnostic', { width: 208, height: 94 }],
      ]),
    );
  });
});

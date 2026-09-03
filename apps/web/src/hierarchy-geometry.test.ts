import { describe, expect, it } from 'vitest';
import {
  createProjectionWorkspace,
  documentOnlyProjectionState,
  projectStructureView,
} from '@icarus-graph-explorer/view-projection';
import { validateObsidianDiagnosticReport } from '@icarus-graph-explorer/diagnostics-obsidian';
import { mapProjectionToReactFlow } from '../../../packages/renderer-reactflow/src/mapping';
import { seedLocalStructuredGraph } from '../../../packages/renderer-reactflow/src/local-structured-layout';
import { layoutRendererGraph } from '../../../packages/renderer-reactflow/src/layout-sync';
import { fallbackRendererGraph } from '../../../packages/renderer-reactflow/src/layout';
import type { GraphFlowNode } from '../../../packages/renderer-reactflow/src/types';
import { planLocalEntry } from './local-view';
import sampleReport from './sample-report.json';

function overlaps(nodes: readonly GraphFlowNode[]) {
  const pairs: string[] = [];
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if (
        a.position.x < b.position.x + b.width! &&
        b.position.x < a.position.x + a.width! &&
        a.position.y < b.position.y + b.height! &&
        b.position.y < a.position.y + a.height!
      ) {
        pairs.push(`${a.type}/${b.type}`);
      }
    }
  return pairs;
}

describe('Synthetic Sample hierarchy geometry', () => {
  it('measures seed, adopted and fallback geometry separately', () => {
    const validation = validateObsidianDiagnosticReport(sampleReport);
    if (!validation.valid) throw new Error('Invalid synthetic sample.');
    const workspace = createProjectionWorkspace(validation.value.snapshot);
    const state = documentOnlyProjectionState();
    const source = validation.value.snapshot.entities.find(
      (entity) =>
        entity.kind === 'document' && entity.source.path === 'Source.md',
    );
    if (!source) throw new Error('Missing synthetic Source.');
    const all = projectStructureView(workspace, state);
    const local = planLocalEntry(workspace, state, source.id, 3);
    for (const [mode, projection, variant] of [
      ['structure', all, 'compact-schematic'],
      ['local-structured', local.projection, 'extended'],
    ] as const) {
      const mapped = mapProjectionToReactFlow(projection, mode, {
        visualVariant: variant,
      });
      const root = mapped.nodes.find(
        (node) => node.type === 'entity' && node.data.entityId === source.id,
      )!;
      const seed = seedLocalStructuredGraph(
        mapped.nodes,
        mapped.edges,
        root.id,
      );
      const final = layoutRendererGraph(mapped.nodes, mapped.edges, mode);
      const fallback = fallbackRendererGraph(
        mapped.nodes,
        mapped.edges,
        mode,
        'test',
      );
      // Before HIER0: All final 1 entity/diagnostic; Focus depth-3 seed 9
      // (1 entity/entity, 1 entity/diagnostic, 7 diagnostic/diagnostic), final 3.
      expect(overlaps(seed.nodes)).toEqual([]);
      expect(
        overlaps(final.nodes.filter((node) => node.type === 'entity')),
      ).toEqual([]);
      expect(overlaps(final.nodes)).toEqual([]);
      expect(overlaps(fallback.nodes)).toEqual([]);
      expect(final.layoutWarning).toBeNull();
    }
  });
});

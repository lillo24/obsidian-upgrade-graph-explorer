import {
  applyFocusSchematicSoftRadialSpread,
  type FocusSchematicComputedLayout,
  type FocusSchematicProductMacroLayout,
} from '@icarus-graph-explorer/focus-schematic-layout';
import {
  prepareFocusSchematicRendererGraph,
  type PrepareFocusSchematicRendererGraphInput,
} from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';
import type { RendererGraph } from '@icarus-graph-explorer/renderer-reactflow';

export interface PrepareFocusSchematicDisplayedGraphInput extends Omit<
  PrepareFocusSchematicRendererGraphInput,
  'computedLayout'
> {
  readonly computedLayout: FocusSchematicComputedLayout;
  readonly macroLayout: FocusSchematicProductMacroLayout;
  readonly softSpacing: number;
}

export interface FocusSchematicPresentationResult {
  readonly graph: RendererGraph;
  readonly warning?: string;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Maps one cached structural result into the exact graph sent to GraphCanvas. */
export function prepareFocusSchematicDisplayedGraph(
  input: PrepareFocusSchematicDisplayedGraphInput,
): RendererGraph {
  const { macroLayout, softSpacing, ...rendererInput } = input;
  const displayedComputed =
    macroLayout === 'soft-folder-clusters'
      ? applyFocusSchematicSoftRadialSpread(
          input.layoutInput,
          input.computedLayout,
          softSpacing,
        )
      : input.computedLayout;
  return prepareFocusSchematicRendererGraph({
    ...rendererInput,
    computedLayout: displayedComputed,
  });
}

/** Keeps a validated graph visible while making presentation rejection explicit. */
export function resolveFocusSchematicPresentation(
  input: PrepareFocusSchematicDisplayedGraphInput,
  lastValidGraph: RendererGraph,
): FocusSchematicPresentationResult {
  try {
    return { graph: prepareFocusSchematicDisplayedGraph(input) };
  } catch (error: unknown) {
    return {
      graph: lastValidGraph,
      warning: `Modular presentation failed: ${errorMessage(error)} The last valid modular graph remains visible.`,
    };
  }
}

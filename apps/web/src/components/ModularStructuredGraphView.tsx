import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createFocusSchematicModel } from '@icarus-graph-explorer/focus-schematic';
import {
  FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
  DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES,
  normalizeFocusSchematicSoftFolderStrength,
  type FocusSchematicComputedLayout,
  type FocusSchematicEndpointLayoutPhaseTimings,
  type FocusSchematicLayoutInput,
  type FocusSchematicProductInternalLayoutVariant,
  type FocusSchematicProductLayoutPolicies,
  type FocusSchematicProductMacroLayout,
  type FocusSchematicSoftClusterEvidence,
  type FocusSchematicEndpointOrderPolicy,
} from '@icarus-graph-explorer/focus-schematic-layout';
import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
import {
  GraphCanvas,
  type GraphEdgePathStyle,
  type FocusAppearance,
  type GraphCenterRequest,
  type GraphSelection,
  type GraphTransitionAnchor,
  type GraphTransitionAnchorApi,
  type GraphViewportObservation,
  type RendererGraph,
  type TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import {
  FocusSchematicFolderBandStrips,
  FocusSchematicFolderClusterGuides,
  focusSchematicNodeDimensions,
  prepareFocusSchematicRendererGraph,
} from '@icarus-graph-explorer/renderer-reactflow/focus-schematic';
import type {
  ProjectionWorkspace,
  ViewProjection,
  ViewProjectionState,
} from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import {
  exactFocusSchematicLayoutCacheKey,
  focusSchematicLayoutCache,
} from '../focus-schematic-layout-cache';
import { createFocusSchematicLayoutWorkerService } from '../workers/focus-schematic-layout-worker-client';
import type { SemanticLocalStructuredViewport } from './LocalStructuredGraphView';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';

export interface ModularStructuredGraphViewProps {
  readonly centerRequest?: GraphCenterRequest;
  readonly fitRequestKey: number;
  readonly focusAppearance: FocusAppearance;
  readonly endpointOrderPolicy: FocusSchematicEndpointOrderPolicy;
  readonly folderGuidesVisible?: boolean;
  readonly initialTransitionAnchor?: GraphTransitionAnchor;
  readonly internalLayoutVariant: FocusSchematicProductInternalLayoutVariant;
  readonly macroLayout: FocusSchematicProductMacroLayout;
  readonly softFolderStrength: number;
  readonly instrumentation?: PerformanceInstrumentation;
  readonly onFatalFailure: (message: string) => void;
  readonly onFitRequestConsumed?: (key: number) => void;
  readonly onFocusEntity: (entityId: string) => void;
  readonly onSelectionChange: (selection: GraphSelection | null) => void;
  readonly onToggleEntity: (entityId: string, currentlyOpen: boolean) => void;
  readonly onTransitionAnchorApiChange?: (
    api: GraphTransitionAnchorApi | undefined,
  ) => void;
  readonly onTransitionAnchorConsumed?: (key: number) => void;
  readonly onViewportObservation: (
    viewport: SemanticLocalStructuredViewport | undefined,
  ) => void;
  readonly projection: ViewProjection;
  readonly projectionState: ViewProjectionState;
  readonly projectionWorkspace: ProjectionWorkspace;
  readonly rootEntityId: string;
  readonly routeStyle?: GraphEdgePathStyle;
  readonly selection: GraphSelection | null;
  readonly trackpadZoomMode: TrackpadZoomMode;
  readonly visualGroupStyles?: VisualGroupPresentationMap;
}

type LifecyclePhase =
  | 'idle'
  | 'preparing-model'
  | 'cache-hit'
  | 'worker-pending'
  | 'ready'
  | 'warning-with-last-valid'
  | 'fatal-no-valid-result';

interface AdoptedLayout {
  readonly key: string;
  readonly computed: FocusSchematicComputedLayout;
  readonly graph: RendererGraph;
}

interface LifecycleState {
  readonly phase: LifecyclePhase;
  readonly adopted?: AdoptedLayout;
  readonly message?: string;
}

const EMPTY_PREPARED_GRAPH: RendererGraph = {
  nodes: [],
  edges: [],
  layoutWarning: null,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function recordAttemptTimings(
  instrumentation: PerformanceInstrumentation | undefined,
  timings: FocusSchematicEndpointLayoutPhaseTimings,
): void {
  instrumentation?.record('focus-schematic-phase-input', timings.inputMs);
  instrumentation?.record(
    'focus-schematic-phase-module-planning',
    timings.modulePlanningMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-endpoint-planning',
    timings.endpointConnectionMs +
      timings.demandCollectionMs +
      timings.subtreePropagationMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-internal-layout',
    timings.laneAssignmentMs +
      timings.centerLayoutMs +
      timings.leftLayoutMs +
      timings.rightLayoutMs +
      timings.compositionMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-compass-layout',
    timings.internalVariantMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-macro-layout',
    timings.macroMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-crossing-ordering',
    timings.crossingMinimizationMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-folder-bands',
    timings.folderInventoryMs +
      timings.folderInitialOrderMs +
      timings.folderOrderRefinementMs +
      timings.folderRankOrderingMs +
      timings.folderBandPackingMs +
      timings.folderModuleAssignmentMs +
      timings.folderExceptionAnalysisMs +
      timings.folderQualityMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-attachments',
    timings.attachmentMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-validation',
    timings.validationMs,
  );
  instrumentation?.record(
    'focus-schematic-phase-serialization',
    timings.serializationMs,
  );
}

function recordAttemptEvidence(
  instrumentation: PerformanceInstrumentation | undefined,
  computed: FocusSchematicComputedLayout,
  soft: FocusSchematicSoftClusterEvidence | undefined,
): void {
  const internal = computed.internalLayoutEvidence;
  const folder = computed.folderBandPlan.optimization;
  instrumentation?.record(
    'focus-schematic-joint-refinement-rounds',
    internal.jointFolderRounds,
  );
  instrumentation?.record(
    'focus-schematic-compass-assignment-evaluations',
    internal.completeCompassAssignmentsEvaluated,
  );
  instrumentation?.record(
    'focus-schematic-compass-large-module-fallbacks',
    internal.largeModuleFallbackCount,
  );
  instrumentation?.record(
    'focus-schematic-crossing-evaluations',
    folder?.crossingMetricEvaluations ?? 0,
  );
  if (soft !== undefined) {
    instrumentation?.record(
      'focus-schematic-soft-cluster-layout',
      soft.runtime.layoutMs,
    );
    instrumentation?.record(
      'focus-schematic-soft-cluster-collision-checks',
      soft.runtime.collisionCheckCount,
    );
    instrumentation?.record(
      'focus-schematic-soft-cluster-collision-corrections',
      soft.runtime.collisionCorrectionCount,
    );
  }
}

function currentSafeGraph(
  graph: RendererGraph,
  projection: ViewProjection,
  moduleIds: ReadonlySet<string>,
): RendererGraph {
  const projectionNodeIds = new Set(projection.nodes.map(({ id }) => id));
  const nodes = graph.nodes.filter((node) =>
    node.data.projectionNodeId === null
      ? moduleIds.has(node.data.moduleId as string)
      : projectionNodeIds.has(node.data.projectionNodeId),
  );
  const nodeIds = new Set(nodes.map(({ id }) => id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    ),
  };
}

class ModularStructuredErrorBoundary extends Component<
  {
    readonly children: ReactNode;
    readonly onFailure: (message: string) => void;
  },
  { readonly message?: string }
> {
  override state: { readonly message?: string } = {};

  static getDerivedStateFromError(error: unknown) {
    return { message: errorMessage(error) };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onFailure(errorMessage(error));
  }

  override render() {
    return this.state.message === undefined ? this.props.children : null;
  }
}

export default function ModularStructuredGraphView(
  props: ModularStructuredGraphViewProps,
) {
  const {
    endpointOrderPolicy,
    folderGuidesVisible = true,
    instrumentation,
    internalLayoutVariant,
    macroLayout,
    onFatalFailure,
    onViewportObservation,
    projection,
    projectionState,
    projectionWorkspace,
    rootEntityId,
    softFolderStrength,
    routeStyle = 'direct',
  } = props;
  const workerService = useMemo(
    () => createFocusSchematicLayoutWorkerService(),
    [],
  );
  useWorkerServiceDisposal(workerService);
  const [secondaryRelationshipsVisible, setSecondaryRelationshipsVisible] =
    useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [lifecycle, setLifecycle] = useState<LifecycleState>({ phase: 'idle' });
  const fatalReported = useRef(false);
  const effectiveSoftFolderStrength =
    macroLayout === 'soft-folder-clusters'
      ? normalizeFocusSchematicSoftFolderStrength(softFolderStrength)
      : DEFAULT_FOCUS_SCHEMATIC_PRODUCT_LAYOUT_POLICIES.softFolderStrength;
  const layoutPolicies = useMemo<FocusSchematicProductLayoutPolicies>(
    () => ({
      macroLayout,
      softFolderStrength: effectiveSoftFolderStrength,
      endpointOrderPolicy,
      internalLayoutVariant,
    }),
    [
      effectiveSoftFolderStrength,
      endpointOrderPolicy,
      internalLayoutVariant,
      macroLayout,
    ],
  );

  const model = useMemo(() => {
    const build = () =>
      createFocusSchematicModel({
        workspace: projectionWorkspace,
        state: projectionState,
        projection,
      });
    return instrumentation === undefined
      ? build()
      : instrumentation.measure('focus-schematic-model', undefined, build);
  }, [instrumentation, projection, projectionState, projectionWorkspace]);
  const nodeDimensions = useMemo(() => {
    const derive = () => focusSchematicNodeDimensions(projection, model);
    return instrumentation === undefined
      ? derive()
      : instrumentation.measure(
          'focus-schematic-dimensions',
          undefined,
          derive,
        );
  }, [instrumentation, model, projection]);
  const layoutInput = useMemo<FocusSchematicLayoutInput>(() => {
    const prepare = (): FocusSchematicLayoutInput => ({
      model,
      projection,
      nodeDimensions,
      settings: {
        ...FOCUS_SCHEMATIC_PRODUCTION_LAYOUT_SETTINGS,
        directionalFolderBandsEnabled: macroLayout === 'directional-bands',
      },
    });

    return instrumentation === undefined
      ? prepare()
      : instrumentation.measure(
          'focus-schematic-request-preparation',
          undefined,
          prepare,
        );
  }, [instrumentation, macroLayout, model, nodeDimensions, projection]);
  const layoutKey = useMemo(() => {
    const serialize = () =>
      exactFocusSchematicLayoutCacheKey(layoutInput, layoutPolicies);
    return instrumentation === undefined
      ? serialize()
      : instrumentation.measure(
          'focus-schematic-cache-key',
          undefined,
          serialize,
        );
  }, [instrumentation, layoutInput, layoutPolicies]);

  const prepareGraph = useCallback(
    (
      computed: FocusSchematicComputedLayout,
      secondaryVisible: boolean,
      pathStyle: GraphEdgePathStyle,
    ) => {
      const prepare = () =>
        prepareFocusSchematicRendererGraph({
          projection,
          model,
          layoutInput,
          computedLayout: computed,
          rootEntityId,
          secondaryRelationshipsVisible: secondaryVisible,
          routeStyle: pathStyle,
          visualVariant: 'extended',
        });
      return instrumentation === undefined
        ? prepare()
        : instrumentation.measure(
            'focus-schematic-renderer-mapping',
            undefined,
            prepare,
          );
    },
    [instrumentation, layoutInput, model, projection, rootEntityId],
  );

  useEffect(() => {
    let current = true;
    fatalReported.current = false;
    const startedAt = globalThis.performance.now();
    queueMicrotask(() => {
      if (!current) return;
      setLifecycle((state) => ({
        phase: 'preparing-model',
        ...(state.adopted === undefined ? {} : { adopted: state.adopted }),
      }));
      let lookup;
      try {
        lookup = focusSchematicLayoutCache.get(layoutInput, layoutPolicies);
      } catch {
        lookup = {
          status: 'invalid' as const,
          key: layoutKey,
          approximateBytes: 0,
        };
        instrumentation?.record('focus-schematic-cache-invalidation', 0);
      }
      if (lookup.status === 'hit' && lookup.value !== undefined) {
        try {
          const graph = prepareGraph(lookup.value, false, routeStyle);
          instrumentation?.record('focus-schematic-cache-hit', 0);
          instrumentation?.record(
            'focus-schematic-cache-bytes',
            lookup.approximateBytes,
          );
          setLifecycle({
            phase: 'cache-hit',
            adopted: { key: layoutKey, computed: lookup.value, graph },
          });
          return;
        } catch {
          instrumentation?.record('focus-schematic-cache-invalidation', 0);
        }
      } else {
        instrumentation?.record(
          lookup.status === 'invalid'
            ? 'focus-schematic-cache-invalidation'
            : 'focus-schematic-cache-miss',
          0,
        );
      }
      setLifecycle((state) => ({
        phase: 'worker-pending',
        ...(state.adopted === undefined ? {} : { adopted: state.adopted }),
      }));
      instrumentation?.count('layouts');
      void workerService
        .layoutLatest(layoutInput, layoutPolicies)
        .then((result) => {
          if (!current || result.status === 'superseded') return;
          instrumentation?.record(
            'focus-schematic-worker-compute',
            result.metrics.workerComputeMs,
          );
          instrumentation?.record(
            'focus-schematic-worker-round-trip',
            result.metrics.workerRoundTripMs,
          );
          instrumentation?.record(
            'focus-schematic-worker-startup',
            result.metrics.workerStartupMs,
          );
          if (result.metrics.mainThreadHighGapMs !== undefined)
            instrumentation?.record(
              'focus-schematic-main-thread-gap',
              result.metrics.mainThreadHighGapMs,
            );
          if (result.metrics.timings !== undefined)
            recordAttemptTimings(instrumentation, result.metrics.timings);
          if (result.status === 'failure') {
            setLifecycle((state) => {
              if (state.adopted !== undefined) {
                return {
                  phase: 'warning-with-last-valid',
                  adopted: state.adopted,
                  message: `${result.message} The last valid modular graph remains visible.`,
                };
              }
              return {
                phase: 'fatal-no-valid-result',
                message: result.message,
              };
            });
            return;
          }
          try {
            recordAttemptEvidence(
              instrumentation,
              result.result,
              result.metrics.softClusterEvidence,
            );
            const graph = prepareGraph(result.result, false, routeStyle);
            focusSchematicLayoutCache.set(
              layoutInput,
              layoutPolicies,
              result.result,
            );
            instrumentation?.record(
              'focus-schematic-request-adoption',
              Math.max(0, globalThis.performance.now() - startedAt),
            );
            setLifecycle({
              phase: 'ready',
              adopted: { key: layoutKey, computed: result.result, graph },
            });
          } catch (error: unknown) {
            const message = `Modular renderer adoption failed: ${errorMessage(error)}`;
            setLifecycle((state) =>
              state.adopted === undefined
                ? { phase: 'fatal-no-valid-result', message }
                : {
                    phase: 'warning-with-last-valid',
                    adopted: state.adopted,
                    message: `${message} The last valid modular graph remains visible.`,
                  },
            );
          }
        });
    });
    return () => {
      current = false;
      workerService.cancelPending();
    };
  }, [
    instrumentation,
    layoutInput,
    layoutKey,
    layoutPolicies,
    prepareGraph,
    retryKey,
    workerService,
    routeStyle,
  ]);

  useEffect(() => {
    if (
      lifecycle.phase !== 'fatal-no-valid-result' ||
      lifecycle.message === undefined ||
      fatalReported.current
    )
      return;
    fatalReported.current = true;
    onFatalFailure(lifecycle.message);
  }, [lifecycle.message, lifecycle.phase, onFatalFailure]);

  const displayedGraph = useMemo(() => {
    if (lifecycle.adopted === undefined) return EMPTY_PREPARED_GRAPH;
    if (lifecycle.adopted.key !== layoutKey) {
      return currentSafeGraph(
        lifecycle.adopted.graph,
        projection,
        new Set(model.modules.map(({ id }) => id)),
      );
    }
    try {
      return prepareGraph(
        lifecycle.adopted.computed,
        secondaryRelationshipsVisible,
        routeStyle,
      );
    } catch {
      return lifecycle.adopted.graph;
    }
  }, [
    layoutKey,
    lifecycle.adopted,
    model.modules,
    prepareGraph,
    projection,
    secondaryRelationshipsVisible,
    routeStyle,
  ]);
  // This overlay is derived after layout adoption. Its visibility never enters
  // projection, model, worker request, layout key, or cached geometry.
  const viewportOverlay = useMemo(() => {
    if (
      !folderGuidesVisible ||
      lifecycle.adopted === undefined ||
      lifecycle.adopted.key !== layoutKey
    )
      return undefined;
    return macroLayout === 'directional-bands' ? (
      <FocusSchematicFolderBandStrips
        bands={lifecycle.adopted.computed.folderBandPlan.bands}
        nodes={displayedGraph.nodes}
      />
    ) : (
      <FocusSchematicFolderClusterGuides
        modules={model.modules}
        nodes={displayedGraph.nodes}
        rootModuleId={model.rootModuleId}
      />
    );
  }, [
    displayedGraph.nodes,
    folderGuidesVisible,
    layoutKey,
    lifecycle.adopted,
    macroLayout,
    model.modules,
    model.rootModuleId,
  ]);
  const pending =
    lifecycle.phase === 'idle' ||
    lifecycle.phase === 'preparing-model' ||
    lifecycle.phase === 'worker-pending' ||
    (lifecycle.adopted !== undefined && lifecycle.adopted.key !== layoutKey);
  const status =
    lifecycle.adopted === undefined
      ? 'Preparing modular hierarchy…'
      : pending
        ? 'Updating modular hierarchy…'
        : undefined;
  const observeViewport = useCallback(
    (observation: GraphViewportObservation) =>
      onViewportObservation(
        observation.anchorEntityId === null
          ? undefined
          : {
              anchorEntityId: observation.anchorEntityId,
              structuredZoom: observation.zoom,
            },
      ),
    [onViewportObservation],
  );

  return (
    <ModularStructuredErrorBoundary
      onFailure={(message) =>
        onFatalFailure(`Modular renderer failed: ${message}`)
      }
    >
      <div className="modular-focus-hierarchy">
        <GraphCanvas
          {...props}
          layoutMode="local-structured"
          onViewportObservation={observeViewport}
          {...(instrumentation === undefined
            ? {}
            : { performance: instrumentation })}
          preparedGraph={displayedGraph}
          viewportOverlay={viewportOverlay}
          preparedGraphPending={pending}
          {...(status === undefined ? {} : { preparedGraphStatus: status })}
        />
        <div
          aria-label="Modular Focus Hierarchy preview controls"
          className="modular-focus-hierarchy__controls nowheel"
          data-graph-wheel-ignore
          role="group"
        >
          <label>
            <input
              checked={secondaryRelationshipsVisible}
              onChange={(event) =>
                setSecondaryRelationshipsVisible(event.currentTarget.checked)
              }
              type="checkbox"
            />
            Secondary links
          </label>
          {lifecycle.message === undefined ? null : (
            <span role="alert">{lifecycle.message}</span>
          )}
          {lifecycle.phase === 'warning-with-last-valid' ? (
            <button
              onClick={() => setRetryKey((value) => value + 1)}
              type="button"
            >
              Retry layout
            </button>
          ) : null}
        </div>
      </div>
    </ModularStructuredErrorBoundary>
  );
}

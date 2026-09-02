import { Component, useCallback, useMemo, type ReactNode } from 'react';

import type { PerformanceInstrumentation } from '@icarus-graph-explorer/performance';
import {
  GraphCanvas,
  LocalStructuredLayoutCache,
  type FocusAppearance,
  type GraphCenterRequest,
  type GraphSelection,
  type GraphTransitionAnchor,
  type GraphTransitionAnchorApi,
  type GraphViewportObservation,
  type GraphVisualVariant,
  type TrackpadZoomMode,
} from '@icarus-graph-explorer/renderer-reactflow';
import type { ViewProjection } from '@icarus-graph-explorer/view-projection';
import type { VisualGroupPresentationMap } from '@icarus-graph-explorer/visual-groups';

import { createDagreLayoutWorkerService } from '../workers/dagre-layout-worker-client';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';

export interface SemanticLocalStructuredViewport {
  readonly anchorEntityId: string;
  readonly structuredZoom: number;
}

export interface LocalStructuredGraphViewProps {
  readonly centerRequest?: GraphCenterRequest;
  readonly fitRequestKey: number;
  readonly focusAppearance: FocusAppearance;
  readonly initialTransitionAnchor?: GraphTransitionAnchor;
  readonly instrumentation?: PerformanceInstrumentation;
  readonly layoutRequestKey: number;
  readonly onFailure: (message: string) => void;
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
  readonly rootEntityId: string;
  readonly selection: GraphSelection | null;
  readonly trackpadZoomMode: TrackpadZoomMode;
  readonly visualGroupStyles?: VisualGroupPresentationMap;
  readonly visualVariant: GraphVisualVariant;
}

// Bounded page-lifetime coordinates only. They never enter saved view state or
// canonical data, and an exact topology/dimension fingerprint gates every hit.
const layoutCache = new LocalStructuredLayoutCache();

class LocalStructuredErrorBoundary extends Component<
  {
    readonly children: ReactNode;
    readonly onFailure: (message: string) => void;
  },
  { readonly message?: string }
> {
  override state: { readonly message?: string } = {};

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onFailure(
      error instanceof Error ? error.message : String(error),
    );
  }

  override render() {
    return this.state.message === undefined ? (
      this.props.children
    ) : (
      <div className="graph-failure" role="alert">
        Focus Hierarchy could not mount: {this.state.message}
      </div>
    );
  }
}

export default function LocalStructuredGraphView({
  instrumentation,
  onFailure,
  onViewportObservation,
  ...props
}: LocalStructuredGraphViewProps) {
  const layoutService = useMemo(() => createDagreLayoutWorkerService(), []);
  useWorkerServiceDisposal(layoutService);
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
    <LocalStructuredErrorBoundary onFailure={onFailure}>
      <GraphCanvas
        {...props}
        layoutCache={layoutCache}
        layoutMode="local-structured"
        layoutService={layoutService}
        onViewportObservation={observeViewport}
        {...(instrumentation === undefined
          ? {}
          : { performance: instrumentation })}
      />
    </LocalStructuredErrorBoundary>
  );
}

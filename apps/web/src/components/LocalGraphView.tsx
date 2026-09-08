import { Component, useMemo, type ReactNode } from 'react';

import {
  LocalGraphCanvas,
  LocalLayoutCache,
  type LocalGraphCanvasProps,
} from '@icarus-graph-explorer/renderer-sigma';
import '@icarus-graph-explorer/renderer-sigma/styles.css';

import { createLocalLayoutWorkerService } from '../workers/local-layout-worker-client';
import { createNetworkPhysicsWorkerService } from '../workers/network-physics-worker-client';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';

export type LocalGraphViewProps = Omit<
  LocalGraphCanvasProps,
  'layoutCache' | 'layoutService' | 'physicsServiceFactory'
>;

// The lazy module owns a bounded page-lifetime cache across Local exits and
// re-entry. Coordinates never enter persistence or canonical data.
const layoutCache = new LocalLayoutCache();

class LocalGraphErrorBoundary extends Component<
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
        Focus Network could not mount: {this.state.message}
      </div>
    );
  }
}

export default function LocalGraphView(props: LocalGraphViewProps) {
  const layoutService = useMemo(() => createLocalLayoutWorkerService(), []);
  useWorkerServiceDisposal(layoutService);
  return (
    <LocalGraphErrorBoundary onFailure={props.onFailure}>
      <LocalGraphCanvas
        {...props}
        layoutCache={layoutCache}
        layoutService={layoutService}
        physicsServiceFactory={createNetworkPhysicsWorkerService}
      />
    </LocalGraphErrorBoundary>
  );
}

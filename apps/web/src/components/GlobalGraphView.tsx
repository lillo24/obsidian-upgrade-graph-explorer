import { useMemo } from 'react';

import {
  GlobalGraphCanvas,
  GlobalLayoutCache,
  GlobalSpatialInfluenceCache,
  type GlobalGraphCanvasProps,
} from '@icarus-graph-explorer/renderer-sigma';
import '@icarus-graph-explorer/renderer-sigma/styles.css';

import { createGlobalLayoutWorkerService } from '../workers/global-layout-worker-client';
import { createGlobalSpatialInfluenceWorkerService } from '../workers/global-spatial-influence-worker-client';
import { createNetworkPhysicsWorkerService } from '../workers/network-physics-worker-client';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';

export type GlobalGraphViewProps = Omit<
  GlobalGraphCanvasProps,
  'layoutCache' | 'layoutService' | 'physicsServiceFactory'
>;

// The lazy module survives component unmounts, so exact derived layouts remain
// available when a session moves Structure → Global → Structure → Global.
const layoutCache = new GlobalLayoutCache();
const spatialInfluenceCache = new GlobalSpatialInfluenceCache();

export default function GlobalGraphView(props: GlobalGraphViewProps) {
  const layoutService = useMemo(() => createGlobalLayoutWorkerService(), []);
  const spatialInfluenceService = useMemo(
    () => createGlobalSpatialInfluenceWorkerService(),
    [],
  );
  useWorkerServiceDisposal(layoutService);
  useWorkerServiceDisposal(spatialInfluenceService);
  return (
    <GlobalGraphCanvas
      {...props}
      layoutCache={layoutCache}
      layoutService={layoutService}
      physicsServiceFactory={createNetworkPhysicsWorkerService}
      spatialInfluenceCache={spatialInfluenceCache}
      spatialInfluenceService={spatialInfluenceService}
    />
  );
}

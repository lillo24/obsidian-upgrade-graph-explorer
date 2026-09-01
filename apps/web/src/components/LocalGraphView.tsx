import { useMemo } from 'react';

import {
  LocalGraphCanvas,
  LocalLayoutCache,
  type LocalGraphCanvasProps,
} from '@icarus-graph-explorer/renderer-sigma';
import '@icarus-graph-explorer/renderer-sigma/styles.css';

import { createLocalLayoutWorkerService } from '../workers/local-layout-worker-client';
import { useWorkerServiceDisposal } from './use-worker-service-disposal';

export type LocalGraphViewProps = Omit<
  LocalGraphCanvasProps,
  'layoutCache' | 'layoutService'
>;

// The lazy module owns a bounded page-lifetime cache across Local exits and
// re-entry. Coordinates never enter persistence or canonical data.
const layoutCache = new LocalLayoutCache();

export default function LocalGraphView(props: LocalGraphViewProps) {
  const layoutService = useMemo(() => createLocalLayoutWorkerService(), []);
  useWorkerServiceDisposal(layoutService);
  return (
    <LocalGraphCanvas
      {...props}
      layoutCache={layoutCache}
      layoutService={layoutService}
    />
  );
}

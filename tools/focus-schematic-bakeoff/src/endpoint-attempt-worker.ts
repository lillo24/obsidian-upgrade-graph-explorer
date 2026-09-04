import { parentPort, workerData } from 'node:worker_threads';

import {
  computeFocusSchematicComputedLayoutAttempt,
  type FocusSchematicLayoutInput,
} from '@icarus-graph-explorer/focus-schematic-layout';

const input = (workerData as { readonly input: FocusSchematicLayoutInput })
  .input;
parentPort?.postMessage(computeFocusSchematicComputedLayoutAttempt(input));

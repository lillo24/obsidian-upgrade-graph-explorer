import { parentPort, workerData } from 'node:worker_threads';
import {
  computeFocusSchematicUniformLayoutAttempt as computeFocusSchematicLayoutAttempt,
  type FocusSchematicLayoutInput,
} from '@icarus-graph-explorer/focus-schematic-layout';

import {
  computeClassicBaselineAttempt,
  computeCompoundAttempt,
} from './strategies';

const data = workerData as {
  readonly strategy: 'D0' | 'A' | 'B';
  readonly input: FocusSchematicLayoutInput;
};

const result =
  data.strategy === 'D0'
    ? computeClassicBaselineAttempt(data.input)
    : data.strategy === 'A'
      ? computeFocusSchematicLayoutAttempt(data.input)
      : computeCompoundAttempt(data.input);
parentPort?.postMessage(result);

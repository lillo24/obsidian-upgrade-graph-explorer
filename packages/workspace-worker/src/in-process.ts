import {
  WORKSPACE_WORKER_PROTOCOL_VERSION,
  WorkspaceProcessorError,
  type BuildCommittedReportInput,
  type DesktopWorkspaceProcessor,
  type PrepareChangesInput,
  type PrepareInitializeInput,
  type PrepareResyncInput,
  type WorkspaceWorkerRequestPayload,
  type WorkspaceWorkerResponse,
} from './protocol';
import type { WorkspaceWorkerRuntime } from './runtime';

export function createInProcessWorkspaceProcessor(
  runtime: WorkspaceWorkerRuntime,
): DesktopWorkspaceProcessor {
  let sequence = 0;
  let terminated = false;

  async function send(
    request: WorkspaceWorkerRequestPayload,
  ): Promise<WorkspaceWorkerResponse> {
    if (terminated) {
      throw new WorkspaceProcessorError({
        protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
        requestId: 'terminated',
        kind: 'failure',
        category: 'terminated',
        code: 'processor-terminated',
        message: 'The workspace processor has been terminated.',
      });
    }
    const response = runtime.handle({
      ...request,
      protocolVersion: WORKSPACE_WORKER_PROTOCOL_VERSION,
      requestId: `in-process-${++sequence}`,
    });
    if (response.kind === 'failure')
      throw new WorkspaceProcessorError(response);
    return response;
  }

  return {
    async prepareInitialize(input: PrepareInitializeInput) {
      const response = await send({ kind: 'prepare-initialize', input });
      if (response.kind !== 'prepared')
        throw new Error('Unexpected worker response.');
      return response.prepared;
    },
    async prepareChanges(input: PrepareChangesInput) {
      const response = await send({ kind: 'prepare-changes', input });
      if (response.kind !== 'prepared')
        throw new Error('Unexpected worker response.');
      return response.prepared;
    },
    async prepareResync(input: PrepareResyncInput) {
      const response = await send({ kind: 'prepare-resync', input });
      if (response.kind !== 'prepared')
        throw new Error('Unexpected worker response.');
      return response.prepared;
    },
    async buildCommittedReport(input: BuildCommittedReportInput) {
      const response = await send({ kind: 'build-committed-report', input });
      if (response.kind !== 'committed-report')
        throw new Error('Unexpected worker response.');
      return {
        revision: response.revision,
        report: response.report,
        timings: response.timings,
      };
    },
    async commitCandidate(candidateId) {
      const response = await send({ kind: 'commit-candidate', candidateId });
      if (response.kind !== 'candidate-committed' || response.revision === null)
        throw new Error('Unexpected worker response.');
      return response.revision;
    },
    async discardCandidate(candidateId) {
      const response = await send({ kind: 'discard-candidate', candidateId });
      if (response.kind !== 'candidate-discarded')
        throw new Error('Unexpected worker response.');
      return response.revision;
    },
    terminate() {
      terminated = true;
    },
  };
}
